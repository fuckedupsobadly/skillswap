import { and, eq, gt, sql } from "drizzle-orm";
import type { DB, Q } from "@/db/client";
import { rows } from "@/db/client";
import { type CycleEdgeRecord, members, requests, swapCycles } from "@/db/schema";
import { createBooking } from "@/modules/booking/service";
import {
  type AvailabilityRule,
  anytime,
  expand,
  type Interval,
  intersect,
  slotStarts,
  totalMinutes,
} from "@/modules/booking/slots";
import type { SignedAction } from "@/modules/identity/keys";
import { verifyAction } from "@/modules/identity/service";
import { DomainError } from "@/modules/platform/errors";
import { emit } from "@/modules/platform/outbox";
import { buildGraph, type Cycle, cycleKey, type Edge, findCycles, selectCycles } from "./cycles";
import {
  activityFactor,
  type EdgeFactors,
  edgeScore,
  explainFactors,
  levelFit,
  timeOverlap,
  trustFactor,
} from "./score";

const DAY = 86_400_000;
export const PROPOSAL_TTL_H = 48;

export type EdgeData = {
  skillId: string;
  skillName: string;
  offerId: string;
  requestId: string | null;
  lengthMin: number;
  teacherLevel: number;
  learnerLevel: number;
  sharedMinutes: number;
  factors: EdgeFactors;
};

type GraphInput = {
  members: { id: string; trustLevel: number; lastActiveAt: Date; timezone: string; isSample: boolean }[];
  teaches: {
    memberId: string;
    skillId: string;
    skillName: string;
    offerId: string;
    level: number;
    lengths: number[];
  }[];
  wants: {
    memberId: string;
    skillId: string;
    level: number;
    requestId: string | null;
    lengthMin: number;
    confidence: number;
  }[];
  rules: Map<string, AvailabilityRule[]>;
  blocked: Set<string>;
};

export async function loadGraphInput(q: Q): Promise<GraphInput> {
  const [mem, teach, want, avail, blk] = await Promise.all([
    q.execute(sql`select id, trust_level as "trustLevel", last_active_at as "lastActiveAt", timezone, is_sample as "isSample"
                  from members where deleted_at is null`),
    q.execute(sql`select o.member_id as "memberId", o.skill_id as "skillId", s.name as "skillName", o.id as "offerId",
                    coalesce(ms.level, 3) as level, o.lengths
                  from offers o join skills s on s.id = o.skill_id
                  left join member_skills ms on ms.member_id = o.member_id and ms.skill_id = o.skill_id and ms.direction = 'teach'
                  where o.active and 'live' = any(o.formats)`),
    q.execute(sql`
      select distinct on (member_id, skill_id) member_id as "memberId", skill_id as "skillId", level, "requestId", "lengthMin", confidence
      from (
        select member_id, skill_id, level, id as "requestId", length_min as "lengthMin", confidence, 0 as pri, created_at
          from requests where status = 'open' and format = 'live'
        union all
        select member_id, skill_id, level, null, 60, 1, 1, created_at from member_skills where direction = 'learn'
      ) w
      order by member_id, skill_id, pri, created_at desc`),
    q.execute(
      sql`select member_id as "memberId", weekday, start_min as "startMin", end_min as "endMin", timezone from availability`,
    ),
    q.execute(sql`select blocker_id as a, blocked_id as b from blocks`),
  ]);
  const membersList = rows<GraphInput["members"][number]>(mem).map((m) => ({
    ...m,
    lastActiveAt: new Date(m.lastActiveAt),
  }));
  const rules = new Map<string, AvailabilityRule[]>();
  for (const r of rows<AvailabilityRule & { memberId: string }>(avail)) {
    const list = rules.get(r.memberId) ?? [];
    list.push({ weekday: r.weekday, startMin: r.startMin, endMin: r.endMin, timezone: r.timezone });
    rules.set(r.memberId, list);
  }
  const blocked = new Set<string>();
  for (const b of rows<{ a: string; b: string }>(blk)) {
    blocked.add(`${b.a}:${b.b}`);
    blocked.add(`${b.b}:${b.a}`);
  }
  return {
    members: membersList,
    teaches: rows<GraphInput["teaches"][number]>(teach),
    wants: rows<GraphInput["wants"][number]>(want).map((w) => ({ ...w, confidence: Number(w.confidence) })),
    rules,
    blocked,
  };
}

/** Edge A → B for every skill A teaches that B wants, with a level and format that fit and overlapping free time. */
export function buildEdges(input: GraphInput, now: Date, opts: { learner?: string } = {}): Edge<EdgeData>[] {
  const byId = new Map(input.members.map((m) => [m.id, m]));
  const teachersBySkill = new Map<string, GraphInput["teaches"]>();
  for (const t of input.teaches) {
    if (!byId.has(t.memberId)) continue;
    const list = teachersBySkill.get(t.skillId) ?? [];
    list.push(t);
    teachersBySkill.set(t.skillId, list);
  }
  const to = new Date(now.getTime() + 7 * DAY);
  const freeCache = new Map<string, Interval[]>();
  const free = (id: string) => {
    let ivs = freeCache.get(id);
    if (!ivs) {
      ivs = expand(input.rules.get(id) ?? anytime(byId.get(id)?.timezone ?? "UTC"), now, to);
      freeCache.set(id, ivs);
    }
    return ivs;
  };

  const edges: Edge<EdgeData>[] = [];
  for (const w of input.wants) {
    if (opts.learner && w.memberId !== opts.learner) continue;
    if (!byId.has(w.memberId)) continue;
    for (const t of teachersBySkill.get(w.skillId) ?? []) {
      if (t.memberId === w.memberId || input.blocked.has(`${t.memberId}:${w.memberId}`)) continue;
      const teacher = byId.get(t.memberId)!;
      const lengthMin = t.lengths.includes(w.lengthMin) ? w.lengthMin : (t.lengths[0] ?? 60);
      const shared = intersect(free(t.memberId), free(w.memberId));
      const sharedMinutes = totalMinutes(shared);
      const factors: EdgeFactors = {
        similarity: Math.max(0.05, Math.min(1, w.confidence)),
        levelFit: levelFit(t.level, w.level),
        timeOverlap: timeOverlap(sharedMinutes, lengthMin),
        trust: trustFactor(teacher.trustLevel),
        activity: activityFactor(teacher.lastActiveAt, now),
      };
      const score = edgeScore(factors);
      if (score <= 0) continue;
      edges.push({
        from: t.memberId,
        to: w.memberId,
        score,
        data: {
          skillId: w.skillId,
          skillName: t.skillName,
          offerId: t.offerId,
          requestId: w.requestId,
          lengthMin,
          teacherLevel: t.level,
          learnerLevel: w.level,
          sharedMinutes,
          factors,
        },
      });
    }
  }
  return edges;
}

export type DirectMatch = {
  teacher: { id: string; handle: string; displayName: string; trustLevel: number; isSample: boolean };
  score: number;
  data: EdgeData;
  reasons: string[];
};

/** Top direct matches for one member's wants (optionally one skill), straight from the live graph. */
export async function directMatches(
  q: Q,
  memberId: string,
  opts: { skillId?: string; limit?: number } = {},
  now = new Date(),
) {
  const input = await loadGraphInput(q);
  const edges = buildEdges(input, now, { learner: memberId })
    .filter((e) => !opts.skillId || e.data.skillId === opts.skillId)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 10);
  const people = await memberCards(
    q,
    edges.map((e) => e.from),
  );
  return edges.map<DirectMatch>((e) => ({
    teacher: people.get(e.from)!,
    score: e.score,
    data: e.data,
    reasons: explainFactors(e.data.factors, e.data),
  }));
}

async function memberCards(q: Q, ids: string[]) {
  const out = new Map<string, DirectMatch["teacher"]>();
  if (ids.length === 0) return out;
  const res =
    await q.execute(sql`select id, handle, display_name as "displayName", trust_level as "trustLevel", is_sample as "isSample"
    from members where id in (${sql.join(
      [...new Set(ids)].map((i) => sql`${i}`),
      sql`, `,
    )})`);
  for (const m of rows<DirectMatch["teacher"]>(res)) out.set(m.id, m);
  return out;
}

const toRecord = (e: Edge<EdgeData>, startsAt: Date): CycleEdgeRecord => ({
  teacherId: e.from,
  learnerId: e.to,
  skillId: e.data.skillId,
  offerId: e.data.offerId,
  requestId: e.data.requestId,
  lengthMin: e.data.lengthMin,
  startsAt: startsAt.toISOString(),
  score: e.score,
  factors: e.data.factors,
  reasons: explainFactors(e.data.factors, e.data),
});

async function persistProposals(db: DB, cycles: Cycle<EdgeData>[], now: Date) {
  if (cycles.length === 0) return [] as string[];
  const existing = await db
    .select({ id: swapCycles.id, members: swapCycles.members })
    .from(swapCycles)
    .where(and(eq(swapCycles.status, "proposed"), gt(swapCycles.expiresAt, now)));
  const known = new Map(existing.map((c) => [cycleKey(c.members), c.id]));
  const ids: string[] = [];
  for (const c of cycles) {
    const key = cycleKey(c.members);
    const hit = known.get(key);
    if (hit) {
      ids.push(hit);
      continue;
    }
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(swapCycles)
        .values({
          members: c.members,
          edges: c.edges.map((e) => toRecord(e, now)),
          score: c.score,
          expiresAt: new Date(now.getTime() + PROPOSAL_TTL_H * 3_600_000),
        })
        .returning({ id: swapCycles.id });
      await emit(tx, "cycle.proposed", { cycleId: row.id });
      return row.id;
    });
    known.set(key, id);
    ids.push(id);
  }
  return ids;
}

/** "Match me": find the best swap cycles that include this member and propose up to three. */
export async function proposeCyclesFor(db: DB, memberId: string, now = new Date()) {
  const g = buildGraph(buildEdges(await loadGraphInput(db), now), 8, memberId);
  const found = findCycles(g, { through: memberId, limit: 4000 }).sort(
    (a, b) => b.score / b.members.length - a.score / a.members.length || a.members.length - b.members.length,
  );
  // Prefer variety: at most one proposal per distinct thing the member would learn.
  const picked: Cycle<EdgeData>[] = [];
  const learnSkills = new Set<string>();
  for (const c of found) {
    const learn = c.edges.at(-1)!.data.skillId;
    if (learnSkills.has(learn)) continue;
    learnSkills.add(learn);
    picked.push(c);
    if (picked.length === 3) break;
  }
  return persistProposals(db, picked, now);
}

/** Nightly: every cycle in the graph, then a greedy pass for the best non-overlapping set. */
export async function nightlyMatching(db: DB, now = new Date()) {
  const g = buildGraph(buildEdges(await loadGraphInput(db), now), 6);
  const chosen = selectCycles(findCycles(g, { limit: 20_000 }));
  const ids = await persistProposals(db, chosen, now);
  return { cycles: ids.length };
}

export async function proposalsFor(q: Q, memberId: string, now = new Date()) {
  const list = await q
    .select()
    .from(swapCycles)
    .where(
      and(sql`${memberId} = any(${swapCycles.members})`, sql`${swapCycles.status} in ('proposed','booked')`),
    )
    .orderBy(sql`${swapCycles.createdAt} desc`)
    .limit(12);
  const active = list.filter((c) => c.status === "booked" || c.expiresAt > now);
  const people = await memberCards(
    q,
    active.flatMap((c) => c.members),
  );
  const skillIds = [...new Set(active.flatMap((c) => c.edges.map((e) => e.skillId)))];
  const names = new Map<string, string>();
  if (skillIds.length) {
    const res = await q.execute(
      sql`select id, name from skills where id in (${sql.join(
        skillIds.map((i) => sql`${i}`),
        sql`, `,
      )})`,
    );
    for (const s of rows<{ id: string; name: string }>(res)) names.set(s.id, s.name);
  }
  return active.map((c) => ({
    ...c,
    people: c.members.map((id) => people.get(id)!),
    edgesNamed: c.edges.map((e) => ({ ...e, skillName: names.get(e.skillId) ?? "Skill" })),
  }));
}

/**
 * Accepting a cycle is a signed action. When the last member accepts, every edge becomes an accepted booking in
 * one transaction: each learner's hours are held, and the cycle nets out to zero for everyone.
 */
export async function acceptCycle(
  db: DB,
  actor: { memberId: string; deviceId: string },
  input: { cycleId: string; payload: SignedAction; signature: string },
  now = new Date(),
) {
  const proof = await verifyAction(db, actor.deviceId, actor.memberId, input.payload, input.signature, {
    action: "accept_cycle",
    cycleId: input.cycleId,
  });
  return acceptCycleVerified(db, actor.memberId, input.cycleId, proof.signerKey, now);
}

export async function acceptCycleVerified(
  db: DB,
  memberId: string,
  cycleId: string,
  signerKey: string,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(swapCycles).where(eq(swapCycles.id, cycleId)).for("update");
    if (!c) throw new DomainError("not_found", "Proposal not found.");
    if (!c.members.includes(memberId)) throw new DomainError("forbidden", "You're not in this cycle.");
    if (c.status !== "proposed") throw new DomainError("conflict", `This proposal is ${c.status}.`);
    if (c.expiresAt <= now) throw new DomainError("conflict", "This proposal expired.");
    const accepted = [...new Set([...c.acceptedBy, memberId])];
    await tx.update(swapCycles).set({ acceptedBy: accepted }).where(eq(swapCycles.id, cycleId));
    if (accepted.length < c.members.length)
      return { booked: false, accepted: accepted.length, of: c.members.length };

    // Everyone said yes: book every edge at the first slot that suits that pair.
    const rules = async (id: string) => {
      const [m] = await tx.select({ tz: members.timezone }).from(members).where(eq(members.id, id));
      const r = rows<AvailabilityRule>(
        await tx.execute(
          sql`select weekday, start_min as "startMin", end_min as "endMin", timezone from availability where member_id = ${id}`,
        ),
      );
      return r.length ? r : anytime(m?.tz ?? "UTC");
    };
    const edges: CycleEdgeRecord[] = [];
    for (const e of c.edges) {
      const shared = intersect(
        expand(await rules(e.teacherId), now, new Date(now.getTime() + 7 * DAY)),
        expand(await rules(e.learnerId), now, new Date(now.getTime() + 7 * DAY)),
      );
      const [first] = slotStarts(shared, e.lengthMin, now, 1);
      if (!first)
        throw new DomainError("conflict", "No shared time left this week for one pair in the cycle.");
      // Net-zero: the learner also teaches in this cycle, so their hold may use what they'll earn.
      const floorCreditMin = c.edges
        .filter((x) => x.teacherId === e.learnerId)
        .reduce((a, x) => a + x.lengthMin, 0);
      await createBooking(
        tx,
        {
          floorCreditMin,
          offerId: e.offerId,
          learnerId: e.learnerId,
          startsAt: first,
          lengthMin: e.lengthMin,
          requestId: e.requestId,
          cycleId,
          status: "accepted",
          signerKey,
        },
        { now },
      );
      if (e.requestId)
        await tx.update(requests).set({ status: "matched" }).where(eq(requests.id, e.requestId));
      edges.push({ ...e, startsAt: first.toISOString() });
    }
    await tx.update(swapCycles).set({ status: "booked", edges }).where(eq(swapCycles.id, cycleId));
    await emit(tx, "cycle.booked", { cycleId });
    return { booked: true, accepted: accepted.length, of: c.members.length };
  });
}

export async function declineCycle(db: DB, memberId: string, cycleId: string) {
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(swapCycles).where(eq(swapCycles.id, cycleId)).for("update");
    if (!c?.members.includes(memberId)) throw new DomainError("forbidden", "You're not in this cycle.");
    if (c.status !== "proposed") return;
    await tx.update(swapCycles).set({ status: "declined" }).where(eq(swapCycles.id, cycleId));
  });
}

export async function expireProposals(db: DB, now = new Date()) {
  const res = await db
    .update(swapCycles)
    .set({ status: "expired" })
    .where(and(eq(swapCycles.status, "proposed"), sql`${swapCycles.expiresAt} <= ${now}`))
    .returning({ id: swapCycles.id });
  return res.length;
}

export { explainFactors };
