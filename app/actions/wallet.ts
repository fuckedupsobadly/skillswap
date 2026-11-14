"use server";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { members } from "@/db/schema";
import { verifyAction } from "@/modules/identity/service";
import { gift } from "@/modules/ledger/service";
import { DomainError } from "@/modules/platform/errors";
import { emit } from "@/modules/platform/outbox";
import { LIMITS, run } from "../_lib/run";

const giftSchema = z.object({
  to: z.string().trim().min(1).max(60),
  amountMin: z.number().int().min(5, "Gift at least 5 min").max(600),
  payload: z.record(z.string(), z.unknown()),
  signature: z.string().min(40).max(200),
});

/** Gifting moves hours, so the device signs {action: gift_hours, to, amountMin, ts}. */
export async function giftHours(input: z.infer<typeof giftSchema>) {
  return run("gift", giftSchema, input, LIMITS.booking, async ({ db, viewer, input }) => {
    const proof = await verifyAction(
      db,
      viewer.deviceId,
      viewer.memberId,
      input.payload as never,
      input.signature,
      {
        action: "gift_hours",
        to: input.to,
        amountMin: input.amountMin,
      },
    );
    await db.transaction(async (tx) => {
      if (input.to === "community") {
        const [entry] = await gift(tx, {
          fromMember: viewer.memberId,
          to: "community",
          amountMin: input.amountMin,
          signerKey: proof.signerKey,
          memo: "Gift to the community pool",
        });
        await emit(tx, "hours.gifted", {
          memberId: viewer.memberId,
          amountMin: input.amountMin,
          entryId: entry.id,
          toCommunity: true,
        });
        return;
      }
      const [target] = await tx
        .select()
        .from(members)
        .where(eq(members.handle, input.to.replace(/^@/, "")));
      if (!target || target.deletedAt) throw new DomainError("not_found", "No member with that handle.");
      if (target.id === viewer.memberId)
        throw new DomainError("invalid", "You can't gift hours to yourself.");
      await gift(tx, {
        fromMember: viewer.memberId,
        to: { member: target.id },
        amountMin: input.amountMin,
        signerKey: proof.signerKey,
        memo: `Gift to @${target.handle}`,
      });
    });
    refresh();
    return true;
  });
}
