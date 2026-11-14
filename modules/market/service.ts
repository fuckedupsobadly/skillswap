import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Q, Tx } from "@/db/client";
import { rows } from "@/db/client";
import {
  availability,
  categories,
  memberSkills,
  members,
  offers,
  requests,
  reviews,
  skills,
} from "@/db/schema";
import type { AvailabilityRule } from "@/modules/booking/slots";
import { DomainError } from "@/modules/platform/errors";
import { emit } from "@/modules/platform/outbox";
import { bayesianRating } from "@/modules/trust/reputation";

export type SkillPick = { skillId: string; level: number };

/** Replace a member's teach/learn skills. Every teach skill gets an active offer; dropped ones are paused. */
export async function setSkills(tx: Tx, memberId: string, teach: SkillPick[], learn: SkillPick[]) {
  await tx.delete(memberSkills).where(eq(memberSkills.memberId, memberId));
  const rowsToInsert = [
    ...teach.map((s) => ({ memberId, skillId: s.skillId, level: s.level, direction: "teach" as const })),
    ...learn.map((s) => ({ memberId, skillId: s.skillId, level: s.level, direction: "learn" as const })),
  ];
  if (rowsToInsert.length) await tx.insert(memberSkills).values(rowsToInsert).onConflictDoNothing();
  const teachIds = teach.map((s) => s.skillId);
  for (const skillId of teachIds) {
    await tx
      .insert(offers)
      .values({ memberId, skillId })
      .onConflictDoUpdate({ target: [offers.memberId, offers.skillId], set: { active: true } });
  }
  await tx
    .update(offers)
    .set({ active: false })
    .where(
      teachIds.length
        ? and(eq(offers.memberId, memberId), notInArray(offers.skillId, teachIds))
        : eq(offers.memberId, memberId),
    );
}

export async function setAvailability(
  tx: Tx,
  memberId: string,
  rules: Omit<AvailabilityRule, "timezone">[],
  timezone: string,
) {
  await tx.delete(availability).where(eq(availability.memberId, memberId));
  if (rules.length) {
    await tx.insert(availability).values(rules.map((r) => ({ memberId, ...r, timezone })));
  }
}

export async function availabilityOf(q: Q, memberId: string): Promise<AvailabilityRule[]> {
  return q
    .select({
      weekday: availability.weekday,
      startMin: availability.startMin,
      endMin: availability.endMin,
      timezone: availability.timezone,
    })
    .from(availability)
    .where(eq(availability.memberId, memberId));
}

export async function createRequest(
  tx: Tx,
  memberId: string,
  r: {
    skillId: string;
    level: number;
    format: "live" | "group" | "in_person" | "async";
    lengthMin: number;
    text: string;
    confidence: number;
    parsedBy: "ai" | "rules" | "form";
  },
) {
  const [skill] = await tx
    .select({ id: skills.id, rules: categories.rules })
    .from(skills)
    .innerJoin(categories, eq(categories.id, skills.categoryId))
    .where(eq(skills.id, r.skillId));
  if (!skill) throw new DomainError("not_found", "Unknown skill.");
  if (!skill.rules.formats.includes(r.format)) {
    throw new DomainError("policy", `This category doesn't offer ${r.format.replace("_", " ")} sessions.`);
  }
  const [open] = await tx
    .select({ id: requests.id })
    .from(requests)
    .where(
      and(eq(requests.memberId, memberId), eq(requests.skillId, r.skillId), eq(requests.status, "open")),
    );
  if (open) {
    await tx
      .update(requests)
      .set({ level: r.level, format: r.format, lengthMin: r.lengthMin, text: r.text })
      .where(eq(requests.id, open.id));
    return open.id;
  }
  const [created] = await tx
    .insert(requests)
    .values({ memberId, ...r })
    .returning({ id: requests.id });
  await emit(tx, "request.created", { requestId: created.id });
  return created.id;
}

export async function closeRequest(tx: Tx, memberId: string, requestId: string) {
  await tx
    .update(requests)
    .set({ status: "closed" })
    .where(and(eq(requests.id, requestId), eq(requests.memberId, memberId)));
}

export async function updateProfile(
  tx: Tx,
  memberId: string,
  p: { displayName: string; bio: string; timezone: string; languages: string[] },
) {
  await tx.update(members).set(p).where(eq(members.id, memberId));
}

export async function memberSkillsOf(q: Q, memberId: string) {
  return q
    .select({
      skillId: memberSkills.skillId,
      direction: memberSkills.direction,
      level: memberSkills.level,
      name: skills.name,
      slug: skills.slug,
      category: categories.name,
      offerId: offers.id,
    })
    .from(memberSkills)
    .innerJoin(skills, eq(skills.id, memberSkills.skillId))
    .innerJoin(categories, eq(categories.id, skills.categoryId))
    .leftJoin(
      offers,
      and(
        eq(offers.memberId, memberSkills.memberId),
        eq(offers.skillId, memberSkills.skillId),
        eq(offers.active, true),
      ),
    )
    .where(eq(memberSkills.memberId, memberId));
}

export async function ratingsFor(q: Q, memberIds: string[]) {
  if (memberIds.length === 0) return new Map<string, { rating: number | null; count: number }>();
  const list = await q
    .select({ subjectId: reviews.subjectId, authorId: reviews.authorId, rating: reviews.rating })
    .from(reviews)
    .where(inArray(reviews.subjectId, memberIds));
  const out = new Map<string, { rating: number | null; count: number }>();
  for (const id of memberIds) {
    const mine = list.filter((r) => r.subjectId === id);
    out.set(id, { rating: bayesianRating(mine), count: mine.length });
  }
  return out;
}

export async function profileByHandle(q: Q, handle: string) {
  const [m] = await q
    .select()
    .from(members)
    .where(and(eq(members.handle, handle), sql`${members.deletedAt} is null`));
  if (!m) return null;
  const [skillsList, revs, avail, stats] = await Promise.all([
    memberSkillsOf(q, m.id),
    q
      .select({
        rating: reviews.rating,
        text: reviews.text,
        createdAt: reviews.createdAt,
        authorId: reviews.authorId,
        author: members.displayName,
      })
      .from(reviews)
      .innerJoin(members, eq(members.id, reviews.authorId))
      .where(eq(reviews.subjectId, m.id))
      .orderBy(desc(reviews.createdAt))
      .limit(20),
    availabilityOf(q, m.id),
    q.execute(sql`
      select
        count(*) filter (where bp.role = 'teacher')::int as taught,
        count(*) filter (where bp.role = 'learner')::int as learned,
        coalesce(sum(b.length_min) filter (where bp.role = 'teacher'), 0)::int as "taughtMin"
      from booking_participants bp join bookings b on b.id = bp.booking_id
      where bp.member_id = ${m.id} and b.status = 'settled'
    `),
  ]);
  const s = rows<{ taught: number; learned: number; taughtMin: number }>(stats)[0];
  return {
    member: m,
    skills: skillsList,
    reviews: revs,
    availability: avail,
    stats: s,
    rating: bayesianRating(revs),
  };
}

/** Teachers of a skill, with the numbers members decide on: rating, sessions taught, trust. */
export async function teachersOfSkill(
  q: Q,
  skillId: string,
  filters: { minTrust?: number; language?: string } = {},
) {
  const res = await q.execute(sql`
    select o.id as "offerId", o.lengths, m.id as "memberId", m.handle, m.display_name as "displayName", m.trust_level as "trustLevel",
      m.is_sample as "isSample", m.languages, m.timezone, ms.level,
      (select count(*)::int from booking_participants bp join bookings b on b.id = bp.booking_id
         where bp.member_id = m.id and bp.role = 'teacher' and b.status = 'settled') as taught
    from offers o
    join members m on m.id = o.member_id and m.deleted_at is null
    left join member_skills ms on ms.member_id = m.id and ms.skill_id = o.skill_id and ms.direction = 'teach'
    where o.skill_id = ${skillId} and o.active
      and m.trust_level >= ${filters.minTrust ?? 0}
      ${filters.language ? sql`and ${filters.language} = any(m.languages)` : sql``}
    order by m.trust_level desc, taught desc
    limit 50
  `);
  const list = rows<{
    offerId: string;
    lengths: number[];
    memberId: string;
    handle: string;
    displayName: string;
    trustLevel: number;
    isSample: boolean;
    languages: string[];
    timezone: string;
    level: number | null;
    taught: number;
  }>(res);
  const ratings = await ratingsFor(
    q,
    list.map((t) => t.memberId),
  );
  return list.map((t) => ({ ...t, rating: ratings.get(t.memberId)?.rating ?? null }));
}

export async function openRequestsForSkill(q: Q, skillId: string) {
  return q
    .select({
      id: requests.id,
      level: requests.level,
      text: requests.text,
      displayName: members.displayName,
      handle: members.handle,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .innerJoin(members, eq(members.id, requests.memberId))
    .where(and(eq(requests.skillId, skillId), eq(requests.status, "open")))
    .orderBy(desc(requests.createdAt))
    .limit(20);
}
