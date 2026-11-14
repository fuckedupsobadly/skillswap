import type { CurlPose, FrontPose, Pose, SideLeg, SidePose } from "./kitty";

/**
 * The animation list from the spec, as poses. Frame counts match the spec exactly (about 105 frames per
 * growth stage); fps sits in the spec's 8–12 range, slower for calm animations.
 */
export type AnimName =
  | "idle"
  | "blink"
  | "slowBlink"
  | "groom"
  | "yawn"
  | "meow"
  | "purr"
  | "eat"
  | "knead"
  | "tailFlick"
  | "hop"
  | "stretch"
  | "sleep"
  | "walk"
  | "run"
  | "jumpCrouch"
  | "jumpAir"
  | "jumpLand"
  | "stalk"
  | "pounce"
  | "loaf"
  | "push";

export type Anim = { frames: Pose[]; fps: number; loop: boolean; view: "front" | "side" | "curl" };

const F = (p: Omit<FrontPose, "view">): FrontPose => ({ view: "front", ...p });
const S = (p: Omit<SidePose, "view">): SidePose => ({ view: "side", ...p });
const C = (p: Omit<CurlPose, "view">): CurlPose => ({ view: "curl", ...p });

const gait = (n: number, amp: number, lift: number, phase: number) => {
  const a = (Math.PI * 2 * phase) / n;
  const leg = (o: number): SideLeg => ({
    dx: Math.sin(a + o) * amp,
    lift: Math.max(0, Math.cos(a + o)) * lift,
  });
  return { nf: leg(0), fb: leg(0.15), ff: leg(Math.PI), nb: leg(Math.PI + 0.15) };
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const ANIMS: Record<AnimName, Anim> = {
  // Front view
  idle: { view: "front", fps: 4, loop: true, frames: [0, 0.4, 0.7, 0.4].map((s) => F({ squash: s })) },
  blink: {
    view: "front",
    fps: 12,
    loop: false,
    frames: (["half", "closed", "half"] as const).map((e) => F({ eyes: e })),
  },
  slowBlink: {
    view: "front",
    fps: 5,
    loop: false,
    frames: (["half", "closed", "closed", "closed", "half", "open"] as const).map((e) => F({ eyes: e })),
  },
  groom: {
    view: "front",
    fps: 8,
    loop: true,
    frames: range(8).map((i) =>
      F({ groom: 1, eyes: "closed", mouth: i % 2 ? "lick" : "smile", headDx: -1, headDy: i % 4 < 2 ? 0 : 1 }),
    ),
  },
  yawn: {
    view: "front",
    fps: 8,
    loop: false,
    frames: [
      F({ eyes: "half", mouth: "open", ears: "back" }),
      F({ eyes: "closed", mouth: "yawn", ears: "back", squash: 0.6, headDy: -1 }),
      F({ eyes: "closed", mouth: "yawn", ears: "back", squash: 0.9, headDy: -1 }),
      F({ eyes: "closed", mouth: "yawn", ears: "back", squash: 0.9, headDy: -1 }),
      F({ eyes: "closed", mouth: "open", ears: "back", squash: 0.4 }),
      F({ eyes: "half" }),
    ],
  },
  meow: {
    view: "front",
    fps: 8,
    loop: false,
    frames: [
      F({ eyes: "half" }),
      F({ eyes: "half", mouth: "open", headDy: -1 }),
      F({ eyes: "half", mouth: "open", headDy: -1 }),
      F({}),
    ],
  },
  purr: {
    view: "front",
    fps: 10,
    loop: true,
    frames: [0, 1, 0, -1].map((s) => F({ eyes: "happy", shake: s * 0.35, squash: 0.3 })),
  },
  eat: {
    view: "front",
    fps: 8,
    loop: true,
    frames: range(6).map((i) =>
      F({ eyes: "down", mouth: i % 2 ? "chew" : "smile", headDy: 2 + (i % 2), squash: -0.4 }),
    ),
  },
  knead: {
    view: "front",
    fps: 8,
    loop: true,
    frames: [0, 1, 2, 1, 0, 0].map((i, k) =>
      F({ eyes: "happy", pawL: k < 3 ? i : 0, pawR: k >= 3 ? [0, 1, 2][k - 3] : 0 }),
    ),
  },
  tailFlick: { view: "front", fps: 10, loop: false, frames: [-1, 0, 1, 0].map((t) => F({ tail: t })) },
  hop: {
    view: "front",
    fps: 12,
    loop: false,
    frames: [
      F({ squash: -1.2, eyes: "happy" }),
      F({ bob: -3, squash: 1, eyes: "happy", ears: "perk" }),
      F({ bob: -6, squash: 0.6, eyes: "happy", ears: "perk", mouth: "open" }),
      F({ bob: -6, squash: 0.6, eyes: "happy", ears: "perk", mouth: "open" }),
      F({ bob: -3, squash: 0.6, eyes: "happy" }),
      F({ squash: -1.2, eyes: "happy" }),
    ],
  },
  stretch: {
    view: "front",
    fps: 8,
    loop: false,
    frames: [
      F({ eyes: "half" }),
      F({ eyes: "closed", squash: 0.8, headDy: -1, ears: "back" }),
      F({ eyes: "closed", squash: 1.6, headDy: -2, ears: "back", mouth: "open" }),
      F({ eyes: "closed", squash: 2.2, headDy: -3, ears: "back", mouth: "yawn" }),
      F({ eyes: "closed", squash: 2.2, headDy: -3, ears: "back", mouth: "yawn" }),
      F({ eyes: "closed", squash: 1.2, headDy: -1, mouth: "open" }),
      F({ eyes: "half", squash: 0.4 }),
      F({ ears: "perk" }),
    ],
  },
  sleep: {
    view: "curl",
    fps: 2,
    loop: true,
    frames: [0, 0.35, 0.7, 0.35].map((b, i) => C({ breath: b, earTwitch: i === 2 && false })),
  },

  // Side view (facing right; mirrored at render time for the other direction)
  walk: {
    view: "side",
    fps: 10,
    loop: true,
    frames: range(6).map((i) =>
      S({ legs: gait(6, 2.2, 1.3, i), bob: i % 3 === 1 ? -0.5 : 0, tailTip: i % 2 }),
    ),
  },
  run: {
    view: "side",
    fps: 12,
    loop: true,
    frames: range(6).map((i) => {
      const a = (Math.PI * 2 * i) / 6;
      const front = Math.sin(a) * 3.4;
      const back = -Math.sin(a) * 3.4;
      return S({
        stretch: 1.2 + Math.sin(a) * 0.6,
        bob: -Math.abs(Math.sin(a)) * 1.6,
        ears: "back",
        tail: "back",
        legs: {
          nf: { dx: front, lift: Math.max(0, Math.cos(a)) * 1.8 },
          ff: { dx: front - 1, lift: Math.max(0, Math.cos(a)) * 1.4 },
          nb: { dx: back, lift: Math.max(0, -Math.cos(a)) * 1.8 },
          fb: { dx: back + 1, lift: Math.max(0, -Math.cos(a)) * 1.4 },
        },
      });
    }),
  },
  jumpCrouch: {
    view: "side",
    fps: 10,
    loop: false,
    frames: [
      S({ crouch: 1.4, tail: "low", ears: "back" }),
      S({ crouch: 2.4, tail: "low", ears: "back", tilt: 0.6 }),
    ],
  },
  jumpAir: {
    view: "side",
    fps: 10,
    loop: true,
    frames: [
      S({
        stretch: 1.5,
        tail: "back",
        tilt: -1,
        legs: {
          nf: { dx: 3, lift: 2 },
          ff: { dx: 2.5, lift: 2 },
          nb: { dx: -3, lift: 1 },
          fb: { dx: -2.5, lift: 1 },
        },
      }),
      S({
        stretch: 1,
        tail: "back",
        tilt: 0,
        legs: {
          nf: { dx: 2, lift: 1.6 },
          ff: { dx: 1.5, lift: 1.6 },
          nb: { dx: -2, lift: 1.4 },
          fb: { dx: -1.5, lift: 1.4 },
        },
      }),
    ],
  },
  jumpLand: {
    view: "side",
    fps: 10,
    loop: false,
    frames: [S({ crouch: 2, tail: "up", tilt: 0.8 }), S({ crouch: 0.8, tail: "up" })],
  },
  stalk: {
    view: "side",
    fps: 6,
    loop: true,
    frames: range(4).map((i) =>
      S({
        crouch: 2.2,
        headDy: 2,
        headDx: 0.8,
        tail: "low",
        tailTip: i % 2 ? 1 : -1,
        ears: "up",
        eyes: "wide",
        legs: gait(4, 1.3, 0.6, i),
      }),
    ),
  },
  pounce: {
    view: "side",
    fps: 10,
    loop: false,
    frames: [
      S({ crouch: 2.6, headDy: 2, tail: "low", tailTip: 1, eyes: "wide", tilt: 0.8 }),
      S({ crouch: 2.6, headDy: 2, tail: "low", tailTip: -1, eyes: "wide", tilt: 1 }),
      S({
        stretch: 2,
        tilt: -1.5,
        tail: "back",
        ears: "back",
        legs: {
          nf: { dx: 3.5, lift: 2.4 },
          ff: { dx: 3, lift: 2.2 },
          nb: { dx: -3, lift: 0 },
          fb: { dx: -2.6, lift: 0 },
        },
      }),
      S({
        stretch: 2,
        tilt: -0.5,
        tail: "back",
        ears: "back",
        legs: {
          nf: { dx: 3.5, lift: 2 },
          ff: { dx: 3, lift: 2 },
          nb: { dx: -3, lift: 2 },
          fb: { dx: -2.6, lift: 2 },
        },
      }),
      S({
        crouch: 1.6,
        tilt: 1,
        tail: "up",
        legs: {
          nf: { dx: 2.5, lift: 0 },
          ff: { dx: 2, lift: 0 },
          nb: { dx: -1, lift: 0 },
          fb: { dx: -1, lift: 0 },
        },
      }),
      S({ crouch: 0.6, tail: "up" }),
    ],
  },
  loaf: {
    view: "side",
    fps: 2,
    loop: true,
    frames: [
      S({ loaf: true, tail: "wrap", eyes: "half" }),
      S({ loaf: true, tail: "wrap", eyes: "half", bob: -0.4 }),
    ],
  },
  push: {
    view: "side",
    fps: 8,
    loop: false,
    frames: [0, 1.5, 3, 4.5, 3, 0].map((dx, i) =>
      S({
        headDy: 1.4,
        eyes: i > 1 && i < 5 ? "half" : "open",
        tail: "curl",
        legs: {
          nf: { dx, lift: dx > 0 ? 2 : 0 },
          ff: { dx: 0, lift: 0 },
          nb: { dx: 0, lift: 0 },
          fb: { dx: 0, lift: 0 },
        },
      }),
    ),
  },
};

export const ANIM_NAMES = Object.keys(ANIMS) as AnimName[];
export const FRAMES_PER_STAGE = ANIM_NAMES.reduce((a, n) => a + ANIMS[n].frames.length, 0);
