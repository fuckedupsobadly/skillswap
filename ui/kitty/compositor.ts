import { decode, type Genome, type Stage } from "@/modules/game/genome";
import { paletteFor, type RGBA } from "@/modules/game/palette";
import type { Slot } from "@/modules/game/ranks";
import { ANIMS, type AnimName } from "@/modules/game/rig/anim";
import { ART, ITEM_COLORS, SLOT_ANCHOR, spriteFor } from "@/modules/game/rig/items";
import { draw } from "@/modules/game/rig/kitty";
import { FRAME, type Frame } from "@/modules/game/rig/raster";

/**
 * Compositor: recolours the key-drawn body with the genome's palette, stacks outfit items at each frame's
 * anchors, and caches the result. Facing left is a mirror of the composed frame, so items flip with the cat.
 */
const hexRgba = (hex: string): RGBA => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};
const ITEM_RGBA: Record<string, RGBA> = Object.fromEntries(
  Object.entries(ITEM_COLORS).map(([k, v]) => [k, hexRgba(v)]),
);

/** Order items are drawn in (on top of the body), and the slots drawn on the page kitty. */
const FRONT_ORDER: Slot[] = ["back", "neck", "charm", "face", "head", "tail"];

export type Look = { code: string; stage: Stage; equipped: Partial<Record<Slot, string>> };
type Img = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): Img {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function blit(img: ImageData, sprite: string[], x0: number, y0: number) {
  for (let y = 0; y < sprite.length; y++) {
    for (let x = 0; x < sprite[y].length; x++) {
      const ch = sprite[y][x];
      if (ch === ".") continue;
      const px = x0 + x;
      const py = y0 + y;
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
      const c = ITEM_RGBA[ch];
      if (!c) continue;
      img.data.set(c, (py * img.width + px) * 4);
    }
  }
}

function placeItem(
  img: ImageData,
  f: Frame,
  itemId: string,
  slot: Slot,
  view: "front" | "side" | "curl",
  tick: number,
  behindPass: boolean,
) {
  const art = ART[itemId];
  if (!art || Boolean(art.behind) !== behindPass) return;
  if (view === "curl" && (slot === "face" || slot === "charm" || slot === "neck")) return;
  const sprite = spriteFor(art, view, tick);
  if (!sprite) return;
  const { anchor, align } = SLOT_ANCHOR[slot];
  const a = f.anchors[anchor];
  const w = sprite[0].length;
  const h = sprite.length;
  const x = Math.round(a.x - w / 2 + (view === "front" ? (art.dx ?? 0) : 0));
  const y = Math.round((align === "bottom" ? a.y - h : align === "top" ? a.y : a.y - h / 2) + (art.dy ?? 0));
  blit(img, sprite, x, y);
}

export class Compositor {
  private genome: Genome;
  private palette: RGBA[];
  private cache = new Map<string, Img>();

  constructor(private look: Look) {
    this.genome = decode(look.code);
    this.palette = paletteFor(this.genome);
  }

  /** One composed frame. `tick` animates animated items (shimmering bell, tail sparkle). */
  frame(anim: AnimName, index: number, facing: 1 | -1 = 1, tick = 0): Img {
    const def = ANIMS[anim];
    const i = index % def.frames.length;
    const animated = Object.values(this.look.equipped).some((id) => id && ART[id]?.frames);
    const t = animated ? tick % 3 : 0;
    const key = `${anim}:${i}:${facing}:${t}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const f = draw(this.genome, this.look.stage, def.frames[i]);
    const img = new ImageData(FRAME, FRAME);
    const eq = this.look.equipped;
    // Behind-the-body items (capes, wings, baskets) first, then the body, then everything on top.
    for (const slot of FRONT_ORDER) if (eq[slot]) placeItem(img, f, eq[slot]!, slot, def.view, t, true);
    for (let p = 0; p < FRAME * FRAME; p++) {
      const k = f.keys[p];
      if (!k) continue;
      const [r, g, b, a] = this.palette[k];
      if (a === 255 || img.data[p * 4 + 3] === 0) {
        img.data.set([r, g, b, a], p * 4);
      }
    }
    for (const slot of FRONT_ORDER) if (eq[slot]) placeItem(img, f, eq[slot]!, slot, def.view, t, false);

    const out = makeCanvas(FRAME, FRAME);
    const ctx = out.getContext("2d") as CanvasRenderingContext2D;
    if (facing === -1) {
      const tmp = makeCanvas(FRAME, FRAME);
      (tmp.getContext("2d") as CanvasRenderingContext2D).putImageData(img, 0, 0);
      ctx.translate(FRAME, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(tmp as CanvasImageSource, 0, 0);
    } else ctx.putImageData(img, 0, 0);
    this.cache.set(key, out);
    return out;
  }

  /** Warm the cache for the animations the page kitty uses most, a few per idle callback. */
  warm(names: AnimName[]) {
    for (const n of names)
      for (let i = 0; i < ANIMS[n].frames.length; i++) for (const d of [1, -1] as const) this.frame(n, i, d);
  }
}

/** A loose object sprite (toy, bowl, bed, treat) as a small canvas. */
const objCache = new Map<string, Img>();
export function objectSprite(id: string, view: "front" | "side" = "front"): Img | null {
  const k = `${id}:${view}`;
  const hit = objCache.get(k);
  if (hit) return hit;
  const art = ART[id] ?? EXTRA[id];
  if (!art) return null;
  const sprite = spriteFor(art, view);
  if (!sprite) return null;
  const img = new ImageData(sprite[0].length, sprite.length);
  blit(img, sprite, 0, 0);
  const c = makeCanvas(img.width, img.height);
  (c.getContext("2d") as CanvasRenderingContext2D).putImageData(img, 0, 0);
  objCache.set(k, c);
  return c;
}

/** Objects that aren't earnable items: the food bowl, a treat, and a plain paper ball to play with. */
const EXTRA: Record<string, { front: string[] }> = {
  bowl: {
    front: [
      "..oooooooooo..",
      ".occcCCCcccco.",
      "oooooooooooooo",
      "opppppppppppo.",
      ".oPPPPPPPPPo..",
      "..ooooooooo...",
    ].map((r) => r.padEnd(14, ".")),
  },
  "bowl-full": {
    front: [
      "...oooooooo...",
      "..onNnnNnNno..",
      ".occcCCCcccco.",
      "oooooooooooooo",
      "opppppppppppo.",
      ".oPPPPPPPPPo..",
      "..ooooooooo...",
    ].map((r) => r.padEnd(14, ".")),
  },
  treat: { front: [".oo..", "oyyoo", "oyYyo", ".ooo."] },
  paper: { front: [".ooo.", "ogwgo", "owggo", ".ooo."] },
};

// ── Room scene (profile card, wardrobe) ──────────────────────────────────────

export const ROOM_W = 96;
export const ROOM_H = 60;
const THEMES = {
  cozy: { wall: "#efeaf6", wallLine: "#e5deef", floor: "#ddd3e7", floorLine: "#cfc4dc", base: "#c9bdd8" },
  twilight: { wall: "#d8d2ee", wallLine: "#ccc4e6", floor: "#c4bad9", floorLine: "#b5a9cf", base: "#a99cc6" },
} as const;

/** Paint the room behind a kitty: wall, skirting, floor, the equipped room piece and bed. */
export function drawRoom(
  ctx: CanvasRenderingContext2D,
  theme: "cozy" | "twilight",
  room?: string,
  bed?: string,
) {
  const t = THEMES[theme];
  ctx.fillStyle = t.wall;
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  ctx.fillStyle = t.wallLine;
  for (let x = 6; x < ROOM_W; x += 12) ctx.fillRect(x, 0, 1, 42);
  if (theme === "twilight") {
    ctx.fillStyle = "#ffffff";
    for (const [x, y] of [
      [9, 7],
      [30, 4],
      [61, 9],
      [84, 5],
      [47, 14],
      [74, 18],
    ])
      ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = t.base;
  ctx.fillRect(0, 42, ROOM_W, 2);
  ctx.fillStyle = t.floor;
  ctx.fillRect(0, 44, ROOM_W, ROOM_H - 44);
  ctx.fillStyle = t.floorLine;
  for (let x = 0; x < ROOM_W; x += 16) ctx.fillRect(x + ((x / 16) % 2) * 8, 50, 1, 4);
  ctx.fillRect(0, 54, ROOM_W, 1);
  if (room) {
    const s = objectSprite(room);
    if (s) {
      const pos: Record<string, [number, number]> = {
        window: [8, 10],
        "sunrise-window": [8, 10],
        "moon-window": [8, 10],
        plant: [76, 44 - s.height],
        bookshelf: [6, 44 - s.height],
        rug: [ROOM_W / 2 - s.width / 2, 50],
      };
      const [x, y] = pos[room] ?? [8, 10];
      ctx.drawImage(s as CanvasImageSource, Math.round(x), Math.round(y));
    }
  }
  if (bed) {
    const s = objectSprite(bed);
    if (s) ctx.drawImage(s as CanvasImageSource, Math.round(ROOM_W / 2 - s.width / 2), 54 - s.height + 1);
  }
}
