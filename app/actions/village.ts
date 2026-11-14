"use server";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { villagers } from "@/db/schema";
import { emit } from "@/modules/platform/outbox";
import {
  ensureVillager,
  leaveNote,
  markRead,
  requestFromPool,
  saveHut,
  saveLook,
  setStatus,
} from "@/modules/village/service";
import { LIMITS, run } from "../_lib/run";

const look = z.object({
  body: z.number().int().min(0).max(2),
  skin: z.number().int().min(0).max(7),
  hair: z.number().int().min(0).max(15),
  hairColor: z.number().int().min(0).max(9),
  eyes: z.number().int().min(0).max(5),
  brows: z.number().int().min(0).max(3),
  top: z.number().int().min(0).max(11),
  topColor: z.number().int().min(0).max(9),
  bottom: z.number().int().min(0).max(7),
  bottomColor: z.number().int().min(0).max(9),
  shoes: z.number().int().min(0).max(5),
  accessory: z.enum(["none", "glasses", "scarf", "hat", "bag"]),
});

/** Free now / Busy / Away, plus the line quoted in your dialogue box. "Light the lantern" = Free now. */
export async function setPresence(input: { status: "free" | "busy" | "away"; statusLine?: string }) {
  return run(
    "presence",
    z.object({ status: z.enum(["free", "busy", "away"]), statusLine: z.string().max(80).optional() }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await setStatus(db, viewer.memberId, input.status, input.statusLine);
      refresh();
      return input.status;
    },
  );
}

export async function saveVillager(input: { look: z.infer<typeof look>; name?: string }) {
  return run(
    "villager",
    z.object({ look, name: z.string().trim().min(2).max(24).optional() }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await ensureVillager(db, viewer.memberId);
      await saveLook(db, viewer.memberId, input.look);
      if (input.name) {
        const { members } = await import("@/db/schema");
        await db.update(members).set({ displayName: input.name }).where(eq(members.id, viewer.memberId));
      }
      refresh();
      return true;
    },
  );
}

export async function saveHutLook(input: { roof: 0 | 1 | 2; door: number; garden: number; sign: number }) {
  const schema = z.object({
    roof: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    door: z.number().int().min(0).max(5),
    garden: z.number().int().min(0).max(5),
    sign: z.number().int().min(0).max(2),
  });
  return run("hut", schema, input, LIMITS.write, async ({ db, viewer, input }) => {
    await ensureVillager(db, viewer.memberId);
    await saveHut(db, viewer.memberId, input);
    refresh();
    return true;
  });
}

export async function sendNote(input: { to: string; body: string }) {
  return run(
    "note",
    z.object({
      to: z.string().min(1).max(64),
      body: z.string().trim().min(1, "Write something first.").max(500),
    }),
    input,
    { max: 10, windowS: 60 },
    async ({ db, viewer, input }) => {
      await leaveNote(db, viewer.memberId, input.to, input.body);
      return true;
    },
  );
}

export async function readInbox() {
  return run("inbox-read", z.object({}), {}, LIMITS.write, async ({ db, viewer }) => {
    await markRead(db, viewer.memberId);
    refresh();
    return true;
  });
}

export async function askPool() {
  return run("pool", z.object({}), {}, { max: 3, windowS: 60 }, async ({ db, viewer }) => {
    await requestFromPool(db, viewer.memberId);
    refresh();
    return true;
  });
}

/** Plain mode: the same features as standard pages, no walking. Remembered per member and per device. */
export async function setPlainMode(input: { on: boolean }) {
  return run("plain", z.object({ on: z.boolean() }), input, LIMITS.write, async ({ db, viewer, input }) => {
    await ensureVillager(db, viewer.memberId);
    await db.update(villagers).set({ plainMode: input.on }).where(eq(villagers.memberId, viewer.memberId));
    (await cookies()).set("ss_plain", input.on ? "1" : "0", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return input.on;
  });
}

export async function setHideMe(input: { on: boolean }) {
  return run("hide-me", z.object({ on: z.boolean() }), input, LIMITS.write, async ({ db, viewer, input }) => {
    await ensureVillager(db, viewer.memberId);
    await db.update(villagers).set({ hideMe: input.on }).where(eq(villagers.memberId, viewer.memberId));
    refresh();
    return input.on;
  });
}

/** Onboarding (§11): seven steps, every one skippable. */
export async function setOnboardingStep(input: { step: number }) {
  return run(
    "onboarding-step",
    z.object({ step: z.number().int().min(1).max(99) }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await ensureVillager(db, viewer.memberId);
      await db
        .update(villagers)
        .set({ onboardingStep: input.step })
        .where(eq(villagers.memberId, viewer.memberId));
      if (input.step >= 99)
        await db.transaction((tx) => emit(tx, "profile.updated", { memberId: viewer.memberId }));
      return input.step;
    },
  );
}
