import type { Guild } from "../guilds";
import { GUILDS } from "../guilds";
import { hash2, INK, light, mix, Px, shade, T } from "./pixels";
import { C } from "./tiles";

/**
 * Buildings in 3/4 top-down view: a roof seen from above, then the front façade. Sizes are whole tiles.
 * Hut windows are separate overlays (see windowOverlay) so presence can change without redrawing.
 */
const LANTERN = "#f2b33d"; // only ever in a lit window: "a teacher is free now"
const GLOW = "#ffe3a1"; // world-only warm light (tavern windows)
const PAPER = "#fbf6ec";
const GLASS = "#5d7398";
const GLASS_LIGHT = "#7f97ba";

const WALLS = {
  plaster: { c: "#f1e3c8", s: "#dcc9a6" },
  stone: { c: "#c9c3cf", s: "#a9a2b3" },
  wood: { c: "#c4946a", s: "#a07450" },
  brick: { c: "#c98b6b", s: "#a86d50" },
  timber: { c: "#f1e3c8", s: "#dcc9a6" },
} as const;
type Wall = keyof typeof WALLS;
type RoofShape = "gable" | "hip" | "round" | "glass" | "flat";

function roof(p: Px, x: number, y: number, w: number, h: number, color: string, shape: RoofShape) {
  const dark = shade(color, 0.28);
  const lite = light(color, 0.28);
  for (let j = 0; j < h; j++) {
    let inset = 0;
    if (shape === "hip") inset = Math.max(0, 3 - j);
    if (shape === "round")
      inset = Math.max(
        0,
        Math.round(5 - Math.sqrt(Math.max(0, 25 - (5 - Math.min(j, 5)) ** 2)) + (j < 5 ? 0 : 0)),
      );
    for (let i = inset; i < w - inset; i++) {
      let c = color;
      if (shape === "glass") {
        c =
          i % 6 === 0 || j % 5 === 0 ? mix(INK, color, 0.55) : (i + j) % 7 === 0 ? light(color, 0.5) : color;
      } else if (shape === "round") {
        c = (i + Math.floor(j / 2)) % 4 === 0 ? dark : color; // thatch streaks
      } else {
        // shingles: rows every 3 px, offset bricks
        if (j % 3 === 2) c = dark;
        else if ((i + (Math.floor(j / 3) % 2) * 3) % 6 === 0) c = dark;
      }
      if (j === 0 || (j === 1 && shape !== "glass")) c = lite; // ridge catches the light
      if (j >= h - 2) c = dark; // eave shadow
      p.set(x + i, y + j, c);
    }
  }
}

function facade(p: Px, x: number, y: number, w: number, h: number, wall: Wall) {
  const m = WALLS[wall];
  p.rect(x, y, w, h, m.c);
  if (wall === "stone") {
    for (let j = 0; j < h; j += 4) {
      p.hline(x, y + j, w, m.s);
      for (let i = (j / 4) % 2 ? 3 : 0; i < w; i += 7) p.vline(x + i, y + j, 4, m.s);
    }
  } else if (wall === "wood") {
    for (let i = 0; i < w; i += 4) p.vline(x + i, y, h, m.s);
  } else if (wall === "brick") {
    for (let j = 0; j < h; j += 3) {
      p.hline(x, y + j, w, m.s);
      for (let i = (j / 3) % 2 ? 2 : 0; i < w; i += 5) p.vline(x + i, y + j, 3, m.s);
    }
  } else if (wall === "timber") {
    const beam = "#7f5534";
    p.hline(x, y, w, beam);
    p.hline(x, y + h - 1, w, beam);
    for (let i = 0; i < w; i += 12) p.vline(x + i, y, h, beam);
    p.vline(x + w - 1, y, h, beam);
  }
  p.hline(x, y + h - 1, w, mix(m.s, INK, 0.3)); // plinth
}

export function door(p: Px, x: number, y: number, color = "#8a5a3c", w = 8, h = 11) {
  p.rect(x, y, w, h, color);
  p.rect(x + 1, y + 1, w - 2, 1, light(color, 0.25));
  p.vline(x + Math.floor(w / 2), y + 1, h - 1, shade(color, 0.25));
  p.set(x + w - 3, y + Math.floor(h / 2), "#e9d48a");
  // outline
  p.hline(x - 1, y - 1, w + 2, INK);
  p.vline(x - 1, y, h, INK);
  p.vline(x + w, y, h, INK);
}

export type WindowKind = "dark" | "lit" | "curtains" | "warm" | "lamp";

/** A window. `lit` is the lantern: a teacher who is free now. `curtains` shows an AFK member asleep at the desk. */
export function windowPane(p: Px, x: number, y: number, kind: WindowKind, w = 8, h = 7) {
  const glass =
    kind === "lit" ? mix(GLOW, LANTERN, 0.35) : kind === "warm" ? GLOW : kind === "lamp" ? GLOW : GLASS;
  p.rect(x, y, w, h, glass);
  if (kind === "dark") {
    p.set(x + 1, y + 1, GLASS_LIGHT);
    p.set(x + 2, y + 1, GLASS_LIGHT);
    p.set(x + 1, y + 2, GLASS_LIGHT);
  }
  if (kind === "lit") {
    // a small hanging lantern in the window
    const cx = x + Math.floor(w / 2);
    p.vline(cx, y, 1, INK);
    p.rect(cx - 1, y + 1, 3, 1, INK);
    p.rect(cx - 1, y + 2, 3, 3, LANTERN);
    p.set(cx, y + 3, "#fff4d6");
    p.rect(cx - 1, y + 5, 3, 1, INK);
  }
  if (kind === "curtains") {
    const cur = "#d9c7a8";
    p.rect(x, y, Math.ceil(w / 2) - 1, h, cur);
    p.vline(x + Math.ceil(w / 2) - 2, y, h, shade(cur, 0.2));
    // the member, asleep at the desk: a head resting on folded arms
    p.rect(x + w - 4, y + h - 3, 3, 2, "#c58f6b");
    p.rect(x + w - 4, y + h - 4, 3, 1, "#5b3a2a");
    p.hline(x + Math.ceil(w / 2) - 1, y + h - 1, Math.floor(w / 2) + 1, "#7f5534");
  }
  if (kind === "warm" || kind === "lamp") p.hline(x, y + h - 2, w, mix(GLOW, "#e7b866", 0.4));
  p.vline(x + Math.floor(w / 2), y, h, kind === "lit" ? mix(INK, LANTERN, 0.5) : mix(INK, glass, 0.4));
  // frame
  p.hline(x - 1, y - 1, w + 2, INK);
  p.hline(x - 1, y + h, w + 2, INK);
  p.vline(x - 1, y, h, INK);
  p.vline(x + w, y, h, INK);
  p.hline(x - 1, y + h + 1, w + 2, mix("#7f5534", INK, 0.2)); // sill
}

/** A 16 × 16 icon from the UI set, at 1:1, onto a hanging board. */
export function signBoard(p: Px, x: number, y: number, icon: readonly string[], board = "#c4946a") {
  p.rect(x, y, 14, 12, board);
  p.hline(x - 1, y - 1, 16, INK);
  p.hline(x - 1, y + 12, 16, INK);
  p.vline(x - 1, y, 12, INK);
  p.vline(x + 14, y, 12, INK);
  // icon scaled to fit 12 × 10: sample every other pixel of the 16 × 16 art
  const pal: Record<string, string> = {
    o: INK,
    l: LANTERN,
    w: PAPER,
    s: "#eadfcb",
    g: C.grassShade,
    b: C.water,
    t: C.stone,
    n: C.woodShade,
  };
  const pad = Math.floor((16 - icon.length) / 2);
  for (let j = 0; j < 10; j++)
    for (let i = 0; i < 12; i++) {
      const sy = Math.floor((j * 16) / 10) - pad;
      const sx = Math.floor((i * 16) / 12);
      const ch = icon[sy]?.[sx];
      if (ch && ch !== "." && pal[ch]) p.set(x + 1 + i, y + 1 + j, ch === "l" ? "#e8836b" : pal[ch]); // never lantern gold on a sign
    }
}

function chimney(p: Px, x: number, y: number) {
  p.rect(x, y, 5, 7, "#a86d50");
  p.hline(x, y + 3, 5, "#8a543c");
  p.rect(x - 1, y - 1, 7, 2, "#8a543c");
  p.hline(x - 2, y - 2, 9, INK);
  p.vline(x - 2, y - 1, 9, INK);
  p.vline(x + 6, y - 1, 9, INK);
}

/** A generic building: roof on top, façade below, outlined. */
function building(
  wT: number,
  hT: number,
  opt: { roof: string; shape?: RoofShape; wall?: Wall; roofRatio?: number },
) {
  const W = wT * T;
  const H = hT * T;
  const p = new Px(W, H);
  const roofH = Math.round(H * (opt.roofRatio ?? 0.5));
  roof(p, 1, 1, W - 2, roofH, opt.roof, opt.shape ?? "gable");
  facade(p, 3, roofH + 1, W - 6, H - roofH - 2, opt.wall ?? "plaster");
  // eave shadow on the façade
  p.hline(3, roofH + 1, W - 6, mix(WALLS[opt.wall ?? "plaster"].s, INK, 0.25));
  return { p, W, H, roofH };
}

function finish(p: Px) {
  p.outline(INK);
  return p;
}

// ── Places ─────────────────────────────────────────────────────────────────

const MUG = [
  "",
  "",
  "...oooooooo.....",
  "..owwwwwwwwoooo.",
  "..olllllllloo.o.",
  "..olllllllloo.o.",
  "..olllllllloooo.",
  "..olllllllllo...",
  "...oooooooooo...",
];

export function tavern(_icons: Record<string, readonly string[]> = {}) {
  const { p, W, H, roofH } = building(6, 5, { roof: "#b0614b", wall: "timber", roofRatio: 0.46 });
  chimney(p, W - 20, 0);
  for (const x of [12, 30, W - 38, W - 20]) windowPane(p, x, roofH + 7, "warm");
  door(p, Math.floor(W / 2) - 5, H - 13, "#7a4a2f", 10, 12);
  signBoard(p, 8, roofH + 16, MUG, "#e9d6a8");
  return finish(p);
}

export function bank() {
  const { p, W, H, roofH } = building(5, 4, {
    roof: "#8c9bae",
    wall: "stone",
    roofRatio: 0.42,
    shape: "hip",
  });
  door(p, Math.floor(W / 2) - 5, H - 13, "#5d4a6b", 10, 12);
  // the giant hourglass in the window
  const x = 9;
  const y = roofH + 4;
  p.rect(x, y, 14, 16, GLASS);
  p.hline(x - 1, y - 1, 16, INK)
    .hline(x - 1, y + 16, 16, INK)
    .vline(x - 1, y, 16, INK)
    .vline(x + 14, y, 16, INK);
  p.ascii(
    x + 2,
    y + 1,
    [
      "oooooooooo",
      ".o......o.",
      "..o.ss.o..",
      "...o.so...",
      "....oo....",
      "...o..o...",
      "..o.ss.o..",
      ".o.ssss.o.",
      "oooooooooo",
    ],
    { o: INK, s: "#e8cfa6" },
  );
  windowPane(p, W - 22, y + 2, "dark");
  return finish(p);
}

export function clockTower(hour = 12, minute = 0) {
  const W = 3 * T;
  const H = 7 * T;
  const p = new Px(W, H);
  // spire
  for (let j = 0; j < 22; j++) {
    const half = Math.floor((j / 22) * 20) + 2;
    for (let i = -half; i <= half; i++)
      p.set(24 + i, 1 + j, j % 3 === 2 ? shade("#6f86b5", 0.3) : j < 2 ? light("#6f86b5") : "#6f86b5");
  }
  facade(p, 6, 23, W - 12, H - 24, "stone");
  // clock face
  const cx = 24;
  const cy = 36;
  for (let y = -8; y <= 8; y++)
    for (let x = -8; x <= 8; x++) {
      const d = Math.hypot(x, y);
      if (d <= 8.5) p.set(cx + x, cy + y, d > 7.4 ? INK : PAPER);
    }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    p.set(Math.round(cx + Math.sin(a) * 6), Math.round(cy - Math.cos(a) * 6), mix(INK, PAPER, 0.4));
  }
  const hand = (len: number, turns: number) => {
    const a = turns * Math.PI * 2;
    for (let r = 0; r <= len; r += 0.5)
      p.set(Math.round(cx + Math.sin(a) * r), Math.round(cy - Math.cos(a) * r), INK);
  };
  hand(4, ((hour % 12) + minute / 60) / 12);
  hand(6, minute / 60);
  windowPane(p, 19, 56, "dark", 10, 12);
  door(p, 19, H - 14, "#5d4a6b", 10, 13);
  return finish(p);
}

export function townHall() {
  const { p, W, H, roofH } = building(7, 5, { roof: "#8c6d8f", wall: "stone", roofRatio: 0.4, shape: "hip" });
  // bell in a small cupola
  p.rect(W / 2 - 6, 0, 12, 8, "#c9c3cf");
  p.ascii(W / 2 - 3, 1, ["..oo..", ".oyyo.", ".oyyo.", "oyyyyo", "oooooo"], { o: INK, y: "#d7b25a" });
  // a shaded portico behind four columns, two either side of the door — read as "civic", not as stripes
  const top = roofH + 2;
  const bottom = H - 5;
  p.rect(6, top, W - 12, 3, "#e2dde8");
  p.hline(6, top + 3, W - 12, INK);
  p.rect(7, top + 4, W - 14, bottom - top - 4, "#a9a2b3");
  for (const x of [12, 30, W - 38, W - 20]) {
    const h = bottom - top - 6;
    p.rect(x - 1, top + 4, 10, 2, "#e2dde8"); // capital
    p.hline(x - 1, top + 6, 10, INK);
    p.rect(x, top + 7, 8, h - 3, "#ece8f0"); // shaft
    p.vline(x + 1, top + 7, h - 3, "#f8f6fa");
    p.vline(x + 6, top + 7, h - 3, "#c9c3cf");
    p.vline(x - 1, top + 7, h - 3, INK);
    p.vline(x + 8, top + 7, h - 3, INK);
    p.rect(x - 1, bottom - 2, 10, 2, "#e2dde8"); // base
  }
  for (const x of [22, W - 28]) windowPane(p, x, top + 10, "dark", 6, 9);
  p.rect(4, bottom, W - 8, 3, "#c9c3cf");
  p.hline(4, bottom, W - 8, INK);
  door(p, Math.floor(W / 2) - 6, H - 15, "#5d4a6b", 12, 12);
  return finish(p);
}

export function well(coins = 0, glint = false) {
  const p = new Px(3 * T, 3 * T);
  // roof on posts
  p.ascii(
    6,
    2,
    [
      "......oooooooooooooooo........",
      "....ooRRRRRRRRRRRRRRRRoo......",
      "..ooRRrRRRRrRRRRrRRRRrRRoo....",
      ".oRRRRRRRRRRRRRRRRRRRRRRRRo...",
      "oooooooooooooooooooooooooooo..",
    ],
    { o: INK, R: "#b0614b", r: shade("#b0614b", 0.3) },
  );
  p.rect(9, 7, 2, 18, C.woodShade).rect(31, 7, 2, 18, C.woodShade);
  p.vline(8, 7, 18, INK).vline(11, 7, 18, INK).vline(30, 7, 18, INK).vline(33, 7, 18, INK);
  // rope and bucket
  p.hline(11, 9, 19, C.woodShade);
  p.vline(20, 10, 8, "#d9c7a8");
  p.ascii(17, 17, ["oooooo", "onnnno", ".onno."], { o: INK, n: C.wood });
  // stone ring with water
  for (let y = 24; y < 44; y++)
    for (let x = 4; x < 44; x++) {
      const d = Math.hypot((x - 24) / 19, (y - 34) / 9.5);
      if (d > 1) continue;
      const ring = d > 0.62;
      const c = ring
        ? (x + Math.floor(y / 3)) % 6 === 0 || y % 3 === 0
          ? C.stoneShade
          : C.stone
        : d > 0.5
          ? C.waterDeep
          : C.water;
      p.set(x, y, c);
    }
  // coins glinting in the water: one per wish made in the last 24 h (capped)
  for (let i = 0; i < Math.min(coins, 6); i++) {
    const x = 17 + Math.floor(hash2(i, 1, 77) * 14);
    const y = 32 + Math.floor(hash2(1, i, 77) * 4);
    p.set(x, y, "#e3c26b");
    if (glint && i === 0) {
      p.set(x, y - 1, "#ffffff");
      p.set(x + 1, y, "#ffffff");
    }
  }
  return finish(p);
}

export function noticeBoard(notes = 0) {
  const p = new Px(3 * T, 2 * T);
  p.rect(5, 6, 2, 26, C.woodShade).rect(41, 6, 2, 26, C.woodShade);
  p.rect(3, 2, 42, 22, "#c99a64");
  for (let i = 0; i < 18; i++)
    p.set(4 + Math.floor(hash2(i, 3, 5) * 40), 3 + Math.floor(hash2(3, i, 5) * 20), "#b5854f");
  p.hline(2, 1, 44, C.woodShade).hline(2, 24, 44, C.woodShade);
  // pinned notes: one per open request from the last 24 h (capped), pins in category colours
  const pins = GUILDS.map((g) => g.roof);
  const n = Math.max(2, Math.min(notes, 9));
  for (let k = 0; k < n; k++) {
    const x = 5 + (k % 5) * 8 + Math.floor(hash2(k, 9, 2) * 2);
    const y = 4 + Math.floor(k / 5) * 10 + Math.floor(hash2(9, k, 2) * 3);
    p.rect(x, y, 6, 7, k % 3 === 0 ? "#f3ead6" : PAPER);
    p.hline(x + 1, y + 2, 4, "#c9bba0").hline(x + 1, y + 4, 3, "#c9bba0");
    p.set(x + 2, y, pins[k % pins.length]);
  }
  return finish(p);
}

/** Lantern Rooms: a row of small study rooms; a lit lantern hangs at each room with a live session. */
export function lanternRooms(live: boolean[] = [false, false, false, false]) {
  const p = new Px(8 * T, 3 * T);
  for (let r = 0; r < 4; r++) {
    const x = r * 32;
    roof(p, x + 1, 1, 30, 20, "#7d8fb3", "hip");
    facade(p, x + 3, 21, 26, 25, "wood");
    door(p, x + 12, 34, "#5d4a6b", 8, 11);
    windowPane(p, x + 6, 25, live[r] ? "lamp" : "dark", 5, 5);
    // the lantern by the door: lit only while a lesson is running inside
    const lx = x + 24;
    p.vline(lx + 1, 26, 2, INK);
    p.rect(lx, 28, 3, 4, live[r] ? LANTERN : PAPER);
    p.hline(lx - 1, 27, 5, INK)
      .hline(lx - 1, 32, 5, INK)
      .vline(lx - 1, 28, 4, INK)
      .vline(lx + 3, 28, 4, INK);
  }
  return finish(p);
}

export function stall(awning: string, goods: string[]) {
  const p = new Px(3 * T, 3 * T);
  // striped awning
  for (let y = 4; y < 16; y++)
    for (let x = 2; x < 46; x++) p.set(x, y, Math.floor(x / 6) % 2 === 0 ? awning : PAPER);
  for (let x = 2; x < 46; x += 6)
    p.ascii(x, 16, ["oooooo", ".oooo."], { o: Math.floor(x / 6) % 2 === 0 ? awning : PAPER });
  p.rect(4, 18, 2, 24, C.woodShade).rect(42, 18, 2, 24, C.woodShade);
  // counter with goods
  p.rect(3, 30, 42, 12, C.wood);
  p.hline(3, 30, 42, C.woodLight);
  goods.forEach((g, i) => {
    p.rect(7 + i * 9, 26, 6, 4, g);
  });
  return finish(p);
}

export function gate() {
  const p = new Px(4 * T, 3 * T);
  p.rect(6, 6, 6, 42, C.wood).rect(52, 6, 6, 42, C.wood);
  p.vline(7, 6, 42, C.woodLight).vline(53, 6, 42, C.woodLight);
  p.rect(2, 2, 60, 9, C.woodShade);
  p.hline(2, 4, 60, C.wood);
  // "SkillSwap Village" plank under the beam
  p.rect(18, 12, 28, 7, "#e9d6a8");
  for (let i = 0; i < 10; i++) p.set(21 + i * 2.4, 15, INK);
  return finish(p);
}

/** A guild hall in its guild's roof colour, with its sign and its silhouette cue. */
export function guildHall(g: Guild, icon: readonly string[], classRunning = false) {
  const shape: RoofShape =
    g.id === "greenhouse" ? "glass" : g.id === "tea-house" ? "hip" : g.id === "tailor" ? "round" : "gable";
  const wall: Wall =
    g.id === "carpenters-yard" || g.id === "helpers-lodge"
      ? "wood"
      : g.id === "counting-house" || g.id === "scriptorium"
        ? "stone"
        : g.id === "bakehouse"
          ? "brick"
          : "plaster";
  const { p, W, H, roofH } = building(6, 5, {
    roof: g.roof,
    shape,
    wall,
    roofRatio: g.id === "scriptorium" ? 0.4 : 0.48,
  });
  const winY = roofH + 6;
  const tall = g.id === "scriptorium";
  const lit: WindowKind = classRunning ? "lamp" : "dark";
  windowPane(p, 10, winY, lit, 9, tall ? 14 : 8);
  windowPane(p, W - 19, winY, lit, 9, tall ? 14 : 8);
  door(p, Math.floor(W / 2) - 5, H - 13, shade(g.roof, 0.35), 10, 12);
  signBoard(p, Math.floor(W / 2) - 7, roofH + 4 + (tall ? 0 : 0) - 2, icon);
  if (g.id === "tinkers-workshop" || g.id === "bakehouse") chimney(p, W - 18, 0);
  if (g.id === "tailor") {
    // mannequin in the window
    p.rect(13, winY + 1, 3, 2, "#e9d6a8").rect(12, winY + 3, 5, 4, g.roof);
  }
  return finish(p);
}

/** Small props placed around the square and guilds (y-sorted with characters). */
export function prop(
  kind:
    | "tree"
    | "pine"
    | "oven"
    | "easel"
    | "sawhorse"
    | "woodstack"
    | "cart"
    | "boxes"
    | "target"
    | "stoneGarden"
    | "paperLantern"
    | "barrel"
    | "bench"
    | "mapStand"
    | "signpost"
    | "donationLantern"
    | "chalk"
    | "lamp"
    | "planter"
    | "planterTree"
    | "flowerCart"
    | "crates",
) {
  const pal = {
    o: INK,
    g: "#5e9e57",
    G: "#3f7a41",
    l: "#86c07a",
    n: C.wood,
    N: C.woodShade,
    s: C.stone,
    S: C.stoneShade,
    r: "#e8836b",
    w: PAPER,
    k: "#3e3346",
    b: "#c99a64",
    p: "#e9a0a0",
    y: "#d7b25a",
    t: "#7c6a8f",
    // square furniture: iron, pale lamp glass (never lantern gold: that means "a teacher is free"), terracotta
    i: "#4a3d55",
    L: "#fff4d6",
    c: "#b49ad8",
    f: "#f7f1f7",
    B: "#c98b6b",
  };
  const art: Record<string, string[]> = {
    lamp: [
      "...ooo...",
      "..oiiio..",
      ".oiiiiio.",
      "oiiiiiiio",
      ".oLLwLLo.",
      ".oLwLLLo.",
      ".oLLLLLo.",
      ".oLLLLLo.",
      "oiiiiiiio",
      ".ooiiioo.",
      "...oio...",
      "...oio...",
      "...oio...",
      "...oio...",
      "...oio...",
      "...oio...",
      "...oio...",
      "...oio...",
      "..oiiio..",
      "..oiiio..",
      ".oiiiiio.",
      ".ooooooo.",
    ],
    planter: [
      "...r..c...f...",
      "..rgr.cgc.gfg.",
      ".gggggggggggg.",
      "oooooooooooooo",
      "osssssssssssSo",
      "oSssssssssssSo",
      "oSSSSSSSSSSSSo",
      "oooooooooooooo",
    ],
    planterTree: [
      "...oooooo...",
      "..ollggggo..",
      ".olgggggGGo.",
      "olgggggggGGo",
      "oggggggggGGo",
      "oggggggggGGo",
      ".oggggggGGo.",
      "..oGGGGGGo..",
      "...oooooo...",
      ".....oNo....",
      ".....oNo....",
      "..oooooooo..",
      "..oBBBBBBo..",
      "..oBBBBBBo..",
      "...oBBBBo...",
      "...oooooo...",
    ],
    flowerCart: [
      "...r.c.f..r.c.f...",
      "..rgrcgcfgrgrcgcf.",
      "..ogggggggggggggo.",
      "..onnnnnnnnnnnnno.",
      "oooNNNNNNNNNNNNNo.",
      "..onnnnnnnnnnnnno.",
      "..ooooooooooooooo.",
      "....ooo.....ooo...",
      "...oNNNo...oNNNo..",
      "....ooo.....ooo...",
    ],
    crates: [
      "..oooooooo..",
      "..onnnnnno..",
      "..onNooNno..",
      "..onoNNono..",
      "..onnnnnno..",
      "oooooooooooo",
      "onnnnnonnnno",
      "onNooNonNoNo",
      "ononNNonoNno",
      "onnnnnonnnno",
      "oooooooooooo",
    ],
    tree: [
      "......oooooo......",
      "....oollggggoo....",
      "...olllggggggGo...",
      "..ollgggggggggGo..",
      ".olgggggggggggGGo.",
      ".oggggggggggggGGo.",
      "ogggggggggggggGGGo",
      "oggggggggggggGGGGo",
      ".ogggggggggGGGGGo.",
      ".oGgggggggGGGGGGo.",
      "..oGGGGGGGGGGGGo..",
      "...ooGGGGGGGGoo...",
      ".....ooooooo......",
      ".......onNo.......",
      ".......onNo.......",
      ".......onNo.......",
      "......onnNNo......",
      ".....oooooooo.....",
    ],
    pine: [
      ".......oo.......",
      "......ogGo......",
      ".....ogggGo.....",
      "....ogggggGo....",
      "....ooggGGoo....",
      "...ogggggGGGo...",
      "..ogggggggGGGo..",
      "..oooggggGGooo..",
      ".ogggggggggGGGo.",
      "ogggggggggggGGGo",
      "oooooooooooooooo",
      "......onNo......",
      "......onNo......",
      ".....oooooo.....",
    ],
    oven: [
      "...oooooo...",
      "..oSSSSSSo..",
      ".oSsssssSSo.",
      "oSsoooooosSo",
      "oSsorrrrosSo",
      "oSsorrrrosSo",
      "oSSSSSSSSSSo",
      "oooooooooooo",
    ],
    easel: ["oooooooo", "owwwwwwo", "owrrbwwo", "owwwbwwo", "oooooooo", ".o.oo.o.", "o..oo..o", "o..oo..o"],
    sawhorse: [
      "oooooooooooo",
      "onnnnnnnnnno",
      "oooooooooooo",
      ".o.o....o.o.",
      "o...o..o...o",
      "o...o..o...o",
    ],
    woodstack: [
      ".oooooooooo.",
      "onNonNonNono",
      "oooooooooooo",
      "onNonNonNono",
      "oooooooooooo",
      "onNonNonNono",
      "oooooooooooo",
    ],
    cart: [
      "oooooooooooooo",
      "obbbbbbbbbbbbo",
      "obbbbbbbbbbbbo",
      "oooooooooooooo",
      "..oo......oo..",
      ".oNNo....oNNo.",
      "..oo......oo..",
    ],
    boxes: [
      "oooooo......",
      "obbbbo......",
      "obNNbooooooo",
      "obbbbobbbbbo",
      "oooooobNNNbo",
      ".....obbbbbo",
      ".....ooooooo",
    ],
    target: [
      "..oooooo..",
      ".owwwwwwo.",
      "owrrrrrrwo",
      "owrwwwwrwo",
      "owrwrrwrwo",
      "owrwrrwrwo",
      "owrwwwwrwo",
      "owrrrrrrwo",
      ".owwwwwwo.",
      "..oooooo..",
      "....oo....",
      "...o..o...",
    ],
    stoneGarden: ["..oooo....oo..", ".osssso..osso.", "osSSSso.osSSso", ".oooooo..oooo."],
    paperLantern: ["..oo..", ".oppo.", "oppppo", "oppppo", ".oppo.", "..oo.."],
    barrel: [".oooooo.", "onNNNNno", "oooooooo", "onnnnnno", "oooooooo", "onNNNNno", ".oooooo."],
    bench: ["oooooooooooooo", "onnnnnnnnnnnno", "oooooooooooooo", ".o..........o.", ".o..........o."],
    mapStand: [
      "oooooooooo",
      "owwgggwwwo",
      "owggwbbwwo",
      "owwwwbwrwo",
      "oooooooooo",
      "....oo....",
      "....oo....",
      "...oooo...",
    ],
    signpost: [
      "oooooooooo..",
      "onnnnnnnnno.",
      "oooooooooooo",
      "....oo......",
      "..oooooooooo",
      ".onnnnnnnnno",
      "..oooooooooo",
      "....oo......",
      "....oo......",
      "...oooo.....",
    ],
    donationLantern: [
      "...oo...",
      "..o..o..",
      ".oooooo.",
      ".owwwwo.",
      ".owwwwo.",
      ".owwwwo.",
      ".oooooo.",
      "...oo...",
      "...oo...",
      "..oooo..",
    ],
    chalk: [
      "oooooooooooo",
      "okkkkkkkkkko",
      "okwkwwkkwkko",
      "okkkwkkwwkko",
      "okwwkkkkkwko",
      "oooooooooooo",
      ".o........o.",
      ".o........o.",
    ],
  };
  const rows = art[kind];
  const p = new Px(rows[0].length, rows.length);
  p.ascii(0, 0, rows, pal);
  return p;
}

/** One frame of chimney smoke, sparks or music notes, for particles. */
export function puff(kind: "smoke" | "spark" | "note" | "z" | "steam") {
  const rows: Record<string, string[]> = {
    smoke: [".oo.", "oggo", "oggo", ".oo."],
    steam: [".w.", "w.w", ".w."],
    spark: ["y.", ".y"],
    note: ["..oo", "..o.", "..o.", "ooo.", "oo.."],
    z: ["oooo", "..o.", ".o..", "oooo"],
  };
  const r = rows[kind];
  const p = new Px(r[0].length, r.length);
  p.ascii(0, 0, r, { o: kind === "smoke" ? "#cfc8d8" : INK, g: "#e9e4ee", w: "#f7f3f8", y: "#e8836b" });
  return p;
}

/** Hut: 3 × 3 tiles. Roof in the owner's main guild colour; door, garden and sign from their hut choices. */
export const DOOR_COLORS = ["#8a5a3c", "#5d4a6b", "#4f7f8a", "#a8524a", "#6d8a4f", "#c08a3e"];
export const GARDENS = ["flowers", "pumpkin", "birdbath", "bench", "barrel", "none"] as const;
export function hut(
  roofColor: string,
  look: { roof: 0 | 1 | 2; door: number; garden: number; sign: number },
  opts: { dark?: boolean } = {},
) {
  const shape: RoofShape = (["gable", "hip", "round"] as const)[look.roof];
  const W = 3 * T;
  const H = 3 * T;
  const p = new Px(W, H);
  roof(p, 2, 2, W - 4, 24, roofColor, shape);
  facade(p, 5, 26, W - 10, 20, look.roof === 2 ? "wood" : "plaster");
  if (opts.dark) p.rect(5, 26, W - 10, 20, mix(WALLS.plaster.c, "#3a3260", 0.15), 120);
  door(p, 26, 34, DOOR_COLORS[look.door % DOOR_COLORS.length], 8, 11);
  // the window frame; the glass is an overlay that shows presence
  p.hline(9, 29, 12, INK).hline(9, 38, 12, INK).vline(9, 30, 8, INK).vline(20, 30, 8, INK);
  p.hline(9, 39, 12, mix(C.woodShade, INK, 0.2));
  nameSign(p, look.sign);
  return finish(p);
}

/** The hut's sign style (§5.2): a plaque over the door, a hanging sign, or a painted stone tile. */
function nameSign(p: Px, style: number) {
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    p.rect(x, y, w, h, fill);
    p.hline(x, y, w, INK)
      .hline(x, y + h - 1, w, INK)
      .vline(x, y, h, INK)
      .vline(x + w - 1, y, h, INK);
  };
  if (style % 3 === 0) {
    box(24, 26, 12, 6, "#c4946a");
    p.hline(26, 28, 5, "#8a5a3c").hline(26, 29, 7, "#8a5a3c");
  } else if (style % 3 === 1) {
    p.hline(35, 28, 7, INK); // bracket off the wall
    p.set(37, 29, INK).set(40, 29, INK);
    box(35, 30, 7, 6, "#f3ead6");
    p.hline(37, 32, 3, "#8a7a68");
  } else {
    box(36, 36, 6, 6, "#c9c3cf");
    p.set(38, 38, "#7d7690").set(39, 39, "#7d7690");
  }
}
/** Window overlay for a hut, positioned at (10, 30) inside the hut sprite. */
export function hutWindow(kind: WindowKind) {
  const p = new Px(10, 8);
  windowPane(p, 0, 0, kind, 10, 8);
  // the frame is part of the hut; keep only the glass here
  return cropGlass(p);
}
function cropGlass(p: Px) {
  const out = new Px(10, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) out.set(x, y, p.get(x, y));
  return out;
}

/** "Back soon" / "Closed" / "In a lesson" door sign for a hut. */
export function doorSign(kind: "closed" | "lesson" | "away") {
  const p = new Px(10, 7);
  p.rect(0, 0, 10, 7, kind === "lesson" ? "#cfe0f0" : "#f3ead6");
  p.hline(2, 2, 6, INK).hline(2, 4, kind === "closed" ? 4 : 6, INK);
  return p.outline(INK);
}

export function gardenItem(i: number) {
  const kind = GARDENS[i % GARDENS.length];
  const art: Record<string, string[]> = {
    flowers: [".r..w.", "rgr.wgw", ".g..g.", "oooooo"],
    pumpkin: ["..g...", ".oooo.", "ouuuuo", "ouUuUo", ".oooo."],
    birdbath: ["oooooo", "obbbbo", ".oooo.", "..oo..", ".oooo."],
    bench: ["oooooooo", "onnnnnno", "oooooooo", "o......o"],
    barrel: [".oooo.", "onNNno", "oooooo", "onnnno", ".oooo."],
    none: ["."],
  };
  const rows = art[kind];
  const p = new Px(Math.max(1, rows[0].length + 1), rows.length);
  p.ascii(0, 0, rows, {
    o: INK,
    r: "#e8836b",
    w: PAPER,
    g: "#5e9e57",
    u: "#e39a4f",
    U: "#c4762f",
    b: C.water,
    n: C.wood,
    N: C.woodShade,
  });
  return p;
}
