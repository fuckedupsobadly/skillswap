import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { DB, Q, Tx } from "@/db/client";
import { rows } from "@/db/client";
import {
  achievements,
  bookingParticipants,
  bookings,
  categories,
  DEFAULT_GAME_SETTINGS,
  equipped,
  type GameSettings,
  items,
  kitties,
  kittyNeeds,
  memberAchievements,
  memberItems,
  memberProgress,
  members,
  reviews,
  seasons,
  skills,
  skillVisits,
  swapCycles,
  xpEvents,
} from "@/db/schema";
import { sha256Hex } from "@/modules/platform/canonical";
import { DomainError } from "@/modules/platform/errors";
import { appSecret } from "@/modules/platform/secret";
import { ACHIEVEMENTS, achievementById, ITEMS, itemById } from "./catalog";
import { levelForXp, levelProgress } from "./curve";
import { encode, type Personality, roll, stageForLevel } from "./genome";
import { apply, FULL, type Needs, needsAt } from "./needs";
import { nextRank, RANKS, type RankId, rankFor, rankIndex, rankName, type Slot, slotsOpen } from "./ranks";
import { meets, SEASONS, type SeasonId, type Stats, seasonOf } from "./rules";
import { sessionXp, XP, type XpSource } from "./xp";

const DAY = 86_400_000;

// ── Catalog ─────────────────────────────────────────────────────────────────

/** Upsert the item, achievement and season catalogue from code (idempotent; runs at startup). */
export async function ensureGameCatalog(db: DB) {
  for (const it of ITEMS) {
    const row = {
      id: it.id,
      slot: it.slot,
      name: it.name,
      unlockRule: it.rule,
      rarity: it.rarity,
      animated: Boolean(it.animated),
      sprites: { art: it.id },
    };
    await db.insert(items).values(row).onConflictDoUpdate({ target: items.id, set: row });
  }
  for (const a of ACHIEVEMENTS) {
    const row = { id: a.id, name: a.name, rule: a.rule, itemId: a.itemId };
    await db.insert(achievements).values(row).onConflictDoUpdate({ target: achievements.id, set: row });
  }
  for (const s of SEASONS) {
    const itemIds = ITEMS.filter((i) => i.rule.type === "season" && i.rule.season === s.id).map((i) => i.id);
    const row = { id: s.id, name: s.name, months: s.months, itemIds };
    await db.insert(seasons).values(row).onConflictDoUpdate({ target: seasons.id, set: row });
  }
}

const SAMPLE_NAMES = [
  "Miso",
  "Pip",
  "Mochi",
  "Biscuit",
  "Tofu",
  "Nori",
  "Clover",
  "Juniper",
  "Pepper",
  "Sable",
  "Olive",
  "Plum",
  "Maple",
  "Basil",
  "Fig",
  "Kiwi",
  "Hazel",
  "Poppy",
  "Rye",
  "Sesame",
];

/** Sample members get kitties too, and XP for the sessions they settled before the game existed. */
export async function ensureSampleKitties(db: DB) {
  const sample = rows<{ id: string }>(
    await db.execute(
      sql`select m.id from members m left join kitties k on k.member_id = m.id where m.is_sample and k.member_id is null order by m.handle`,
    ),
  );
  for (const [i, m] of sample.entries()) {
    const [c] = await candidates(db, m.id);
    await db.transaction((tx) => adoptCandidate(tx, m.id, c, SAMPLE_NAMES[i % SAMPLE_NAMES.length]));
  }
  // Backfill: every settled booking without session XP yet.
  const pending = rows<{ id: string }>(
    await db.execute(sql`select b.id from bookings b where b.status = 'settled'
      and not exists (select 1 from xp_events x where x.booking_id = b.id) order by b.settled_at asc`),
  );
  for (const b of pending) await awardSettledBooking(db, b.id);
}

// ── Kitty genome & adoption ────────────────────────────────────────────────

/** Seed = SHA-256(member id + server secret + counter): nobody can predict or grind for a genome. */
const seedFor = (memberId: string, counter: number) =>
  sha256Hex(`${memberId}:${appSecret()}:kitty:${counter}`);

export type Candidate = { counter: number; code: string; personality: Personality };

/** Three unique kittens (counters 0, 1, 2…, re-rolling past any visible code already taken). */
export async function candidates(q: Q, memberId: string, n = 3): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (let counter = 0; out.length < n && counter < 64; counter++) {
    const g = roll(await seedFor(memberId, counter));
    const code = encode(g);
    if (out.some((c) => c.code === code)) continue;
    const [taken] = await q.select({ m: kitties.memberId }).from(kitties).where(eq(kitties.genomeCode, code));
    if (taken) continue;
    out.push({ counter, code, personality: g.personality });
  }
  return out;
}

async function adoptCandidate(tx: Tx, memberId: string, c: Candidate, name: string) {
  await tx.insert(kitties).values({ memberId, genomeCode: c.code, name, personality: c.personality });
  await tx
    .insert(kittyNeeds)
    .values({ memberId, ...FULL })
    .onConflictDoNothing();
  await ensureProgress(tx, memberId);
}

export const cleanName = (name: string) => {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 1 || n.length > 16) throw new DomainError("invalid", "A name is 1 to 16 characters.");
  return n;
};

export async function adoptKitty(db: DB, memberId: string, choice: number, name: string) {
  const nm = cleanName(name);
  for (let attempt = 0; attempt < 3; attempt++) {
    const list = await candidates(db, memberId);
    const pick = list[choice];
    if (!pick) throw new DomainError("invalid", "Pick one of the three kittens.");
    try {
      return await db.transaction(async (tx) => {
        const [has] = await tx
          .select({ m: kitties.memberId })
          .from(kitties)
          .where(eq(kitties.memberId, memberId));
        if (has) throw new DomainError("conflict", "You already adopted a kitty.");
        await adoptCandidate(tx, memberId, pick, nm);
        return pick.code;
      });
    } catch (e) {
      // Someone else took the same genome in the same instant: re-roll and try again.
      if (e instanceof DomainError) throw e;
      if (!String((e as Error).cause ?? e).includes("genome_code")) throw e;
    }
  }
  throw new DomainError("conflict", "Couldn't adopt right now. Try again.");
}

export async function renameKitty(db: DB, memberId: string, name: string) {
  const res = await db
    .update(kitties)
    .set({ name: cleanName(name) })
    .where(eq(kitties.memberId, memberId))
    .returning({ m: kitties.memberId });
  if (!res.length) throw new DomainError("not_found", "Adopt a kitty first.");
}

// ── Progress ───────────────────────────────────────────────────────────────

export async function ensureProgress(q: Q, memberId: string) {
  await q.insert(memberProgress).values({ memberId }).onConflictDoNothing();
}

export type Grant = {
  key: string;
  source: XpSource;
  amount: number;
  occurredAt: Date;
  counterpartId?: string | null;
  bookingId?: string | null;
};

const WEEK_CAP: Partial<Record<XpSource, number>> = { gift: XP.giftWeekCap, pet: XP.petWeekCap };

/**
 * Insert XP idempotently with the anti-farming caps applied: 300 a day, 60 a week from one counterpart,
 * and per-source weekly caps. A capped grant is still recorded (amount 0) so its key is used up.
 */
export async function grant(tx: Tx, memberId: string, g: Grant) {
  const [dupe] = await tx
    .select({ id: xpEvents.id })
    .from(xpEvents)
    .where(and(eq(xpEvents.memberId, memberId), eq(xpEvents.sourceEventId, g.key)));
  if (dupe) return null;
  const at = g.occurredAt;
  const dayStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const sums = rows<{ day: number; pair: number; source: number }>(
    await tx.execute(sql`select
      coalesce(sum(amount) filter (where occurred_at >= ${dayStart} and occurred_at < ${new Date(dayStart.getTime() + DAY)} and amount > 0), 0)::int as day,
      coalesce(sum(amount) filter (where ${g.counterpartId ?? null}::uuid is not null and counterpart_id = ${g.counterpartId ?? null}::uuid
        and occurred_at > ${new Date(at.getTime() - 7 * DAY)} and occurred_at <= ${at} and amount > 0), 0)::int as pair,
      coalesce(sum(amount) filter (where source = ${g.source} and occurred_at > ${new Date(at.getTime() - 7 * DAY)} and occurred_at <= ${at}), 0)::int as source
      from xp_events where member_id = ${memberId}`),
  )[0];
  let amount = g.amount;
  amount = Math.min(amount, XP.dailyCap - sums.day);
  if (g.counterpartId) amount = Math.min(amount, XP.pairWeekCap - sums.pair);
  const weekCap = WEEK_CAP[g.source];
  if (weekCap !== undefined) amount = Math.min(amount, weekCap - sums.source);
  amount = Math.max(0, amount);
  const [row] = await tx
    .insert(xpEvents)
    .values({
      memberId,
      sourceEventId: g.key,
      source: g.source,
      amount,
      requested: g.amount,
      counterpartId: g.counterpartId ?? null,
      bookingId: g.bookingId ?? null,
      occurredAt: at,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/** Everything the unlock rules look at, computed from settled, two-sided activity only. */
export async function computeStats(q: Q, memberId: string): Promise<Stats> {
  const [member] = await q
    .select({ trust: members.trustLevel, tz: members.timezone })
    .from(members)
    .where(eq(members.id, memberId));
  const [prog] = await q.select().from(memberProgress).where(eq(memberProgress.memberId, memberId));
  const settled = rows<{
    role: "teacher" | "learner";
    lengthMin: number;
    category: string;
    skillId: string;
    kind: string;
    startsAt: Date;
    settledAt: Date;
  }>(
    await q.execute(sql`select bp.role, b.length_min as "lengthMin", c.slug as category, b.skill_id as "skillId", b.kind,
        b.starts_at as "startsAt", b.settled_at as "settledAt"
      from booking_participants bp join bookings b on b.id = bp.booking_id
      join skills s on s.id = b.skill_id join categories c on c.id = s.category_id
      where bp.member_id = ${memberId} and b.status = 'settled'`),
  );
  const minutesTaughtByCategory: Record<string, number> = {};
  const learnedSkills: Record<string, Set<string>> = {};
  let early = 0;
  let late = 0;
  const seasonsActive = new Set<SeasonId>();
  const hourIn = (d: Date) =>
    Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone: member?.tz ?? "UTC",
      }).format(new Date(d)),
    );
  for (const s of settled) {
    if (s.role === "teacher")
      minutesTaughtByCategory[s.category] = (minutesTaughtByCategory[s.category] ?? 0) + s.lengthMin;
    else {
      learnedSkills[s.category] ??= new Set();
      learnedSkills[s.category].add(s.skillId);
    }
    const h = hourIn(s.startsAt);
    if (h < 8) early++;
    if (h >= 21) late++;
    seasonsActive.add(seasonOf(new Date(s.settledAt ?? s.startsAt)));
  }
  const counts = rows<{
    cycles: number;
    written: number;
    fives: number;
    gifted: number;
    panels: number;
    mentees: number;
    pages: number;
  }>(
    await q.execute(sql`select
      (select count(*)::int from swap_cycles sc where ${memberId} = any(sc.members) and sc.status = 'booked'
        and not exists (select 1 from bookings b where b.cycle_id = sc.id and b.status <> 'settled')) as cycles,
      (select count(*)::int from reviews where author_id = ${memberId}) as written,
      (select count(*)::int from reviews where subject_id = ${memberId} and rating = 5) as fives,
      (select coalesce(sum(le.amount_min), 0)::int from ledger_entries le
        join accounts src on src.id = le.debit_account and src.owner_type = 'member' and src.owner_id = ${memberId}
        join accounts dst on dst.id = le.credit_account and dst.owner_type = 'community'
        where le.kind = 'gift') as gifted,
      (select count(*)::int from dispute_votes where juror_id = ${memberId}) as panels,
      (select count(distinct l.member_id)::int from bookings b
        join booking_participants l on l.booking_id = b.id and l.role = 'learner'
        where b.teacher_id = ${memberId} and b.status = 'settled'
          and exists (select 1 from bookings b2 where b2.teacher_id = l.member_id and b2.skill_id = b.skill_id
            and b2.status = 'settled' and b2.starts_at > b.starts_at)) as mentees,
      (select count(*)::int from skill_visits where member_id = ${memberId}) as pages`),
  )[0];
  // Reliability: settled sessions in a row (most recent first) until a late cancel or a no-show.
  const history = rows<{
    status: string;
    closedBy: string | null;
    startsAt: Date;
    updatedAt: Date;
    role: string;
  }>(
    await q.execute(sql`select b.status, b.closed_by as "closedBy", b.starts_at as "startsAt", b.updated_at as "updatedAt", bp.role
      from booking_participants bp join bookings b on b.id = bp.booking_id
      where bp.member_id = ${memberId} and b.status in ('settled','cancelled','no_show') order by b.starts_at desc limit 200`),
  );
  let cleanStreak = 0;
  for (const h of history) {
    if (h.status === "settled") cleanStreak++;
    else if (h.status === "no_show") break;
    else if (
      h.closedBy === memberId &&
      new Date(h.startsAt).getTime() - new Date(h.updatedAt).getTime() < 12 * 3_600_000
    )
      break;
  }
  const owned = await q
    .select({ id: memberAchievements.achievementId })
    .from(memberAchievements)
    .where(eq(memberAchievements.memberId, memberId));
  const teacherRows = settled.filter((s) => s.role === "teacher");
  return {
    level: prog?.level ?? 1,
    rank: (prog?.rank ?? "kitten") as RankId,
    trustLevel: member?.trust ?? 0,
    settledAsTeacher: teacherRows.length,
    settledAsLearner: settled.length - teacherRows.length,
    minutesTaught: teacherRows.reduce((a, s) => a + s.lengthMin, 0),
    minutesTaughtByCategory,
    categoriesTaught: Object.keys(minutesTaughtByCategory).length,
    cyclesCompleted: counts.cycles,
    reviewsWritten: counts.written,
    fiveStarsReceived: counts.fives,
    learnedSkillsByCategory: Object.fromEntries(Object.entries(learnedSkills).map(([k, v]) => [k, v.size])),
    giftedToCommunityMin: counts.gifted,
    cleanStreak,
    groupClassesTaught: teacherRows.filter((s) => s.kind === "group").length,
    disputePanels: counts.panels,
    earlySessions: early,
    lateSessions: late,
    menteesTeaching: counts.mentees,
    slowBlinks: prog?.slowBlinks ?? 0,
    skillPagesVisited: counts.pages,
    seasonsActive: [...seasonsActive],
    achievements: new Set(owned.map((o) => o.id)),
  };
}

export type ProgressChange = {
  levelBefore: number;
  level: number;
  rankBefore: RankId;
  rank: RankId;
  newItems: string[];
  newAchievements: string[];
};

/** Recompute total, level and rank (rank never drops), then run the unlock engine. */
export async function refreshProgress(
  tx: Tx,
  memberId: string,
  sourceKey: string | null = null,
): Promise<ProgressChange> {
  await ensureProgress(tx, memberId);
  const [before] = await tx
    .select()
    .from(memberProgress)
    .where(eq(memberProgress.memberId, memberId))
    .for("update");
  const total = rows<{ t: number }>(
    await tx.execute(
      sql`select coalesce(sum(amount), 0)::int as t from xp_events where member_id = ${memberId}`,
    ),
  )[0].t;
  const level = levelForXp(Math.max(0, total));
  await tx
    .update(memberProgress)
    .set({ xpTotal: total, level, updatedAt: new Date() })
    .where(eq(memberProgress.memberId, memberId));

  const stats = await computeStats(tx, memberId);
  stats.level = level;
  const rank = rankFor(
    {
      level,
      minutesTaught: stats.minutesTaught,
      sessionsTaught: stats.settledAsTeacher,
      categoriesTaught: stats.categoriesTaught,
      trustLevel: stats.trustLevel,
    },
    before.rank as RankId,
  );
  if (rank !== before.rank)
    await tx
      .update(memberProgress)
      .set({ rank, rankReachedAt: new Date() })
      .where(eq(memberProgress.memberId, memberId));
  stats.rank = rank;
  await tx
    .update(kitties)
    .set({ stage: stageForLevel(level) })
    .where(eq(kitties.memberId, memberId));

  // Achievements first (items can depend on them), then items.
  const newAchievements: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (stats.achievements.has(a.id) || !meets(a.rule, stats)) continue;
    const res = await tx
      .insert(memberAchievements)
      .values({ memberId, achievementId: a.id, sourceEventId: sourceKey })
      .onConflictDoNothing()
      .returning();
    if (res.length) {
      stats.achievements.add(a.id);
      newAchievements.push(a.id);
    }
  }
  const owned = new Set(
    (
      await tx.select({ id: memberItems.itemId }).from(memberItems).where(eq(memberItems.memberId, memberId))
    ).map((r) => r.id),
  );
  const newItems: string[] = [];
  for (const it of ITEMS) {
    if (owned.has(it.id) || !meets(it.rule, stats)) continue;
    const res = await tx
      .insert(memberItems)
      .values({ memberId, itemId: it.id, sourceEventId: sourceKey })
      .onConflictDoNothing()
      .returning();
    if (res.length) newItems.push(it.id);
  }
  return {
    levelBefore: before.level,
    level,
    rankBefore: before.rank as RankId,
    rank,
    newItems,
    newAchievements,
  };
}

// ── Event handlers ─────────────────────────────────────────────────────────

/** Session settled: XP for both sides, bonuses, a treat each, and the cycle bonus when a cycle completes. */
export async function awardSettledBooking(db: DB, bookingId: string) {
  return db.transaction(async (tx) => {
    const [b] = await tx
      .select({ booking: bookings, categorySlug: categories.slug })
      .from(bookings)
      .innerJoin(skills, eq(skills.id, bookings.skillId))
      .innerJoin(categories, eq(categories.id, skills.categoryId))
      .where(eq(bookings.id, bookingId));
    if (b?.booking.status !== "settled") return [];
    const at = b.booking.settledAt ?? new Date();
    const parts = await tx
      .select()
      .from(bookingParticipants)
      .where(eq(bookingParticipants.bookingId, bookingId));
    const revs = await tx.select().from(reviews).where(eq(reviews.bookingId, bookingId));
    const touched = new Set<string>();
    for (const p of parts) {
      const other = parts.find((x) => x.memberId !== p.memberId);
      if (!other) continue;
      const base = { occurredAt: at, bookingId, counterpartId: other.memberId };
      const session = await grant(tx, p.memberId, {
        ...base,
        key: `booking:${bookingId}:session`,
        source: p.role === "teacher" ? "teach" : "learn",
        amount: sessionXp(p.role, b.booking.lengthMin, b.booking.kind === "group"),
      });
      if (session) {
        await ensureProgress(tx, p.memberId);
        await tx
          .update(memberProgress)
          .set({ treats: sql`${memberProgress.treats} + 1` })
          .where(eq(memberProgress.memberId, p.memberId));
      }
      await grant(tx, p.memberId, {
        ...base,
        key: `pair:${other.memberId}`,
        source: "new_counterpart",
        amount: XP.newCounterpart,
      });
      if (p.role === "teacher") {
        await grant(tx, p.memberId, {
          ...base,
          counterpartId: null,
          key: `category:${b.categorySlug}`,
          source: "new_category",
          amount: XP.newCategoryTaught,
        });
      }
      if (revs.some((r) => r.authorId === p.memberId)) {
        await grant(tx, p.memberId, {
          ...base,
          key: `booking:${bookingId}:review`,
          source: "write_review",
          amount: XP.writeReview,
        });
      }
      if (revs.some((r) => r.subjectId === p.memberId && r.rating === 5)) {
        await grant(tx, p.memberId, {
          ...base,
          key: `booking:${bookingId}:five`,
          source: "five_star",
          amount: XP.receiveFiveStar,
        });
      }
      touched.add(p.memberId);
    }
    // Swap cycle: once every session in it has settled, everyone in it gets the cycle bonus.
    if (b.booking.cycleId) {
      const [cycle] = await tx.select().from(swapCycles).where(eq(swapCycles.id, b.booking.cycleId));
      const open = rows<{ n: number }>(
        await tx.execute(
          sql`select count(*)::int as n from bookings where cycle_id = ${b.booking.cycleId} and status <> 'settled'`,
        ),
      )[0].n;
      if (cycle && open === 0) {
        for (const m of cycle.members) {
          await grant(tx, m, {
            key: `cycle:${cycle.id}`,
            source: "cycle",
            amount: XP.cycleComplete,
            occurredAt: at,
            bookingId,
          });
          touched.add(m);
        }
      }
    }
    const changes: (ProgressChange & { memberId: string })[] = [];
    for (const m of touched)
      changes.push({ memberId: m, ...(await refreshProgress(tx, m, `booking:${bookingId}`)) });
    return changes;
  });
}

/** A dispute refund reverses the session's XP; the level may fall but an earned rank stays. */
export async function revokeBooking(db: DB, bookingId: string) {
  return db.transaction(async (tx) => {
    const original = await tx
      .select()
      .from(xpEvents)
      .where(
        and(
          eq(xpEvents.bookingId, bookingId),
          sql`${xpEvents.reversesId} is null`,
          sql`${xpEvents.amount} > 0`,
        ),
      );
    const touched = new Set<string>();
    for (const e of original) {
      await tx
        .insert(xpEvents)
        .values({
          memberId: e.memberId,
          sourceEventId: `reversal:${e.id}`,
          source: "reversal",
          amount: -e.amount,
          requested: -e.amount,
          bookingId,
          reversesId: e.id,
          occurredAt: new Date(),
        })
        .onConflictDoNothing();
      touched.add(e.memberId);
    }
    for (const m of touched) await refreshProgress(tx, m, `reversal:${bookingId}`);
    return touched.size;
  });
}

export async function awardGift(db: DB, memberId: string, amountMin: number, entryId: string) {
  return db.transaction(async (tx) => {
    const amount = Math.floor(amountMin / 30) * XP.giftPer30;
    if (amount > 0)
      await grant(tx, memberId, { key: `gift:${entryId}`, source: "gift", amount, occurredAt: new Date() });
    return refreshProgress(tx, memberId, `gift:${entryId}`);
  });
}

/** "Complete your profile": something to teach, something to learn, availability, and a short bio. */
export async function awardProfileIfComplete(db: DB, memberId: string) {
  const ok = rows<{ ok: boolean }>(
    await db.execute(sql`select
      exists (select 1 from member_skills where member_id = ${memberId} and direction = 'teach')
      and exists (select 1 from member_skills where member_id = ${memberId} and direction = 'learn')
      and exists (select 1 from availability where member_id = ${memberId})
      and (select char_length(bio) >= 10 from members where id = ${memberId}) as ok`),
  )[0]?.ok;
  if (!ok) return null;
  return db.transaction(async (tx) => {
    await grant(tx, memberId, {
      key: "profile",
      source: "profile",
      amount: XP.profileComplete,
      occurredAt: new Date(),
    });
    return refreshProgress(tx, memberId, "profile");
  });
}

// ── Kitty care (needs are server-owned values + timestamps) ─────────────────

async function withNeeds(tx: Tx, memberId: string, fn: (n: Needs) => Needs) {
  const [row] = await tx.select().from(kittyNeeds).where(eq(kittyNeeds.memberId, memberId)).for("update");
  if (!row) throw new DomainError("not_found", "Adopt a kitty first.");
  const now = new Date();
  const next = fn(needsAt(row, row.updatedAt, now));
  await tx
    .update(kittyNeeds)
    .set({ ...next, updatedAt: now })
    .where(eq(kittyNeeds.memberId, memberId));
  return next;
}

export async function feed(db: DB, memberId: string, kind: "kibble" | "treat") {
  return db.transaction(async (tx) => {
    if (kind === "treat") {
      const res = await tx
        .update(memberProgress)
        .set({ treats: sql`${memberProgress.treats} - 1` })
        .where(and(eq(memberProgress.memberId, memberId), sql`${memberProgress.treats} > 0`))
        .returning({ t: memberProgress.treats });
      if (!res.length) throw new DomainError("invalid", "No treats yet. Each settled session earns one.");
    }
    return withNeeds(tx, memberId, (n) =>
      apply(n, kind === "treat" ? { hunger: 0.5, affection: 0.15 } : { hunger: 0.3 }),
    );
  });
}

export async function pet(db: DB, memberId: string) {
  return db.transaction(async (tx) => {
    const needs = await withNeeds(tx, memberId, (n) => apply(n, { affection: 0.25 }));
    const day = new Date().toISOString().slice(0, 10);
    // One XP a day for visiting and petting: at most 7 a week, as the spec caps it.
    const xp = await grant(tx, memberId, {
      key: `pet:${day}`,
      source: "pet",
      amount: XP.pet,
      occurredAt: new Date(),
    });
    const change = xp ? await refreshProgress(tx, memberId, `pet:${day}`) : null;
    return { needs, change };
  });
}

export const play = (db: DB, memberId: string) =>
  db.transaction((tx) =>
    withNeeds(tx, memberId, (n) => apply(n, { play: 0.45, energy: -0.12, affection: 0.05 })),
  );

export async function recordSlowBlink(db: DB, memberId: string) {
  return db.transaction(async (tx) => {
    await ensureProgress(tx, memberId);
    await tx
      .update(memberProgress)
      .set({ slowBlinks: sql`${memberProgress.slowBlinks} + 1` })
      .where(eq(memberProgress.memberId, memberId));
    await withNeeds(tx, memberId, (n) => apply(n, { affection: 0.08 })).catch(() => null);
    return refreshProgress(tx, memberId, null);
  });
}

export async function recordSkillVisit(db: DB, memberId: string, skillId: string) {
  const res = await db.insert(skillVisits).values({ memberId, skillId }).onConflictDoNothing().returning();
  if (res.length) await db.transaction((tx) => refreshProgress(tx, memberId, null));
}

// ── Wardrobe & settings ─────────────────────────────────────────────────────

export async function saveWardrobe(
  db: DB,
  memberId: string,
  selection: Partial<Record<Slot, string | null>>,
  roomTheme?: "cozy" | "twilight",
) {
  return db.transaction(async (tx) => {
    const [prog] = await tx.select().from(memberProgress).where(eq(memberProgress.memberId, memberId));
    const open = slotsOpen((prog?.rank ?? "kitten") as RankId);
    const owned = new Set(
      (
        await tx
          .select({ id: memberItems.itemId })
          .from(memberItems)
          .where(eq(memberItems.memberId, memberId))
      ).map((r) => r.id),
    );
    for (const [slot, itemId] of Object.entries(selection) as [Slot, string | null][]) {
      if (!itemId) {
        await tx.delete(equipped).where(and(eq(equipped.memberId, memberId), eq(equipped.slot, slot)));
        continue;
      }
      const it = itemById.get(itemId);
      if (!it || it.slot !== slot) throw new DomainError("invalid", "That item doesn't go in that slot.");
      if (!owned.has(itemId)) throw new DomainError("forbidden", `${it.name} isn't unlocked yet.`);
      if (!open.has(slot)) throw new DomainError("policy", `The ${slot} slot opens at a later rank.`);
      await tx
        .insert(equipped)
        .values({ memberId, slot, itemId })
        .onConflictDoUpdate({ target: [equipped.memberId, equipped.slot], set: { itemId } });
    }
    if (roomTheme) {
      if (roomTheme === "twilight" && rankIndex((prog?.rank ?? "kitten") as RankId) < rankIndex("puma")) {
        throw new DomainError("policy", "The Twilight room opens at the Puma rank.");
      }
      await tx.update(kitties).set({ roomTheme }).where(eq(kitties.memberId, memberId));
    }
  });
}

export async function saveSettings(db: DB, memberId: string, patch: Partial<GameSettings>) {
  await ensureProgress(db as unknown as Tx, memberId);
  const [p] = await db
    .select({ s: memberProgress.settings })
    .from(memberProgress)
    .where(eq(memberProgress.memberId, memberId));
  const next = { ...DEFAULT_GAME_SETTINGS, ...(p?.s ?? {}), ...patch };
  await db.update(memberProgress).set({ settings: next }).where(eq(memberProgress.memberId, memberId));
  return next;
}

// ── Reads ──────────────────────────────────────────────────────────────────

export type KittyView = {
  name: string;
  code: string;
  stage: "kitten" | "young" | "adult";
  personality: Personality;
  roomTheme: "cozy" | "twilight";
  equipped: Partial<Record<Slot, string>>;
};

export async function kittyFor(q: Q, memberId: string): Promise<KittyView | null> {
  const [k] = await q.select().from(kitties).where(eq(kitties.memberId, memberId));
  if (!k) return null;
  const eq_ = await q.select().from(equipped).where(eq(equipped.memberId, memberId));
  return {
    name: k.name,
    code: k.genomeCode,
    stage: k.stage,
    personality: k.personality,
    roomTheme: k.roomTheme,
    equipped: Object.fromEntries(eq_.map((e) => [e.slot, e.itemId])),
  };
}

/** Everything the kitty layer, panel and wardrobe need, in one read. */
export async function progressFor(q: Q, memberId: string) {
  await ensureProgress(q, memberId);
  const [[prog], kitty, needsRow, owned, earned, recent] = await Promise.all([
    q.select().from(memberProgress).where(eq(memberProgress.memberId, memberId)),
    kittyFor(q, memberId),
    q.select().from(kittyNeeds).where(eq(kittyNeeds.memberId, memberId)),
    q
      .select({ id: memberItems.itemId, at: memberItems.unlockedAt })
      .from(memberItems)
      .where(eq(memberItems.memberId, memberId)),
    q
      .select({ id: memberAchievements.achievementId, at: memberAchievements.earnedAt })
      .from(memberAchievements)
      .where(eq(memberAchievements.memberId, memberId))
      .orderBy(asc(memberAchievements.earnedAt)),
    q
      .select({
        id: xpEvents.id,
        source: xpEvents.source,
        amount: xpEvents.amount,
        bookingId: xpEvents.bookingId,
        at: xpEvents.createdAt,
      })
      .from(xpEvents)
      .where(eq(xpEvents.memberId, memberId))
      .orderBy(desc(xpEvents.createdAt))
      .limit(12),
  ]);
  const lp = levelProgress(prog.xpTotal);
  const rank = prog.rank as RankId;
  const nr = nextRank(rank);
  return {
    xp: prog.xpTotal,
    level: lp.level,
    levelStart: lp.start,
    levelNext: lp.next,
    levelFraction: lp.fraction,
    rank,
    rankName: rankName(rank),
    nextRank: nr ? { id: nr.id, name: nr.name, level: nr.level, condition: nr.condition } : null,
    slots: [...slotsOpen(rank)],
    treats: prog.treats,
    slowBlinks: prog.slowBlinks,
    settings: { ...DEFAULT_GAME_SETTINGS, ...prog.settings },
    kitty,
    needs: needsRow[0] ? needsAt(needsRow[0], needsRow[0].updatedAt) : null,
    items: owned.map((o) => o.id),
    achievements: earned.map((a) => ({
      id: a.id,
      name: achievementById.get(a.id)?.name ?? a.id,
      at: a.at.toISOString(),
    })),
    recent: recent.map((r) => ({ ...r, at: r.at.toISOString() })),
  };
}

export type Progress = Awaited<ReturnType<typeof progressFor>>;

/** What other members may see: the kitty in its outfit, and rank and badges if the owner shows them. */
export async function publicProfileGame(q: Q, memberId: string) {
  const [[prog], kitty, earned] = await Promise.all([
    q.select().from(memberProgress).where(eq(memberProgress.memberId, memberId)),
    kittyFor(q, memberId),
    q
      .select({ id: memberAchievements.achievementId })
      .from(memberAchievements)
      .where(eq(memberAchievements.memberId, memberId))
      .orderBy(asc(memberAchievements.earnedAt)),
  ]);
  const settings = { ...DEFAULT_GAME_SETTINGS, ...(prog?.settings ?? {}) };
  const xp = prog?.xpTotal ?? 0;
  const lp = levelProgress(xp);
  return {
    kitty,
    showRank: settings.showRank,
    rank: (prog?.rank ?? "kitten") as RankId,
    rankName: rankName((prog?.rank ?? "kitten") as RankId),
    level: lp.level,
    levelFraction: lp.fraction,
    xp,
    badges: settings.showRank
      ? earned.map((e) => ({ id: e.id, name: achievementById.get(e.id)?.name ?? e.id }))
      : [],
  };
}

/** XP earned from one booking, for the line under a settled session ("+20 XP · Miso got a treat"). */
export async function xpForBooking(q: Q, memberId: string, bookingId: string) {
  const list = await q
    .select({ source: xpEvents.source, amount: xpEvents.amount })
    .from(xpEvents)
    .where(and(eq(xpEvents.memberId, memberId), eq(xpEvents.bookingId, bookingId)));
  return { total: list.reduce((a, e) => a + e.amount, 0), sources: list };
}

export { RANKS };
