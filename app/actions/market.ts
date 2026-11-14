"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import { parseRequest } from "@/modules/ai/concierge";
import { closeRequest, createRequest } from "@/modules/market/service";
import { proposeCyclesFor } from "@/modules/matching/service";
import { leaveNote, litLanternsFor } from "@/modules/village/service";
import { LIMITS, run } from "../_lib/run";

const requestSchema = z.object({
  skillId: z.uuid(),
  level: z.number().int().min(1).max(5),
  format: z.enum(["live", "group", "in_person", "async"]),
  lengthMin: z
    .number()
    .int()
    .refine((n) => [30, 60, 90, 120].includes(n), "Pick 30, 60, 90 or 120 minutes"),
  text: z.string().max(500),
  confidence: z.number().min(0).max(1),
  parsedBy: z.enum(["ai", "rules", "form"]),
});

/** Posting a request is the member's tap; the concierge only drafted it. Then "Match me" runs on it. */
export async function postRequest(input: z.infer<typeof requestSchema>) {
  return run("request", requestSchema, input, LIMITS.write, async ({ db, viewer, input }) => {
    const id = await db.transaction((tx) => createRequest(tx, viewer.memberId, input));
    const cycles = await proposeCyclesFor(db, viewer.memberId);
    // When a wish finds a match, a note lands in the mailbox (§8.1).
    if (cycles.length)
      await leaveNote(
        db,
        null,
        viewer.memberId,
        "Your wish found a swap. A table is waiting for you in The Swapped Mug.",
        { kind: "match", link: "/tavern" },
      );
    const lit = await litLanternsFor(db, input.skillId, viewer.memberId);
    return { id, lit, swaps: cycles.length };
  });
}

export async function withdrawRequest(input: { requestId: string }) {
  return run(
    "request-close",
    z.object({ requestId: z.uuid() }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await db.transaction((tx) => closeRequest(tx, viewer.memberId, input.requestId));
      refresh();
      return true;
    },
  );
}

export async function parseText(input: { text: string }) {
  return run(
    "parse",
    z.object({ text: z.string().trim().min(2).max(500) }),
    input,
    LIMITS.ai,
    async ({ db, viewer, input }) => parseRequest(db, viewer.memberId, input.text),
  );
}
