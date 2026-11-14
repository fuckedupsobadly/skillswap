"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import {
  adoptKitty,
  feed,
  pet,
  play,
  recordSlowBlink,
  renameKitty,
  saveSettings,
  saveWardrobe,
} from "@/modules/game/service";
import { LIMITS, run } from "../_lib/run";

const SLOTS = ["head", "neck", "charm", "face", "back", "tail", "bed", "room", "toy"] as const;

export async function adopt(input: { choice: number; name: string }) {
  return run(
    "adopt",
    z.object({
      choice: z.number().int().min(0).max(2),
      name: z.string().trim().min(1, "Give your kitty a name").max(16),
    }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await adoptKitty(db, viewer.memberId, input.choice, input.name);
      refresh();
      return true;
    },
  );
}

export async function rename(input: { name: string }) {
  return run(
    "rename",
    z.object({ name: z.string().trim().min(1).max(16) }),
    input,
    LIMITS.write,
    async ({ db, viewer, input }) => {
      await renameKitty(db, viewer.memberId, input.name);
      refresh();
      return true;
    },
  );
}

export async function saveOutfit(input: {
  equipped: Partial<Record<(typeof SLOTS)[number], string | null>>;
  roomTheme?: "cozy" | "twilight";
}) {
  const schema = z.object({
    equipped: z.partialRecord(z.enum(SLOTS), z.string().max(40).nullable()),
    roomTheme: z.enum(["cozy", "twilight"]).optional(),
  });
  return run("wardrobe", schema, input, LIMITS.write, async ({ db, viewer, input }) => {
    await saveWardrobe(db, viewer.memberId, input.equipped, input.roomTheme);
    refresh();
    return true;
  });
}

export async function feedKitty(input: { kind: "kibble" | "treat" }) {
  return run(
    "feed",
    z.object({ kind: z.enum(["kibble", "treat"]) }),
    input,
    { max: 10, windowS: 60 },
    async ({ db, viewer, input }) => feed(db, viewer.memberId, input.kind),
  );
}

export async function petKitty() {
  return run(
    "pet",
    z.object({}),
    {},
    { max: 6, windowS: 60 },
    async ({ db, viewer }) => (await pet(db, viewer.memberId)).needs,
  );
}

export async function playWithKitty() {
  return run("play", z.object({}), {}, { max: 6, windowS: 60 }, async ({ db, viewer }) =>
    play(db, viewer.memberId),
  );
}

export async function slowBlink() {
  return run("slow-blink", z.object({}), {}, { max: 4, windowS: 60 }, async ({ db, viewer }) => {
    await recordSlowBlink(db, viewer.memberId);
    return true;
  });
}

export async function saveGameSettings(input: {
  showKitty?: boolean;
  roam?: boolean;
  sounds?: boolean;
  notices?: boolean;
  showRank?: boolean;
}) {
  const schema = z.object({
    showKitty: z.boolean().optional(),
    roam: z.boolean().optional(),
    sounds: z.boolean().optional(),
    notices: z.boolean().optional(),
    showRank: z.boolean().optional(),
  });
  return run("game-settings", schema, input, LIMITS.write, async ({ db, viewer, input }) => {
    const s = await saveSettings(db, viewer.memberId, input);
    refresh();
    return s;
  });
}
