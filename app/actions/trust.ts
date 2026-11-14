"use server";
import { z } from "zod";
import { block, report } from "@/modules/trust/service";
import { LIMITS, run } from "../_lib/run";

export async function reportMember(input: { subjectId: string; reason: string; bookingId?: string }) {
  const schema = z.object({
    subjectId: z.uuid(),
    reason: z.string().trim().min(5, "Say briefly what happened").max(500),
    bookingId: z.uuid().optional(),
  });
  return run("report", schema, input, { max: 5, windowS: 3600 }, async ({ db, viewer, input }) => {
    await db.transaction((tx) => report(tx, { reporterId: viewer.memberId, ...input }));
    return true;
  });
}

export async function blockMember(input: { subjectId: string }) {
  return run(
    "block",
    z.object({ subjectId: z.uuid() }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await db.transaction((tx) => block(tx, viewer.memberId, input.subjectId));
      return true;
    },
  );
}
