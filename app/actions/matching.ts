"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import { acceptCycle, declineCycle, proposeCyclesFor } from "@/modules/matching/service";
import { LIMITS, run } from "../_lib/run";

export async function matchMe() {
  return run("match-me", z.object({}), {}, { max: 6, windowS: 60 }, async ({ db, viewer }) => {
    const ids = await proposeCyclesFor(db, viewer.memberId);
    refresh();
    return { proposals: ids.length };
  });
}

/** Accepting a cycle will hold hours, so it is signed by the device key like any other sensitive action. */
export async function acceptProposal(input: {
  cycleId: string;
  payload: Record<string, unknown>;
  signature: string;
}) {
  const schema = z.object({
    cycleId: z.uuid(),
    payload: z.record(z.string(), z.unknown()),
    signature: z.string().min(40).max(200),
  });
  return run("cycle-accept", schema, input, LIMITS.booking, async ({ db, viewer, input }) => {
    const r = await acceptCycle(db, viewer, {
      cycleId: input.cycleId,
      payload: input.payload as never,
      signature: input.signature,
    });
    refresh();
    return r;
  });
}

export async function declineProposal(input: { cycleId: string }) {
  return run(
    "cycle-decline",
    z.object({ cycleId: z.uuid() }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await declineCycle(db, viewer.memberId, input.cycleId);
      refresh();
      return true;
    },
  );
}
