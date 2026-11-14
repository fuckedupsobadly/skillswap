import type { Tx } from "@/db/client";
import { outbox } from "@/db/schema";

/** Every domain event, and the shape of its payload. Jobs and live updates subscribe to these topics. */
export type Events = {
  "member.joined": { memberId: string };
  "booking.requested": { bookingId: string };
  "booking.accepted": { bookingId: string };
  "booking.started": { bookingId: string };
  "booking.confirmed": { bookingId: string; memberId: string };
  "booking.settled": { bookingId: string };
  "booking.closed": { bookingId: string; status: string };
  "cycle.proposed": { cycleId: string };
  "cycle.booked": { cycleId: string };
  "request.created": { requestId: string };
  "message.sent": { threadId: string; messageId: string };
  "hours.gifted": { memberId: string; amountMin: number; entryId: string; toCommunity: boolean };
  "profile.updated": { memberId: string };
};
export type Topic = keyof Events;

/** Written in the same transaction as the change it describes, so an event is never lost or sent for a rollback. */
export async function emit<T extends Topic>(tx: Tx, topic: T, payload: Events[T]) {
  await tx.insert(outbox).values({ topic, payload });
}
