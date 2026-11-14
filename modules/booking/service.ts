import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { DB, Q, Tx } from "@/db/client";
import { rows } from "@/db/client";
import {
  bookingParticipants,
  bookings,
  categories,
  ledgerEntries,
  members,
  messages,
  offers,
  skills,
  threads,
} from "@/db/schema";
import type { SignedAction } from "@/modules/identity/keys";
import { verifyAction } from "@/modules/identity/service";
import { penalty, placeHold, releaseHold, settleHold } from "@/modules/ledger/service";
import { availabilityOf } from "@/modules/market/service";
import { DomainError } from "@/modules/platform/errors";
import { emit } from "@/modules/platform/outbox";
import { openBookingLimit, WEEKLY_PAIR_CAP_MIN } from "@/modules/trust/reputation";
import { isBlocked, leaveReview, recomputeTrust } from "@/modules/trust/service";
import {
  AUTO_SETTLE_HOURS,
  type BookingEvent,
  type BookingStatus,
  type Effect,
  OPEN,
  type Role,
  TransitionError,
  transition,
} from "./machine";
import { anytime, sharedFreeTime, slotStarts } from "./slots";

export type Actor = { memberId: string; deviceId: string };
export type Ctx = { now?: Date };
const nowOf = (ctx?: Ctx) => ctx?.now ?? new Date();
const MIN = 60_000;

const jitsiDomain = () => process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si";
const roomUrl = (id: string) =>
  `https://${jitsiDomain()}/SkillSwap-${id.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`;

// ── Creating a booking ───────────────────────────────────────────────────────

export async function memberRules(q: Q, memberId: string) {
  const [m] = await q.select({ tz: members.timezone }).from(members).where(eq(members.id, memberId));
  const rules = await availabilityOf(q, memberId);
  return rules.length ? rules : anytime(m?.tz ?? "UTC");
}

/** Bookable starts for this teacher × learner pair over the next week, in UTC. */
export async function bookableSlots(
  q: Q,
  teacherId: string,
  learnerId: string,
  lengthMin: number,
  ctx?: Ctx,
) {
  const now = nowOf(ctx);
  const [a, b] = await Promise.all([memberRules(q, teacherId), memberRules(q, learnerId)]);
  return slotStarts(sharedFreeTime(a, b, now, 7), lengthMin, now);
}

type NewBooking = {
  offerId: string;
  learnerId: string;
  startsAt: Date;
  lengthMin: number;
  requestId?: string | null;
  cycleId?: string | null;
  status?: "requested" | "accepted";
  signerKey: string;
  floorCreditMin?: number;
};

/** Inside a transaction: validate, create the booking and its participants, and hold the learner's hours. */
export async function createBooking(tx: Tx, b: NewBooking, ctx?: Ctx) {
  const now = nowOf(ctx);
  const [offer] = await tx
    .select({ offer: offers, rules: categories.rules, skillName: skills.name })
    .from(offers)
    .innerJoin(skills, eq(skills.id, offers.skillId))
    .innerJoin(categories, eq(categories.id, skills.categoryId))
    .where(eq(offers.id, b.offerId));
  if (!offer?.offer.active) throw new DomainError("not_found", "This offer is no longer available.");
  const teacherId = offer.offer.memberId;
  if (teacherId === b.learnerId) throw new DomainError("invalid", "You can't book yourself.");
  if (!offer.offer.lengths.includes(b.lengthMin))
    throw new DomainError("invalid", "Pick one of the offered lengths.");
  if (!offer.rules.formats.includes("live"))
    throw new DomainError("policy", "This category runs in person only.");
  if (await isBlocked(tx, teacherId, b.learnerId))
    throw new DomainError("forbidden", "You can't book this member.");
  if (b.startsAt.getTime() < now.getTime() - 5 * MIN)
    throw new DomainError("invalid", "That time has passed.");

  const [learner] = await tx.select().from(members).where(eq(members.id, b.learnerId));
  const open = rows<{ n: number }>(
    await tx.execute(sql`
      select count(*)::int as n from booking_participants bp join bookings bk on bk.id = bp.booking_id
      where bp.member_id = ${b.learnerId} and bp.role = 'learner' and bk.status in ('requested','accepted','live','confirming')
    `),
  )[0].n;
  if (!b.cycleId && open >= openBookingLimit(learner.trustLevel)) {
    throw new DomainError(
      "policy",
      `At trust level ${learner.trustLevel} you can have ${openBookingLimit(learner.trustLevel)} open bookings as a learner.`,
    );
  }
  // Collusion check: cap hours earned from the same counterpart per week.
  const earned = rows<{ m: number }>(
    await tx.execute(sql`
      select coalesce(sum(b.length_min), 0)::int as m from bookings b
      join booking_participants l on l.booking_id = b.id and l.role = 'learner' and l.member_id = ${b.learnerId}
      where b.teacher_id = ${teacherId} and b.status in ('requested','accepted','live','confirming','settled')
        and b.starts_at > ${new Date(now.getTime() - 7 * 24 * 60 * MIN)}
    `),
  )[0].m;
  if (earned + b.lengthMin > WEEKLY_PAIR_CAP_MIN) {
    throw new DomainError(
      "policy",
      "Weekly limit reached with this teacher (5 h). Try someone else this week.",
    );
  }
  if (!b.cycleId) {
    // The whole session must fit inside time both members marked free, on a 5-minute boundary.
    const [ta, la] = await Promise.all([memberRules(tx, teacherId), memberRules(tx, b.learnerId)]);
    const start = b.startsAt.getTime();
    const end = start + b.lengthMin * MIN;
    const shared = sharedFreeTime(ta, la, new Date(start - MIN), 1);
    if (start % (5 * MIN) !== 0 || !shared.some((iv) => iv.start <= start && iv.end >= end)) {
      throw new DomainError("invalid", "That slot isn't free for both of you.");
    }
  }

  const [created] = await tx
    .insert(bookings)
    .values({
      kind: "live",
      skillId: offer.offer.skillId,
      offerId: offer.offer.id,
      requestId: b.requestId ?? null,
      cycleId: b.cycleId ?? null,
      teacherId,
      startsAt: b.startsAt,
      lengthMin: b.lengthMin,
      status: b.status ?? "requested",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await tx
    .update(bookings)
    .set({ roomUrl: roomUrl(created.id) })
    .where(eq(bookings.id, created.id));
  await tx.insert(bookingParticipants).values([
    { bookingId: created.id, memberId: teacherId, role: "teacher", costMin: 0 },
    { bookingId: created.id, memberId: b.learnerId, role: "learner", costMin: b.lengthMin },
  ]);
  await placeHold(tx, {
    memberId: b.learnerId,
    bookingId: created.id,
    amountMin: b.lengthMin,
    expiresAt: b.startsAt,
    signerKey: b.signerKey,
    memo: `${offer.skillName} · hold`,
    floorCreditMin: b.floorCreditMin,
  });
  await tx.insert(threads).values({ contextType: "booking", contextId: created.id }).onConflictDoNothing();
  await emit(tx, b.status === "accepted" ? "booking.accepted" : "booking.requested", {
    bookingId: created.id,
  });
  return created.id;
}

export async function requestBooking(
  db: DB,
  actor: Actor & { signerKey: string },
  input: { offerId: string; startsAt: Date; lengthMin: number; requestId?: string | null },
  ctx?: Ctx,
) {
  return db.transaction((tx) =>
    createBooking(tx, { ...input, learnerId: actor.memberId, signerKey: actor.signerKey }, ctx),
  );
}

// ── Moving through the state machine ─────────────────────────────────────────

type Loaded = {
  booking: typeof bookings.$inferSelect;
  teacher: typeof bookingParticipants.$inferSelect;
  learner: typeof bookingParticipants.$inferSelect;
};

async function lockBooking(tx: Tx, bookingId: string): Promise<Loaded> {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new DomainError("not_found", "Session not found.");
  const parts = await tx
    .select()
    .from(bookingParticipants)
    .where(eq(bookingParticipants.bookingId, bookingId));
  const teacher = parts.find((p) => p.role === "teacher");
  const learner = parts.find((p) => p.role === "learner");
  if (!teacher || !learner) throw new DomainError("conflict", "Session has no participants.");
  return { booking, teacher, learner };
}

function roleOf(l: Loaded, memberId: string): Role {
  if (l.teacher.memberId === memberId) return "teacher";
  if (l.learner.memberId === memberId) return "learner";
  throw new DomainError("forbidden", "Not your session.");
}

function step(status: BookingStatus, ev: BookingEvent) {
  try {
    return transition(status, ev);
  } catch (e) {
    if (e instanceof TransitionError) throw new DomainError("conflict", e.message);
    throw e;
  }
}

/** Turn machine effects into ledger movements. Fractions of the hold / length are rounded to whole minutes. */
async function applyEffects(tx: Tx, l: Loaded, effects: Effect[], signerKey: string, memo: string) {
  const base = {
    bookingId: l.booking.id,
    learnerId: l.learner.memberId,
    teacherId: l.teacher.memberId,
    signerKey,
  };
  for (const fx of effects) {
    if (fx.type === "release") await releaseHold(tx, { ...base, memo: `${memo} · released` });
    if (fx.type === "capture") {
      await settleHold(tx, { ...base, captureMin: Math.round(l.learner.costMin * fx.fraction), memo });
    }
    if (fx.type === "penalty") {
      const payer = fx.payer === "teacher" ? l.teacher.memberId : l.learner.memberId;
      const payee = fx.payer === "teacher" ? l.learner.memberId : l.teacher.memberId;
      await penalty(tx, {
        fromMember: payer,
        toMember: payee,
        amountMin: Math.round(l.booking.lengthMin * fx.fraction),
        bookingId: l.booking.id,
        signerKey,
        memo: `${memo} · penalty`,
      });
    }
  }
}

async function finish(
  tx: Tx,
  l: Loaded,
  next: BookingStatus,
  patch: Partial<typeof bookings.$inferInsert>,
  now: Date,
) {
  await tx
    .update(bookings)
    .set({ ...patch, status: next, updatedAt: now })
    .where(eq(bookings.id, l.booking.id));
}

async function simpleTransition(
  db: DB,
  bookingId: string,
  memberId: string,
  signerKey: string,
  build: (l: Loaded, role: Role, now: Date) => BookingEvent,
  memo: string,
  ctx?: Ctx,
) {
  const now = nowOf(ctx);
  return db.transaction(async (tx) => {
    const l = await lockBooking(tx, bookingId);
    const role = roleOf(l, memberId);
    const { next, effects } = step(l.booking.status, build(l, role, now));
    await applyEffects(tx, l, effects, signerKey, memo);
    const patch: Partial<typeof bookings.$inferInsert> = {};
    if (next === "live") patch.startedAt = now;
    if (next !== "accepted" && next !== "live") patch.closedBy = memberId;
    await finish(tx, l, next, patch, now);
    if (next === "accepted") await emit(tx, "booking.accepted", { bookingId });
    else if (next === "live") await emit(tx, "booking.started", { bookingId });
    else await emit(tx, "booking.closed", { bookingId, status: next });
    return next;
  });
}

const minutesUntil = (d: Date, now: Date) => (d.getTime() - now.getTime()) / MIN;

export const acceptBooking = (db: DB, a: Actor & { signerKey: string }, id: string, ctx?: Ctx) =>
  simpleTransition(db, id, a.memberId, a.signerKey, (_l, by) => ({ type: "accept", by }), "Accepted", ctx);

export const declineBooking = (db: DB, a: Actor & { signerKey: string }, id: string, ctx?: Ctx) =>
  simpleTransition(db, id, a.memberId, a.signerKey, (_l, by) => ({ type: "decline", by }), "Declined", ctx);

export const cancelBooking = (db: DB, a: Actor & { signerKey: string }, id: string, ctx?: Ctx) =>
  simpleTransition(
    db,
    id,
    a.memberId,
    a.signerKey,
    (l, by, now) => ({ type: "cancel", by, minutesToStart: minutesUntil(l.booking.startsAt, now) }),
    "Cancelled",
    ctx,
  );

export const startBooking = (db: DB, a: Actor & { signerKey: string }, id: string, ctx?: Ctx) =>
  simpleTransition(
    db,
    id,
    a.memberId,
    a.signerKey,
    (l, by, now) => ({ type: "start", by, minutesToStart: minutesUntil(l.booking.startsAt, now) }),
    "Started",
    ctx,
  );

export const reportNoShow = (db: DB, a: Actor & { signerKey: string }, id: string, ctx?: Ctx) =>
  simpleTransition(
    db,
    id,
    a.memberId,
    a.signerKey,
    (l, by, now) => ({
      type: "report_no_show",
      by,
      minutesSinceStart: -minutesUntil(l.booking.startsAt, now),
    }),
    "No-show",
    ctx,
  );

export const openDispute = (db: DB, a: Actor & { signerKey: string }, id: string, ctx?: Ctx) =>
  simpleTransition(db, id, a.memberId, a.signerKey, (_l, by) => ({ type: "dispute", by }), "Disputed", ctx);

/**
 * Both sides confirm. Each confirmation carries a device signature over
 * {action: "confirm_session", bookingId, ts}; the second confirmation captures the hold for the teacher.
 */
export async function confirmBooking(
  db: DB,
  actor: Actor,
  input: { bookingId: string; payload: SignedAction; signature: string; rating?: number; review?: string },
  ctx?: Ctx,
) {
  const now = nowOf(ctx);
  const proof = await verifyAction(db, actor.deviceId, actor.memberId, input.payload, input.signature, {
    action: "confirm_session",
    bookingId: input.bookingId,
  });
  return db.transaction(async (tx) => {
    const l = await lockBooking(tx, input.bookingId);
    const role = roleOf(l, actor.memberId);
    const self = role === "teacher" ? l.teacher : l.learner;
    const other = role === "teacher" ? l.learner : l.teacher;
    if (self.confirmedAt) throw new DomainError("conflict", "You already confirmed this session.");
    const { next, effects } = step(l.booking.status, {
      type: "confirm",
      by: role,
      otherConfirmed: Boolean(other.confirmedAt),
    });
    await tx
      .update(bookingParticipants)
      .set({
        confirmedAt: now,
        signature: proof.signature,
        signedPayload: proof.message,
        signerKey: proof.signerKey,
      })
      .where(eq(bookingParticipants.id, self.id));
    const [skill] = await tx
      .select({ name: skills.name })
      .from(skills)
      .where(eq(skills.id, l.booking.skillId));
    await applyEffects(
      tx,
      l,
      effects,
      `${proof.signerKey}+${other.signerKey ?? "?"}`,
      `${skill.name} · ${l.booking.lengthMin} min session`,
    );
    await finish(tx, l, next, next === "settled" ? { settledAt: now } : { firstConfirmedAt: now }, now);
    if (input.rating) {
      await leaveReview(tx, {
        bookingId: l.booking.id,
        authorId: actor.memberId,
        subjectId: other.memberId,
        rating: input.rating,
        text: (input.review ?? "").slice(0, 500),
      });
    }
    await emit(tx, "booking.confirmed", { bookingId: l.booking.id, memberId: actor.memberId });
    if (next === "settled") {
      await recomputeTrust(tx, l.teacher.memberId);
      await recomputeTrust(tx, l.learner.memberId);
      await emit(tx, "booking.settled", { bookingId: l.booking.id });
    }
    return next;
  });
}

// ── System sweeps (jobs) ─────────────────────────────────────────────────────

/** One side confirmed, 48 h of silence → settle. Requested past start → expire. Accepted, never started → expire. */
export async function sweepBookings(db: DB, ctx?: Ctx) {
  const now = nowOf(ctx);
  const due = await db
    .select({ id: bookings.id, status: bookings.status })
    .from(bookings)
    .where(
      or(
        and(
          eq(bookings.status, "confirming"),
          lte(bookings.firstConfirmedAt, new Date(now.getTime() - AUTO_SETTLE_HOURS * 60 * MIN)),
        ),
        and(eq(bookings.status, "requested"), lte(bookings.startsAt, now)),
        and(
          eq(bookings.status, "accepted"),
          isNull(bookings.startedAt),
          lte(sql`${bookings.startsAt} + (${bookings.lengthMin} + 60) * interval '1 minute'`, now),
        ),
      ),
    )
    .limit(200);
  let settled = 0;
  let expired = 0;
  for (const d of due) {
    try {
      await db.transaction(async (tx) => {
        const l = await lockBooking(tx, d.id);
        const ev: BookingEvent =
          l.booking.status === "confirming"
            ? {
                type: "auto_settle",
                hoursSinceFirstConfirm:
                  (now.getTime() - (l.booking.firstConfirmedAt?.getTime() ?? 0)) / 3_600_000,
              }
            : { type: "expire" };
        const { next, effects } = step(l.booking.status, ev);
        await applyEffects(
          tx,
          l,
          effects,
          "system",
          next === "settled" ? "Auto-settled after 48 h" : "Expired",
        );
        await finish(tx, l, next, next === "settled" ? { settledAt: now } : {}, now);
        if (next === "settled") {
          await recomputeTrust(tx, l.teacher.memberId);
          await recomputeTrust(tx, l.learner.memberId);
          await emit(tx, "booking.settled", { bookingId: d.id });
          settled++;
        } else {
          await emit(tx, "booking.closed", { bookingId: d.id, status: next });
          expired++;
        }
      });
    } catch (e) {
      if (!(e instanceof DomainError)) throw e; // state moved on concurrently; skip
    }
  }
  return { settled, expired };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function sessionsFor(q: Q, memberId: string) {
  const res = await q.execute(sql`
    select b.id, b.status, b.starts_at as "startsAt", b.length_min as "lengthMin", b.cycle_id as "cycleId",
      s.name as skill, s.slug as "skillSlug", me.role,
      other.display_name as "otherName", other.handle as "otherHandle", other.is_sample as "otherIsSample"
    from booking_participants me
    join bookings b on b.id = me.booking_id
    join skills s on s.id = b.skill_id
    join booking_participants op on op.booking_id = b.id and op.member_id <> me.member_id
    join members other on other.id = op.member_id
    where me.member_id = ${memberId}
    order by b.starts_at desc
    limit 100
  `);
  return rows<{
    id: string;
    status: BookingStatus;
    startsAt: Date;
    lengthMin: number;
    cycleId: string | null;
    skill: string;
    skillSlug: string;
    role: Role;
    otherName: string;
    otherHandle: string;
    otherIsSample: boolean;
  }>(res).map((r) => ({ ...r, startsAt: new Date(r.startsAt) }));
}

export async function sessionDetail(q: Q, bookingId: string, memberId: string) {
  const [b] = await q
    .select({ booking: bookings, skill: skills })
    .from(bookings)
    .innerJoin(skills, eq(skills.id, bookings.skillId))
    .where(eq(bookings.id, bookingId));
  if (!b) return null;
  const parts = await q
    .select({ p: bookingParticipants, m: members })
    .from(bookingParticipants)
    .innerJoin(members, eq(members.id, bookingParticipants.memberId))
    .where(eq(bookingParticipants.bookingId, bookingId));
  const me = parts.find((x) => x.p.memberId === memberId);
  if (!me) return null;
  const other = parts.find((x) => x.p.memberId !== memberId)!;
  const [entries, thread] = await Promise.all([
    q
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.bookingId, bookingId))
      .orderBy(asc(ledgerEntries.seq)),
    q
      .select()
      .from(threads)
      .where(and(eq(threads.contextType, "booking"), eq(threads.contextId, bookingId))),
  ]);
  const msgs = thread[0]
    ? await q
        .select({
          id: messages.id,
          body: messages.body,
          senderId: messages.senderId,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.threadId, thread[0].id))
        .orderBy(asc(messages.createdAt))
        .limit(200)
    : [];
  return { ...b, me, other, entries, threadId: thread[0]?.id ?? null, messages: msgs };
}

export async function nextSessionFor(q: Q, memberId: string, now = new Date()) {
  const [n] = await q
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      status: bookings.status,
      skill: skills.name,
      lengthMin: bookings.lengthMin,
    })
    .from(bookingParticipants)
    .innerJoin(bookings, eq(bookings.id, bookingParticipants.bookingId))
    .innerJoin(skills, eq(skills.id, bookings.skillId))
    .where(
      and(
        eq(bookingParticipants.memberId, memberId),
        inArray(bookings.status, OPEN as BookingStatus[]),
        gte(bookings.startsAt, new Date(now.getTime() - 3 * 60 * MIN)),
      ),
    )
    .orderBy(asc(bookings.startsAt))
    .limit(1);
  return n ?? null;
}

export async function postMessage(tx: Tx, memberId: string, bookingId: string, body: string) {
  const text = body.trim().slice(0, 2000);
  if (!text) throw new DomainError("invalid", "Message is empty.");
  const [part] = await tx
    .select()
    .from(bookingParticipants)
    .where(and(eq(bookingParticipants.bookingId, bookingId), eq(bookingParticipants.memberId, memberId)));
  if (!part) throw new DomainError("forbidden", "Not your session.");
  const [thread] = await tx
    .insert(threads)
    .values({ contextType: "booking", contextId: bookingId })
    .onConflictDoUpdate({ target: [threads.contextType, threads.contextId], set: { contextId: bookingId } })
    .returning();
  const [m] = await tx
    .insert(messages)
    .values({ threadId: thread.id, senderId: memberId, body: text })
    .returning();
  await emit(tx, "message.sent", { threadId: thread.id, messageId: m.id });
  return m.id;
}
