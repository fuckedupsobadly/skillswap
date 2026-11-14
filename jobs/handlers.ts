import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { bookingParticipants, bookings, botKeys, members, swapCycles } from "@/db/schema";
import { acceptBooking, confirmBooking } from "@/modules/booking/service";
import { awardGift, awardProfileIfComplete, awardSettledBooking } from "@/modules/game/service";
import { botSign } from "@/modules/identity/service";
import { acceptCycleVerified } from "@/modules/matching/service";
import { DomainError } from "@/modules/platform/errors";
import type { Events, Topic } from "@/modules/platform/outbox";

/**
 * Event handlers. In production Inngest invokes them (with retries); locally the relay calls them in-process.
 * All are idempotent: they re-read state and do nothing if it has already moved on.
 *
 * The sample bot: seeded members are labelled "Sample" everywhere. They accept requests, accept cycles and
 * confirm finished sessions automatically — through the same domain functions, signing with their own keys —
 * so a judge can run the whole loop alone.
 */
type Handler<T extends Topic> = (db: DB, payload: Events[T]) => Promise<void>;

const isSample = async (db: DB, id: string) =>
  Boolean((await db.select({ s: members.isSample }).from(members).where(eq(members.id, id)))[0]?.s);

const ignoreConflicts = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
    // Expected when state already moved on (e.g. the member cancelled first) — but never silent.
    console.warn(`[sample-bot] skipped: ${e.code} — ${e.message}`);
  }
};

const onBookingRequested: Handler<"booking.requested"> = async (db, { bookingId }) => {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (b?.status !== "requested" || !(await isSample(db, b.teacherId))) return;
  const [bot] = await db.select().from(botKeys).where(eq(botKeys.memberId, b.teacherId));
  if (!bot) return;
  await ignoreConflicts(() =>
    acceptBooking(db, { memberId: b.teacherId, deviceId: bot.deviceId, signerKey: "sample-bot" }, bookingId),
  );
};

const onBookingConfirmed: Handler<"booking.confirmed"> = async (db, { bookingId, memberId }) => {
  const parts = await db
    .select()
    .from(bookingParticipants)
    .where(eq(bookingParticipants.bookingId, bookingId));
  const other = parts.find((p) => p.memberId !== memberId);
  if (!other || other.confirmedAt || !(await isSample(db, other.memberId))) return;
  const payload = { action: "confirm_session" as const, bookingId, ts: Date.now() };
  const signed = await botSign(db, other.memberId, payload);
  await ignoreConflicts(() =>
    confirmBooking(
      db,
      { memberId: other.memberId, deviceId: signed.deviceId },
      {
        bookingId,
        payload,
        signature: signed.signature,
        rating: 5,
        review: "Thanks for the session! (automatic review from a sample member)",
      },
    ),
  );
};

const onCycleProposed: Handler<"cycle.proposed"> = async (db, { cycleId }) => {
  const [c] = await db.select().from(swapCycles).where(eq(swapCycles.id, cycleId));
  if (c?.status !== "proposed") return;
  for (const id of c.members) {
    if (c.acceptedBy.includes(id) || !(await isSample(db, id))) continue;
    await ignoreConflicts(() => acceptCycleVerified(db, id, cycleId, "sample-bot"));
  }
};

const noop = async () => {};

export const handlers: { [T in Topic]: Handler<T> } = {
  "member.joined": noop,
  "booking.requested": onBookingRequested,
  "booking.accepted": noop,
  "booking.started": noop,
  "booking.confirmed": onBookingConfirmed,
  // Gamification listens to domain events and never touches the hour ledger.
  "booking.settled": async (db, { bookingId }) => {
    await awardSettledBooking(db, bookingId);
  },
  "booking.closed": noop,
  "cycle.proposed": onCycleProposed,
  "cycle.booked": noop,
  "request.created": noop,
  "message.sent": noop,
  "hours.gifted": async (db, e) => {
    if (e.toCommunity) await awardGift(db, e.memberId, e.amountMin, e.entryId);
  },
  "profile.updated": async (db, { memberId }) => {
    await awardProfileIfComplete(db, memberId);
  },
};

export async function dispatch(db: DB, topic: Topic, payload: unknown) {
  const h = handlers[topic] as Handler<Topic> | undefined;
  if (h) await h(db, payload as Events[Topic]);
}
