import { generateText, isStepCount, Output, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import type { DB, Q } from "@/db/client";
import { aiRuns } from "@/db/schema";
import { allSkills, type SkillHit, searchSkills } from "@/modules/catalog/service";
import { directMatches } from "@/modules/matching/service";
import { sha256Hex } from "@/modules/platform/canonical";
import { levelName } from "@/modules/platform/format";
import { parseHints } from "./rules";

/**
 * The honest AI concierge. It always says it is an AI, only reads and drafts, and never books, cancels or moves
 * hours: every proposal becomes real only when the member taps and their device signs. Every run is logged.
 * Without a model configured it falls back to the rule-based parser and says so.
 */
export const PARSER_MODEL = "anthropic/claude-haiku-5.5";
export const CONCIERGE_MODEL = "anthropic/claude-sonnet-5.5";

export const aiEnabled = () => Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

export type ParsedRequest = {
  engine: "ai" | "rules";
  skill: Pick<SkillHit, "id" | "slug" | "name" | "categoryName"> | null;
  alternatives: Pick<SkillHit, "id" | "slug" | "name" | "categoryName">[];
  level: number;
  format: "live" | "group" | "in_person" | "async";
  lengthMin: number;
  confidence: number;
  note: string;
  excluded: string | null;
};

const POLICY = `SkillSwap is a time bank: members teach for an hour to earn an hour, and spend it learning anything.
Excluded everywhere: legal, medical, therapy and personalised financial advice; childcare or anything involving minors;
rides and driving; anything adults-only or illegal; work that needs a license (electrical, gas, structural).`;

const parsedSchema = z.object({
  skillSlug: z
    .string()
    .nullable()
    .describe("slug of the best matching skill from the list, or null if none fits"),
  alternativeSlugs: z.array(z.string()).max(3),
  level: z.number().int().min(1).max(5).describe("the learner's CURRENT level: 1 beginner … 5 expert"),
  format: z.enum(["live", "group", "in_person", "async"]),
  lengthMin: z
    .number()
    .int()
    .refine((n) => [30, 60, 90, 120].includes(n)),
  confidence: z.number().min(0).max(1),
  note: z.string().max(200).describe("one short sentence to the member about how you read their request"),
  excluded: z
    .string()
    .nullable()
    .describe("if the request is excluded by policy, a one-sentence reason; else null"),
});

async function logRun(
  q: Q,
  run: {
    memberId: string | null;
    purpose: string;
    engine: "ai" | "rules";
    model?: string;
    input: string;
    output: unknown;
    tokens?: number;
    proposedAction?: unknown;
  },
) {
  await q.insert(aiRuns).values({
    memberId: run.memberId,
    purpose: run.purpose,
    engine: run.engine,
    model: run.model ?? null,
    inputHash: await sha256Hex(run.input),
    output: run.output as object,
    tokens: run.tokens ?? 0,
    proposedAction: (run.proposedAction ?? null) as object | null,
  });
}

/** Turn a plain sentence into a structured request draft: skill, level, format, length. */
export async function parseRequest(db: DB, memberId: string | null, text: string): Promise<ParsedRequest> {
  const input = text.trim().slice(0, 500);
  const hints = parseHints(input);
  const hits = await searchSkills(db, input, 6);
  const pick = (h: SkillHit) => ({ id: h.id, slug: h.slug, name: h.name, categoryName: h.categoryName });

  if (aiEnabled()) {
    try {
      const catalog = await allSkills(db);
      const bySlug = new Map(catalog.map((s) => [s.slug, s]));
      const { output, usage } = await generateText({
        model: PARSER_MODEL,
        output: Output.object({ schema: parsedSchema }),
        system: `You are SkillSwap's AI concierge. You turn a member's sentence into a structured learning request.\n${POLICY}\nPick skills only from this list (slug: name — category):\n${catalog.map((s) => `${s.slug}: ${s.name} — ${s.category}`).join("\n")}`,
        prompt: `Member's request: """${input}"""\nSearch hints (may be wrong): ${hits.map((h) => h.slug).join(", ") || "none"}`,
      });
      const skill = output.skillSlug ? bySlug.get(output.skillSlug) : undefined;
      const result: ParsedRequest = {
        engine: "ai",
        skill: skill
          ? { id: skill.id, slug: skill.slug, name: skill.name, categoryName: skill.category }
          : null,
        alternatives: output.alternativeSlugs
          .map((s) => bySlug.get(s))
          .filter((s): s is NonNullable<typeof s> => Boolean(s) && s?.slug !== skill?.slug)
          .map((s) => ({ id: s.id, slug: s.slug, name: s.name, categoryName: s.category })),
        level: output.level,
        format: output.format,
        lengthMin: output.lengthMin,
        confidence: skill ? output.confidence : 0,
        note: output.note,
        excluded: output.excluded ?? hints.excluded,
      };
      await logRun(db, {
        memberId,
        purpose: "parse_request",
        engine: "ai",
        model: PARSER_MODEL,
        input,
        output: result,
        tokens: usage?.totalTokens ?? 0,
      });
      return result;
    } catch (e) {
      console.error("[concierge] model call failed, falling back to rules", e);
    }
  }

  const top = hits[0];
  const result: ParsedRequest = {
    engine: "rules",
    skill: top && !hints.excluded ? pick(top) : null,
    alternatives: hits.slice(1, 4).map(pick),
    level: hints.level,
    format: hints.format,
    lengthMin: hints.lengthMin,
    confidence: !top ? 0 : top.matchedName ? 0.9 : 0.65,
    note: top
      ? `Read as ${top.name}, ${levelName(hints.level).toLowerCase()}, ${hints.lengthMin} min.`
      : "No skill in the catalog matched. Try different words or browse Explore.",
    excluded: hints.excluded,
  };
  await logRun(db, { memberId, purpose: "parse_request", engine: "rules", input, output: result });
  return result;
}

/**
 * Concierge chat agent. Read tools only, plus `draft_request`, which returns a draft the UI shows with an
 * Approve button. Approving is a separate server action the member triggers; the agent cannot do it.
 */
export function conciergeAgent(db: DB, memberId: string) {
  return new ToolLoopAgent({
    model: CONCIERGE_MODEL,
    stopWhen: isStepCount(6),
    instructions: `You are SkillSwap's concierge, and you are an AI — say so if asked, and never pretend to be a member.
${POLICY}
One hour always equals one hour; never price skills or talk about money for hours.
You can search skills, find and explain matches, and draft requests. You cannot book, cancel or move hours;
when the member wants to act, draft it and tell them to tap Approve. Be brief: two or three short sentences.`,
    tools: {
      search_skills: tool({
        description: "Search the skill catalog",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) =>
          (await searchSkills(db, query, 6)).map((s) => ({
            slug: s.slug,
            name: s.name,
            category: s.categoryName,
          })),
      }),
      find_matches: tool({
        description: "Find the best teachers for one of the member's wants (optionally a skill slug)",
        inputSchema: z.object({ skillSlug: z.string().optional() }),
        execute: async ({ skillSlug }) => {
          const skill = skillSlug ? (await allSkills(db)).find((s) => s.slug === skillSlug) : undefined;
          const list = await directMatches(db, memberId, { skillId: skill?.id, limit: 5 });
          return list.map((m) => ({
            teacher: m.teacher.displayName,
            sample: m.teacher.isSample,
            skill: m.data.skillName,
            score: Math.round(m.score * 100) / 100,
            reasons: m.reasons,
          }));
        },
      }),
      draft_request: tool({
        description: "Draft a learning request for the member to approve. This does not post anything.",
        inputSchema: z.object({ text: z.string().describe("the member's request in their words") }),
        execute: async ({ text }) => {
          const parsed = await parseRequest(db, memberId, text);
          await logRun(db, {
            memberId,
            purpose: "draft_request",
            engine: "ai",
            model: CONCIERGE_MODEL,
            input: text,
            output: parsed,
            proposedAction: { type: "create_request", text },
          });
          return { draft: parsed, text, requiresApproval: true };
        },
      }),
    },
  });
}

export type ConciergeAgent = ReturnType<typeof conciergeAgent>;
