/**
 * Needs, 0 (low) … 1 (content). Stored as a value plus a timestamp and computed on read, so the kitty keeps
 * "living" while its owner is away without any server ticking. The same function runs on client and server.
 * There is no death, sickness or sad face: the lowest state is a sleepy cat that perks up when you return.
 */
export type Needs = { hunger: number; energy: number; play: number; affection: number };
export const NEED_KEYS = ["hunger", "energy", "play", "affection"] as const;

/** Change per hour while nobody is around. Energy recovers: an absent owner means a napping cat. */
const RATE: Needs = { hunger: -0.07, energy: 0.18, play: -0.1, affection: -0.06 };
const FLOOR: Needs = { hunger: 0.05, energy: 0.15, play: 0.05, affection: 0.1 };

const clamp = (v: number, lo: number) => Math.max(lo, Math.min(1, v));

export function needsAt(stored: Needs, updatedAt: Date, now = new Date()): Needs {
  const h = Math.max(0, (now.getTime() - updatedAt.getTime()) / 3_600_000);
  return {
    hunger: clamp(stored.hunger + RATE.hunger * h, FLOOR.hunger),
    energy: clamp(stored.energy + RATE.energy * h, FLOOR.energy),
    play: clamp(stored.play + RATE.play * h, FLOOR.play),
    affection: clamp(stored.affection + RATE.affection * h, FLOOR.affection),
  };
}

export const FULL: Needs = { hunger: 0.8, energy: 0.9, play: 0.7, affection: 0.7 };

export function apply(n: Needs, change: Partial<Needs>): Needs {
  return {
    hunger: clamp(n.hunger + (change.hunger ?? 0), 0),
    energy: clamp(n.energy + (change.energy ?? 0), 0),
    play: clamp(n.play + (change.play ?? 0), 0),
    affection: clamp(n.affection + (change.affection ?? 0), 0),
  };
}

export const NEED_LABEL: Record<keyof Needs, string> = {
  hunger: "Fed",
  energy: "Rested",
  play: "Played",
  affection: "Loved",
};
