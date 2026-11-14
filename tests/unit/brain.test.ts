import { describe, expect, it } from "vitest";
import { activity, type Context, choose, scores } from "@/ui/kitty/brain";

const base: Context = {
  needs: { hunger: 0.8, energy: 0.8, play: 0.7, affection: 0.7 },
  personality: { playful: 0.5, sleepy: 0.5, curious: 0.5, affectionate: 0.5, sassy: 0.5 },
  hour: 19,
  cursorRecent: false,
  cursorNear: false,
  cursorAbove: false,
  cursorIdle: false,
  perchesAvailable: true,
  toyOnPlatform: false,
  onFloor: true,
  reduced: false,
  last: null,
};
const pickRate = (c: Context, b: string, n = 2000) => {
  let k = 0;
  let seed = 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < n; i++) if (choose(c, rand) === b) k++;
  return k / n;
};

describe("kitty brain", () => {
  it("is crepuscular: active at dawn and dusk, sleepy at midday and late at night", () => {
    expect(activity(6.5)).toBeGreaterThan(activity(13));
    expect(activity(19)).toBeGreaterThan(activity(2));
  });
  it("a tired kitty mostly naps; a sleepy personality naps more", () => {
    const tired = { ...base, needs: { ...base.needs, energy: 0.1 }, hour: 13 };
    expect(pickRate(tired, "nap")).toBeGreaterThan(0.5);
    const sleepyCat = { ...base, personality: { ...base.personality, sleepy: 1 } };
    expect(scores(sleepyCat).nap).toBeGreaterThan(scores(base).nap);
  });
  it("a playful kitty hunts a moving cursor; a lonely one seeks it", () => {
    const playful = {
      ...base,
      cursorRecent: true,
      personality: { ...base.personality, playful: 1 },
      needs: { ...base.needs, play: 0.1 },
    };
    expect(pickRate(playful, "hunt")).toBeGreaterThan(0.3);
    const lonely = { ...base, cursorRecent: true, needs: { ...base.needs, affection: 0.1 } };
    expect(scores(lonely).seek).toBeGreaterThan(scores(base).seek);
  });
  it("a hungry kitty waits by the bowl (it never gets sick)", () => {
    expect(pickRate({ ...base, needs: { ...base.needs, hunger: 0.05 } }, "waitBowl")).toBeGreaterThan(0.6);
  });
  it("with reduced motion it never travels", () => {
    const r = { ...base, reduced: true, cursorRecent: true };
    for (const b of ["wander", "explore", "hunt", "seek", "zoomies"]) expect(pickRate(r, b, 300)).toBe(0);
  });
});
