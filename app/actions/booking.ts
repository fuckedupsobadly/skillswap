"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import {
  acceptBooking,
  cancelBooking,
  confirmBooking,
  declineBooking,
  openDispute,
  postMessage,
  reportNoShow,
  requestBooking,
  startBooking,
} from "@/modules/booking/service";
import { LIMITS, run } from "../_lib/run";

const signed = z.object({
  payload: z
    .object({ action: z.string(), ts: z.number() })
    .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  signature: z.string().min(40).max(200),
});

export async function bookSession(input: {
  offerId: string;
  startsAt: string;
  lengthMin: number;
  requestId?: string | null;
}) {
  const schema = z.object({
    offerId: z.uuid(),
    startsAt: z.iso.datetime(),
    lengthMin: z.number().int().min(15).max(180),
    requestId: z.uuid().nullish(),
  });
  return run("book", schema, input, LIMITS.booking, async ({ db, viewer, input }) => {
    const id = await requestBooking(db, viewer, { ...input, startsAt: new Date(input.startsAt) });
    return { id };
  });
}

const idOnly = z.object({ bookingId: z.uuid() });
const transitionAction = (name: string, fn: typeof acceptBooking) => async (input: { bookingId: string }) =>
  run(name, idOnly, input, LIMITS.booking, async ({ db, viewer, input }) => {
    const next = await fn(db, viewer, input.bookingId);
    refresh();
    return { status: next };
  });

export const accept = transitionAction("accept", acceptBooking);
export const decline = transitionAction("decline", declineBooking);
export const cancel = transitionAction("cancel", cancelBooking);
export const start = transitionAction("start", startBooking);
export const noShow = transitionAction("no-show", reportNoShow);
export const dispute = transitionAction("dispute", openDispute);

/** Confirming moves hours, so it carries a fresh device signature over {action, bookingId, ts}. */
export async function confirm(
  input: { bookingId: string; rating: number; review: string } & z.infer<typeof signed>,
) {
  const schema = signed.extend({
    bookingId: z.uuid(),
    rating: z.number().int().min(1).max(5),
    review: z.string().max(500),
  });
  return run("confirm", schema, input, LIMITS.booking, async ({ db, viewer, input }) => {
    const next = await confirmBooking(db, viewer, {
      bookingId: input.bookingId,
      payload: input.payload as never,
      signature: input.signature,
      rating: input.rating,
      review: input.review,
    });
    refresh();
    return { status: next };
  });
}

export async function sendMessage(input: { bookingId: string; body: string }) {
  return run(
    "message",
    z.object({ bookingId: z.uuid(), body: z.string().trim().min(1).max(2000) }),
    input,
    { max: 20, windowS: 60 },
    async ({ db, viewer, input }) => {
      await db.transaction((tx) => postMessage(tx, viewer.memberId, input.bookingId, input.body));
      refresh();
      return true;
    },
  );
}
