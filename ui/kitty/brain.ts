import type { Personality } from "@/modules/game/genome";
import type { Needs } from "@/modules/game/needs";

/**
 * Utility AI. Every few seconds the kitty scores each behaviour from its needs, its personality, the local
 * time and what is happening on the page, then picks one with a little randomness so it never feels scripted.
 * Pure: no DOM, no timers — the engine supplies the context.
 */
export type Behavior =
  | "nap"
  | "loaf"
  | "sit"
  | "groom"
  | "wander"
  | "explore"
  | "hunt"
  | "seek"
  | "zoomies"
  | "chatter"
  | "push"
  | "perchNearCursor"
  | "waitBowl";

export type Context = {
  needs: Needs;
  personality: Personality;
  hour: number;
  cursorRecent: boolean;
  cursorNear: boolean;
  cursorAbove: boolean;
  cursorIdle: boolean;
  perchesAvailable: boolean;
  toyOnPlatform: boolean;
  onFloor: boolean;
  reduced: boolean;
  last: Behavior | null;
};

/** Cats are crepuscular: busy around dawn and dusk, sleepy at midday and late at night. */
export function activity(hour: number) {
  const dawn = Math.exp(-(((hour - 6.5) / 1.6) ** 2));
  const dusk = Math.exp(-(((hour - 19) / 1.8) ** 2));
  return Math.min(1, 0.25 + dawn + dusk);
}

export function scores(c: Context): Record<Behavior, number> {
  const p = c.personality;
  const n = c.needs;
  const act = activity(c.hour);
  const sleepy = 1 - act;
  const s: Record<Behavior, number> = {
    nap: (1 - n.energy) * 1.3 + p.sleepy * 0.55 + sleepy * 0.55,
    loaf: 0.32 + p.sleepy * 0.2 + sleepy * 0.15,
    sit: 0.42,
    groom: 0.22 + (c.last === "nap" || c.last === "zoomies" ? 0.25 : 0),
    wander: (p.curious * 0.45 + n.energy * 0.35) * (0.6 + act * 0.5),
    explore: c.perchesAvailable ? (p.curious * 0.5 + n.energy * 0.3) * (0.6 + act * 0.5) : 0,
    hunt: c.cursorRecent ? (p.playful * 0.7 + (1 - n.play) * 0.65) * n.energy * (0.7 + act * 0.5) : 0,
    seek: c.cursorRecent ? p.affectionate * 0.5 + (1 - n.affection) * 0.75 : 0,
    zoomies: n.energy > 0.6 ? p.playful * 0.32 * act * (1 - n.play + 0.4) : 0,
    chatter: c.cursorAbove && !c.cursorNear ? p.curious * 0.32 : 0,
    push: c.toyOnPlatform ? p.sassy * 0.5 : 0,
    perchNearCursor: c.cursorIdle && c.perchesAvailable ? p.sassy * 0.3 + p.curious * 0.2 : 0,
    waitBowl: n.hunger < 0.22 ? 1.4 - n.hunger * 2 : 0,
  };
  if (c.reduced) {
    // Reduced motion: stay in the corner and change pose slowly.
    for (const k of [
      "wander",
      "explore",
      "hunt",
      "seek",
      "zoomies",
      "chatter",
      "push",
      "perchNearCursor",
    ] as Behavior[])
      s[k] = 0;
    s.waitBowl = 0;
  }
  // Don't repeat the same thing twice in a row unless it really wins.
  if (c.last) s[c.last] *= 0.7;
  return s;
}

/** Weighted pick among the top scorers, so a high score usually wins but not always. */
export function choose(c: Context, rand = Math.random): Behavior {
  const entries = (Object.entries(scores(c)) as [Behavior, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const weights = entries.map(([, v], i) => v ** 3 * (1 + (rand() - 0.5) * 0.5) * (i === 0 ? 1.2 : 1));
  const total = weights.reduce((a, w) => a + w, 0);
  let r = rand() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r <= 0) return entries[i][0];
  }
  return entries[0]?.[0] ?? "sit";
}
