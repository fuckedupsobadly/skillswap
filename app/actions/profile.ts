"use server";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { members } from "@/db/schema";
import { isValidTimezone } from "@/modules/identity/service";
import { setAvailability, setSkills, updateProfile } from "@/modules/market/service";
import { emit } from "@/modules/platform/outbox";
import { LIMITS, run } from "../_lib/run";

const pick = z.object({ skillId: z.uuid(), level: z.number().int().min(1).max(5) });
const rule = z.object({
  weekday: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
});

const onboardingSchema = z.object({
  teach: z.array(pick).max(8),
  learn: z.array(pick).max(8),
  availability: z.array(rule).max(28),
});

export async function completeOnboarding(input: z.infer<typeof onboardingSchema>) {
  return run("onboarding", onboardingSchema, input, LIMITS.write, async ({ db, viewer, input }) => {
    await db.transaction(async (tx) => {
      await setSkills(tx, viewer.memberId, input.teach, input.learn);
      await setAvailability(tx, viewer.memberId, input.availability, viewer.member.timezone);
      await tx.update(members).set({ onboardedAt: new Date() }).where(eq(members.id, viewer.memberId));
      await emit(tx, "profile.updated", { memberId: viewer.memberId });
    });
    refresh();
    return true;
  });
}

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Name is too short").max(40),
  bio: z.string().trim().max(280),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  languages: z.array(z.string().trim().min(1).max(30)).max(8),
});

export async function saveProfile(input: z.infer<typeof profileSchema>) {
  return run("profile", profileSchema, input, LIMITS.write, async ({ db, viewer, input }) => {
    await db.transaction(async (tx) => {
      await updateProfile(tx, viewer.memberId, input);
      await emit(tx, "profile.updated", { memberId: viewer.memberId });
    });
    refresh();
    return true;
  });
}

export async function saveSkills(input: { teach: z.infer<typeof pick>[]; learn: z.infer<typeof pick>[] }) {
  return run(
    "skills",
    z.object({ teach: z.array(pick).max(8), learn: z.array(pick).max(8) }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await db.transaction(async (tx) => {
        await setSkills(tx, viewer.memberId, input.teach, input.learn);
        await emit(tx, "profile.updated", { memberId: viewer.memberId });
      });
      refresh();
      return true;
    },
  );
}

export async function saveAvailability(input: { rules: z.infer<typeof rule>[] }) {
  return run(
    "availability",
    z.object({ rules: z.array(rule).max(28) }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await db.transaction(async (tx) => {
        await setAvailability(tx, viewer.memberId, input.rules, viewer.member.timezone);
        await emit(tx, "profile.updated", { memberId: viewer.memberId });
      });
      refresh();
      return true;
    },
  );
}
