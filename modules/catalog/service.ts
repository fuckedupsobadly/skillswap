import { and, asc, eq, sql } from "drizzle-orm";
import type { Q } from "@/db/client";
import { rows } from "@/db/client";
import { type CategoryRules, categories, skills } from "@/db/schema";

export type SkillHit = {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  rules: CategoryRules;
  score: number;
  matchedName: boolean;
};

const STOPWORDS = new Set(
  "i im i'm me my want wanna would like to learn learning how help with for a an the some get better at in on of and or about please teach someone basics basic one song songs good start started starting beginner intermediate advanced lesson lessons session sessions class classes hour hours min mins minutes online person quick quickly really just can could you need".split(
    " ",
  ),
);

export function queryTokens(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9+#\s-]/g, " ")
        .split(/[\s-]+/)
        .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
    ),
  ].slice(0, 8);
}

/** Postgres full-text (English stemming, prefix) + trigram similarity. No extra search service to run. */
export async function searchSkills(q: Q, text: string, limit = 8): Promise<SkillHit[]> {
  const tokens = queryTokens(text);
  if (tokens.length === 0) return [];
  const tsq = tokens
    .map((t) => `${t.replace(/[+#]/g, "")}:*`)
    .filter((t) => t !== ":*")
    .join(" | ");
  const phrase = tokens.join(" ");
  const res = await q.execute(sql`
    select s.id, s.slug, s.name, c.slug as "categorySlug", c.name as "categoryName", c.rules,
      ts_rank(to_tsvector('english', s.name || ' ' || s.keywords), to_tsquery('english', ${tsq})) * 4
        + greatest(similarity(lower(s.name), ${phrase}), word_similarity(lower(s.name), ${phrase})) as score
    from skills s join categories c on c.id = s.category_id
    where to_tsvector('english', s.name || ' ' || s.keywords) @@ to_tsquery('english', ${tsq})
       or word_similarity(lower(s.name), ${phrase}) > 0.45
    order by score desc, s.name asc
    limit 24
  `);
  // A token that starts a word of the skill's name ("guitar" → "Guitar") outranks a keyword-only match.
  return rows<Omit<SkillHit, "matchedName">>(res)
    .map((r) => {
      const words = r.name.toLowerCase().split(/[^a-z0-9+#]+/);
      const matchedName = tokens.some((t) =>
        words.some((w) => w.length > 1 && (w.startsWith(t) || t.startsWith(w))),
      );
      return { ...r, score: Number(r.score), matchedName };
    })
    .sort((a, b) => Number(b.matchedName) - Number(a.matchedName) || b.score - a.score)
    .slice(0, limit);
}

export async function listCategories(q: Q) {
  const res = await q.execute(sql`
    select c.id, c.slug, c.name, c.rules,
      (select count(*)::int from skills s where s.category_id = c.id) as "skillCount",
      (select count(distinct o.member_id)::int from offers o join skills s on s.id = o.skill_id
         where s.category_id = c.id and o.active) as "teacherCount"
    from categories c where c.parent_id is null order by c.position asc
  `);
  return rows<{
    id: string;
    slug: string;
    name: string;
    rules: CategoryRules;
    skillCount: number;
    teacherCount: number;
  }>(res);
}

export async function categoryWithSkills(q: Q, slug: string) {
  const [cat] = await q.select().from(categories).where(eq(categories.slug, slug));
  if (!cat) return null;
  const res = await q.execute(sql`
    select s.id, s.slug, s.name,
      (select count(*)::int from offers o where o.skill_id = s.id and o.active) as "teachers",
      (select count(*)::int from requests r where r.skill_id = s.id and r.status = 'open') as "openRequests"
    from skills s where s.category_id = ${cat.id} order by s.name asc
  `);
  return {
    category: cat,
    skills: rows<{ id: string; slug: string; name: string; teachers: number; openRequests: number }>(res),
  };
}

export async function skillBySlug(q: Q, slug: string) {
  const [s] = await q
    .select({ skill: skills, category: categories })
    .from(skills)
    .innerJoin(categories, eq(categories.id, skills.categoryId))
    .where(eq(skills.slug, slug));
  return s ?? null;
}

export async function allSkills(q: Q) {
  return q
    .select({
      id: skills.id,
      slug: skills.slug,
      name: skills.name,
      category: categories.name,
      categorySlug: categories.slug,
    })
    .from(skills)
    .innerJoin(categories, and(eq(categories.id, skills.categoryId)))
    .orderBy(asc(categories.position), asc(skills.name));
}
