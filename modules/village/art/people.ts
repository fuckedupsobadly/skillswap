import type { VillagerLook } from "@/db/schema";
import { decode } from "@/modules/game/genome";
import { furSlice } from "@/modules/game/palette";
import { hash2, INK, light, Px, shade } from "./pixels";

/**
 * Villager rig: 16 × 32 frames (1 × 2 tiles), 4 directions, layered and palette-driven — so 10 hair colours or
 * 8 skin tones cost no extra drawings. The 1 px plum outline is added last around the whole silhouette.
 */
export const SKIN = ["#f6d9c4", "#efc7a6", "#e2b18c", "#cf9a72", "#b8805b", "#9c6646", "#7c4f37", "#5e3a28"];
export const HAIR_COLORS = [
  "#2e2328",
  "#4a3426",
  "#6e4a2f",
  "#9c6a3c",
  "#c9954f",
  "#e2c27a",
  "#b5462f",
  "#8f8a9c",
  "#ece6da",
  "#6a5a9c",
];
export const CLOTH = [
  "#e8836b",
  "#6f86b5",
  "#5e9e57",
  "#b86f98",
  "#d8c27c",
  "#4fa3a0",
  "#f1e3c8",
  "#3e3346",
  "#c98b6b",
  "#a9c3a2",
];
export const HAIR_STYLES = [
  "Short crop",
  "Short bob",
  "Long straight",
  "Ponytail",
  "Bun",
  "Curly",
  "Spiky",
  "Bald",
  "Side part",
  "Buzz",
  "Braids",
  "Afro",
  "Wavy",
  "Mohawk",
  "Pigtails",
  "Long curly",
];
export const EYE_STYLES = ["Dot", "Tall", "Wide", "Round", "Sleepy", "Lashes"];
export const BROWS = ["None", "Straight", "Arched", "Thick"];
export const TOPS = [
  "Knit sweater",
  "Tee",
  "Hoodie",
  "Striped",
  "Collar shirt",
  "Vest",
  "Cardigan",
  "Cable knit",
  "Turtleneck",
  "Apron",
  "Jacket",
  "Overalls",
];
export const BOTTOMS = [
  "Trousers",
  "Shorts",
  "Skirt",
  "Long skirt",
  "Jeans",
  "Leggings",
  "Cargo",
  "Dungarees",
];
export const SHOES = ["Sneakers", "Boots", "Sandals", "Dress shoes", "Slippers", "Rain boots"];
export const BODIES = ["Slim", "Regular", "Broad"];
export const ACCESSORIES = ["none", "glasses", "scarf", "hat", "bag"] as const;

export type View = "down" | "up" | "right";
export type VAnim = "idle" | "walk" | "sit" | "wave" | "sleep" | "read" | "point";
export const V_ANIMS: Record<VAnim, number> = {
  idle: 2,
  walk: 4,
  sit: 1,
  wave: 3,
  sleep: 2,
  read: 2,
  point: 3,
};
export const VIEWS: View[] = ["down", "up", "right"];

type Pal = {
  skin: string;
  skinS: string;
  hair: string;
  hairS: string;
  top: string;
  topS: string;
  bot: string;
  botS: string;
  shoe: string;
  shoeS: string;
};

function palette(l: VillagerLook): Pal {
  const skin = SKIN[l.skin % SKIN.length];
  const hair = HAIR_COLORS[l.hairColor % HAIR_COLORS.length];
  const top = CLOTH[l.topColor % CLOTH.length];
  const bot = l.bottom === 4 ? "#5b78a6" : l.bottom === 5 ? "#3e3346" : CLOTH[l.bottomColor % CLOTH.length];
  const shoes = ["#f1e9df", "#5a3d2b", "#c98b6b", "#2e2328", "#d9a0b4", "#e8836b"];
  const shoe = shoes[l.shoes % shoes.length];
  return {
    skin,
    skinS: shade(skin, 0.2),
    hair,
    hairS: shade(hair, 0.3),
    top,
    topS: shade(top, 0.25),
    bot,
    botS: shade(bot, 0.25),
    shoe,
    shoeS: shade(shoe, 0.3),
  };
}

/** Draw one frame. Coordinates: 16 wide, feet on row 30, outline added last. */
export function villagerFrame(l: VillagerLook, view: View, anim: VAnim, f: number): Px {
  const p = new Px(16, 32);
  const c = palette(l);
  const build = [-1, 0, 1][l.body % 3];
  const seated = anim === "sit" || anim === "sleep" || (anim === "read" && false);
  const walk = anim === "walk";
  const bob = walk && (f === 1 || f === 3) ? -1 : anim === "idle" && f === 1 ? 1 : 0;
  const sitDrop = seated ? 3 : 0;
  const headY = 6 + bob + sitDrop + (anim === "sleep" ? 3 : 0);
  const torsoY = 17 + bob + sitDrop;
  const side = view === "right";

  // ── Legs and shoes
  const legTop = torsoY + 7;
  const step = walk ? [0, 1, 0, -1][f] : 0; // +1: left leg forward
  if (seated) {
    // knees toward us, feet tucked
    p.rect(4 - build, legTop, 8 + build * 2, 3, c.bot);
    p.hline(4 - build, legTop + 2, 8 + build * 2, c.botS);
    p.rect(5, legTop + 3, 2, 1, c.shoe).rect(9, legTop + 3, 2, 1, c.shoe);
  } else if (side) {
    const back = Math.max(0, -step) + Math.max(0, step);
    // far leg (behind), near leg (front): they scissor when walking
    p.rect(6 - step, legTop, 3, 6 - (step < 0 ? 1 : 0), c.botS);
    p.rect(7 + step, legTop, 3, 6 - (step > 0 ? 1 : 0), c.bot);
    p.rect(6 - step, legTop + 6 - (step < 0 ? 1 : 0), 4, 1, c.shoeS);
    p.rect(7 + step, legTop + 6 - (step > 0 ? 1 : 0), 4, 1, c.shoe);
    void back;
  } else {
    const lh = 6 - (step > 0 ? 1 : 0);
    const rh = 6 - (step < 0 ? 1 : 0);
    p.rect(5, legTop, 3, lh, c.bot).rect(8, legTop, 3, rh, c.bot);
    p.vline(8, legTop, Math.min(lh, rh), c.botS);
    if (l.bottom === 1 || l.bottom === 2) {
      // shorts / skirt: skin below the knee
      p.rect(5, legTop + 3, 3, lh - 3, c.skin).rect(8, legTop + 3, 3, rh - 3, c.skin);
    }
    if (l.bottom === 2 || l.bottom === 3) {
      // skirt flare
      p.rect(4, legTop, 8, l.bottom === 3 ? 5 : 3, c.bot);
      p.hline(4, legTop + (l.bottom === 3 ? 4 : 2), 8, c.botS);
    }
    if (l.bottom === 6) p.set(5, legTop + 2, c.botS).set(10, legTop + 2, c.botS);
    p.rect(5, legTop + lh, 3, 1, c.shoe).rect(8, legTop + rh, 3, 1, c.shoe);
    if (l.shoes === 1 || l.shoes === 5)
      p.rect(5, legTop + lh - 1, 3, 1, c.shoe).rect(8, legTop + rh - 1, 3, 1, c.shoe);
    if (l.shoes === 0) p.hline(5, legTop + lh, 3, "#ffffff").hline(8, legTop + rh, 3, "#ffffff");
  }

  // ── Torso
  const tw = 8 + build * 2;
  const tx = side ? 5 : 4 - build;
  const ww = side ? 6 : tw;
  p.rect(tx, torsoY, ww, 7, c.top);
  p.hline(tx, torsoY + 6, ww, c.topS);
  const t = l.top;
  if (!side || t === 3) {
    if (t === 3) for (let y = torsoY + 1; y < torsoY + 7; y += 2) p.hline(tx, y, ww, c.topS); // striped
    if (t === 4 && view === "down") p.set(6, torsoY, "#ffffff").set(9, torsoY, "#ffffff"); // collar
    if ((t === 5 || t === 6 || t === 10) && view === "down")
      p.vline(7, torsoY + 1, 6, t === 5 ? light(c.top) : "#f1e3c8").vline(
        8,
        torsoY + 1,
        6,
        t === 10 ? INK : t === 5 ? light(c.top) : "#f1e3c8",
      );
    if (t === 7)
      for (let y = torsoY; y < torsoY + 6; y++)
        for (let x = tx; x < tx + ww; x++) if ((x + y) % 3 === 0) p.set(x, y, c.topS);
    if (t === 8) p.rect(6, torsoY - 1, 4, 2, c.top);
    if (t === 9 && view === "down") p.rect(6, torsoY + 2, 4, 6, "#f1e3c8");
    if (t === 11 && view === "down")
      p.rect(6, torsoY + 2, 4, 5, c.bot)
        .set(6, torsoY, c.bot)
        .set(9, torsoY, c.bot);
    if (t === 2 && view !== "right") p.hline(5, torsoY, 6, c.topS);
  }

  // ── Arms
  const armColor = c.top;
  const sleeve = t === 1 ? c.skin : armColor; // tee: forearms show
  if (side) {
    const swing = walk ? [0, 1, 0, -1][f] : 0;
    if (anim === "point") {
      const up = [0, -1, 0][f % 3];
      p.rect(9, torsoY + 1 + up, 5, 2, armColor);
      p.set(14, torsoY + 1 + up, c.skin).set(15, torsoY + 1 + up, c.skin);
    } else {
      p.rect(7 + swing, torsoY + 1, 2, 5, armColor);
      p.rect(7 + swing, torsoY + 5, 2, 1, sleeve);
      p.set(7 + swing, torsoY + 6, c.skin).set(8 + swing, torsoY + 6, c.skin);
    }
  } else {
    const lx = tx - 2;
    const rx = tx + ww;
    const swing = walk ? [0, -1, 0, 1][f] : 0;
    const armL = (y0: number) => {
      p.rect(lx, y0, 2, 5, armColor)
        .rect(lx, y0 + 4, 2, 1, sleeve)
        .rect(lx, y0 + 5, 2, 1, c.skin);
    };
    const armR = (y0: number) => {
      p.rect(rx, y0, 2, 5, armColor)
        .rect(rx, y0 + 4, 2, 1, sleeve)
        .rect(rx, y0 + 5, 2, 1, c.skin);
    };
    if (anim === "wave" && view === "down") {
      armL(torsoY + 1);
      const hx = rx + [0, 1, 0][f % 3];
      p.rect(hx, torsoY - 5, 2, 6, armColor).rect(hx, torsoY - 7, 2, 2, c.skin);
    } else if (anim === "sleep") {
      // arms folded on the desk in front of the chest
      p.rect(tx - 1, torsoY + 3, ww + 2, 2, armColor).hline(tx, torsoY + 4, ww, c.topS);
    } else if (anim === "read") {
      armL(torsoY + 1);
      armR(torsoY + 1);
      p.rect(5, torsoY + 2, 6, 4, f === 0 ? "#f3ead6" : "#ffffff");
      p.vline(7, torsoY + 2, 4, INK).vline(8, torsoY + 2, 4, "#6f86b5");
      p.hline(5, torsoY + 5, 6, "#6f86b5");
    } else {
      armL(torsoY + 1 + swing);
      armR(torsoY + 1 - swing);
    }
  }

  // ── Head
  const hx = side ? 5 : 4;
  const hw = side ? 7 : 8;
  p.rect(hx, headY, hw, 9, c.skin);
  // round the head corners
  for (const [x, y] of [
    [hx, headY],
    [hx + hw - 1, headY],
    [hx, headY + 8],
    [hx + hw - 1, headY + 8],
  ])
    p.data[(y * 16 + x) * 4 + 3] = 0;
  if (side) p.set(hx + hw, headY + 5, c.skin); // nose
  p.rect(7, headY + 9, 2, 2, c.skinS); // neck
  if (view !== "up") {
    // face
    const closed = anim === "sleep" || l.eyes === 4;
    const eyes: [number, number][] = side
      ? [[hx + 5, headY + 5]]
      : [
          [hx + 2, headY + 5],
          [hx + 5, headY + 5],
        ];
    for (const [x, y] of eyes) {
      if (closed) {
        p.set(x, y + 1, INK);
        if (!side) p.set(x + 1, y + 1, INK);
        continue;
      }
      switch (l.eyes % 6) {
        case 1:
          p.set(x, y, INK).set(x, y + 1, INK);
          break;
        case 2:
          p.set(x, y + 1, INK).set(x + 1, y + 1, INK);
          break;
        case 3:
          p.rect(x, y, 2, 2, INK).set(x, y, "#ffffff");
          break;
        case 5:
          p.set(x, y + 1, INK).set(x + (side ? 1 : x < 8 ? -1 : 1), y, INK);
          break;
        default:
          p.set(x, y + 1, INK);
      }
      // brows
      if (l.brows === 1) p.hline(x, y - 1, 2, c.hairS);
      if (l.brows === 2) p.set(x, y - 1, c.hairS).set(x + 1, y - 2, c.hairS);
      if (l.brows === 3) p.rect(x, y - 2, 2, 2, c.hairS);
    }
    if (!side)
      p.set(hx + 1, headY + 7, mix2(c.skin, "#e8836b")).set(hx + 6, headY + 7, mix2(c.skin, "#e8836b")); // cheeks
    if (l.accessory === "glasses") {
      for (const [x, y] of eyes) {
        p.hline(x - 1, y, 3, INK);
        p.hline(x - 1, y + 2, 3, INK);
      }
      if (!side) p.hline(hx + 4, headY + 5, 1, INK);
    }
  }

  // ── Hair
  hair(p, l.hair % 16, view, hx, hw, headY, c.hair, c.hairS);

  // ── Accessories over everything
  if (l.accessory === "scarf") {
    p.rect(side ? 6 : 5, torsoY - 1, side ? 5 : 6, 2, "#b5462f");
    if (!side) p.rect(9, torsoY + 1, 2, 3, "#b5462f");
  }
  if (l.accessory === "hat") {
    p.rect(hx, headY - 2, hw, 3, "#6f86b5");
    p.hline(hx - 1, headY + 1, hw + (side ? 3 : 2), shade("#6f86b5", 0.3));
  }
  if (l.accessory === "bag" && view !== "up") {
    for (let i = 0; i < 6; i++) p.set(side ? 6 + Math.floor(i / 2) : 5 + i, torsoY + i, "#8a5a3c");
    p.rect(side ? 4 : 10, torsoY + 5, 3, 3, "#a8774f");
  }
  p.outline(INK);
  return p;
}

function mix2(a: string, b: string) {
  const ha = Number.parseInt(a.slice(1), 16);
  const hb = Number.parseInt(b.slice(1), 16);
  const ch = (s: number) =>
    Math.round(((ha >> s) & 255) * 0.6 + ((hb >> s) & 255) * 0.4)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

function hair(
  p: Px,
  style: number,
  view: View,
  hx: number,
  hw: number,
  hy: number,
  col: string,
  colS: string,
) {
  if (style === 7) return; // bald
  const side = view === "right";
  const back = view === "up";
  const set = (x: number, y: number, s = false) => p.set(x, y, s ? colS : col);
  const top = [2, 2, 2, 2, 2, 3, 3, 0, 2, 1, 2, 4, 2, 0, 2, 3][style];
  const sides = [2, 5, 8, 2, 2, 4, 2, 0, 3, 0, 9, 4, 6, 0, 3, 9][style];
  // crown
  for (let y = hy - top + 1; y <= hy + 2; y++)
    for (let x = hx - (style === 11 ? 1 : 0); x < hx + hw + (style === 11 ? 1 : 0); x++)
      set(x, y, y === hy + 2 && (x + y) % 3 === 0);
  if (style === 9) {
    // buzz: a thin shaded cap only
    for (let x = hx; x < hx + hw; x++) set(x, hy, true);
  }
  if (style === 13) {
    for (let y = hy - 3; y <= hy + 1; y++) {
      set(hx + Math.floor(hw / 2), y);
      set(hx + Math.floor(hw / 2) - 1, y);
    }
    return;
  }
  if (style === 6) for (let x = hx; x < hx + hw; x += 2) set(x, hy - top, false);
  // sides frame the face (front) or cover the back of the head
  if (back) {
    for (let y = hy; y <= hy + 8 + Math.max(0, sides - 6); y++)
      for (let x = hx; x < hx + hw; x++) set(x, y, y > hy + 6 && x % 2 === 0);
  } else if (side) {
    for (let y = hy; y <= hy + Math.min(8, sides + 2); y++)
      for (let x = hx; x < hx + 3; x++) set(x, y, x === hx + 2);
    if (sides > 6)
      for (let y = hy + 8; y <= hy + sides; y++) {
        set(hx, y);
        set(hx + 1, y, true);
      }
  } else {
    for (let y = hy + 2; y <= hy + 2 + sides; y++) {
      set(hx, y, y > hy + 6);
      set(hx + hw - 1, y, y > hy + 6);
      if (sides > 6 && y > hy + 7) {
        set(hx - 1, y);
        set(hx + hw, y);
      }
    }
    // fringe
    if ([1, 4, 12].includes(style)) for (let x = hx + 1; x < hx + hw - 1; x++) set(x, hy + 3, x % 2 === 0);
    if ([2, 8].includes(style)) for (let x = hx + 1; x < hx + hw - 3; x++) set(x, hy + 3);
  }
  if (style === 5 || style === 15 || style === 11) {
    // curls: bumpy edge
    for (let x = hx - 1; x <= hx + hw; x += 2) set(x, hy - top + 1, true);
  }
  if (style === 3 && !side) {
    set(hx + hw, hy + 4);
    set(hx + hw, hy + 5);
    set(hx + hw + 1, hy + 6);
  }
  if (style === 3 && side)
    for (let y = hy + 3; y < hy + 9; y++) {
      set(hx - 1, y);
      set(hx - 2, y + 1);
    }
  if (style === 4)
    for (let y = hy - top - 2; y < hy - top + 1; y++)
      for (let x = hx + 2; x < hx + hw - 2; x++) set(x, y, y === hy - top);
  if (style === 14 && !side && !back)
    for (const x of [hx - 2, hx + hw + 1])
      for (let y = hy + 3; y < hy + 7; y++) {
        set(x, y);
        set(x + (x < hx ? 1 : -1), y);
      }
  if (style === 10 && !back)
    for (const x of [hx, hx + hw - 1]) for (let y = hy + 8; y < hy + 13; y++) set(x, y, y % 2 === 0);
}

/** A whole villager spritesheet: rows = views (down, up, right), columns = every animation frame in order. */
export const SHEET_FRAMES = (Object.keys(V_ANIMS) as VAnim[]).flatMap((a) =>
  Array.from({ length: V_ANIMS[a] }, (_, f) => ({ anim: a, f })),
);
export function villagerSheet(l: VillagerLook) {
  const sheet = new Px(SHEET_FRAMES.length * 16, VIEWS.length * 32);
  VIEWS.forEach((v, row) => {
    SHEET_FRAMES.forEach(({ anim, f }, col) => {
      sheet.blit(villagerFrame(l, v, anim, f), col * 16, row * 32);
    });
  });
  return sheet;
}

/** Deterministic default look, e.g. for sample members who never opened the creator. */
export function lookFromSeed(seed: string): VillagerLook {
  let h = 0;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const r = (k: number, n: number) => Math.floor(hash2(h, k, 7) * n);
  return {
    body: r(1, 3),
    skin: r(2, 8),
    hair: [0, 1, 2, 3, 4, 5, 8, 10, 11, 12, 14, 15][r(3, 12)],
    hairColor: r(4, 10),
    eyes: r(5, 6) === 4 ? 0 : r(5, 6),
    brows: r(6, 4),
    top: r(7, 12),
    topColor: r(8, 10),
    bottom: r(9, 8),
    bottomColor: r(10, 10),
    shoes: r(11, 6),
    accessory: (["none", "none", "glasses", "scarf", "hat", "bag"] as const)[r(12, 6)],
  };
}

// ── Field kitty (16 × 16) — the open-village version of the 48 × 48 close-up kitty ──────────────

export type KView = "down" | "up" | "right";
export const K_ANIMS = { walk: 4, sit: 1, sleep: 2 } as const;
export function fieldKitty(code: string, view: KView, anim: keyof typeof K_ANIMS, f: number) {
  const g = decode(code);
  const fur = furSlice(g.pattern === 7 ? 2 : g.coat, g.shade);
  const p = new Px(16, 16);
  const F = fur.fur;
  const S = fur.furShadow;
  const P = g.pattern === 1 || g.pattern === 2 ? fur.pattern : null;
  const W = g.markings === 2 || g.markings === 5 || g.pattern === 3 || g.pattern === 4 ? "#f7f3f8" : null;
  const step = anim === "walk" ? [0, 1, 0, -1][f] : 0;
  if (anim === "sleep") {
    // curled loaf with the tail around
    p.rect(3, 10 + (f ? 0 : 0), 10, 4, F).hline(3, 13, 10, S);
    p.rect(3, 8, 5, 4, F);
    p.set(3, 7, F).set(6, 7, F); // ears
    p.hline(4, 10, 3, INK);
    p.hline(8, 14, 5, S);
    if (P) for (let x = 8; x < 13; x += 2) p.vline(x, 10, 2, P);
    if (f === 1) p.hline(3, 9, 10, F);
  } else if (view === "right") {
    const sit = anim === "sit";
    p.rect(3, sit ? 8 : 9, 8, sit ? 6 : 4, F).hline(3, 12, 8, S);
    p.rect(9, 5, 5, 5, F); // head
    p.set(9, 4, F).set(12, 4, F); // ears
    p.set(12, 7, INK); // eye
    p.set(14, 8, "#dd7f9c"); // nose
    if (!sit)
      for (const [x, d] of [
        [4, step],
        [6, -step],
        [9, -step],
        [10, step],
      ] as [number, number][])
        p.vline(x + d, 13, 2, x === 6 || x === 10 ? S : F);
    else p.rect(9, 12, 2, 2, F);
    // tail up
    p.vline(2, 5 + (step !== 0 ? 1 : 0), 6, F).set(1, 5, F);
    if (P) for (let x = 4; x < 10; x += 2) p.vline(x, 9, 2, P);
    if (W) p.rect(10, 9, 3, 2, W);
  } else {
    const back = view === "up";
    p.rect(4, 9, 8, 5, F).hline(4, 13, 8, S);
    p.rect(4, 4, 8, 6, F); // head
    p.set(4, 3, F).set(5, 3, F).set(10, 3, F).set(11, 3, F);
    if (!back) {
      p.set(6, 6, INK).set(9, 6, INK).set(7, 8, "#dd7f9c").set(8, 8, "#dd7f9c");
      if (W) p.rect(6, 10, 4, 3, W);
    } else {
      p.vline(8, 2 + (step ? 1 : 0), 7, F); // tail up behind
    }
    for (const [x, d] of [
      [5, step],
      [10, -step],
    ] as [number, number][])
      p.vline(x, 14 - (d > 0 ? 1 : 0), 2, S);
    if (P) for (let x = 5; x < 11; x += 2) p.set(x, 4, P);
  }
  p.outline(INK);
  return p;
}

// ── Scenery critters: non-human, no nameplates, never clickable as people ──────────────────────

export function critter(kind: "chicken" | "duck" | "bird" | "pigeon", f: number) {
  const art: Record<string, string[][]> = {
    chicken: [
      ["...rr...", "..owwo..", ".owwwwo.", "owwwwwo.", ".owwwo..", "..y.y..."],
      ["........", "...rr...", "..owwo..", ".owwwwo.", "owwwwyo.", "..y.y..."],
    ],
    duck: [
      ["...gg.....", "..ggyy....", "...ggwww..", "..wwwwwww.", "...wwwww..", "bbbbbbbbbb"],
      ["...gg.....", "..ggyy....", "...ggwww..", "..wwwwwww.", "..wwwwww..", ".bbbbbbbb."],
    ],
    bird: [
      ["o...o", ".o.o.", "..o.."],
      [".....", "ooooo", "..o.."],
    ],
    // square pigeons: grey with a green-violet neck; frame 2 pecks
    pigeon: [
      ["..ss...", ".sgs...", ".svsss.", "..sssss", "...sss.", "...y.y."],
      [".......", "..ss...", ".sgsss.", ".vssss.", "...sss.", "...y.y."],
    ],
  };
  const rows = art[kind][f % 2];
  const p = new Px(rows[0].length + 2, rows.length + 2);
  p.ascii(1, 1, rows, {
    o: "#6e5a6f",
    w: "#f7f1e8",
    r: "#e8836b",
    y: "#c98b6b",
    g: "#4f9a6b",
    b: "#86bedf",
    s: "#a9a2b3",
    v: "#7d6f9c",
  });
  if (kind !== "bird") p.outline(INK);
  return p;
}

/** The Barkeep (AI): always the same look, always labelled "Barkeep · AI". */
export const BARKEEP_LOOK: VillagerLook = {
  body: 2,
  skin: 3,
  hair: 0,
  hairColor: 1,
  eyes: 3,
  brows: 3,
  top: 9,
  topColor: 6,
  bottom: 0,
  bottomColor: 7,
  shoes: 3,
  accessory: "none",
};
