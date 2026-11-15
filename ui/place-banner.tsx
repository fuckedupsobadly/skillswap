"use client";
import { useEffect, useRef } from "react";
import type { HutLook, VillagerLook } from "@/db/schema";
import * as B from "@/modules/village/art/buildings";
import { BARKEEP_LOOK, critter, fieldKitty, lookFromSeed, villagerFrame } from "@/modules/village/art/people";
import { hash2, Px } from "@/modules/village/art/pixels";
import { BAR, BARKEEP, tavernInterior } from "@/modules/village/art/tavern";
import { drawTileset, TILESET_COLUMNS, tileIndex } from "@/modules/village/art/tiles";
import { GUILDS } from "@/modules/village/guilds";
import { ICONS } from "@/ui/pixel/icon-art";

/**
 * A sheet's header vignette: the place itself, drawn with the same pixel art as the world, standing on its
 * ground under a sky that follows your clock. It is decoration (aria-hidden); the title below names the place.
 */
export type Scene =
  | {
      place:
        | "well"
        | "board"
        | "tavern"
        | "bank"
        | "tower"
        | "hall"
        | "lanterns"
        | "gate"
        | "market"
        | "pond"
        | "map"
        | "barkeep";
      live?: number;
    }
  | { guild: string; running?: boolean }
  | {
      hut: {
        roof: string;
        look: HutLook;
        presence: string;
        villager?: VillagerLook | null;
        kitty?: string | null;
        mailbox?: boolean;
      };
    };

const S = 2; // whole-pixel scale
const H = 80; // logical height → 160 px
type Tod = "day" | "dusk" | "night";

const SKY: Record<Tod, string[]> = {
  day: ["#b9dcec", "#c8e4ee", "#d8ecec", "#e8f3e8"],
  dusk: ["#7d6f9c", "#b98aa6", "#e1a1a0", "#f1c7a0"],
  night: ["#241f3d", "#2f2850", "#3a3260", "#4a4175"],
};
const HILLS: Record<Tod, [string, string]> = {
  day: ["#c5e0ad", "#a8cf8e"],
  dusk: ["#b79aa8", "#9fb08c"],
  night: ["#45406c", "#4d5a6c"],
};

function timeOfDay(d = new Date()): Tod {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 19.25 || h < 5.75) return "night";
  if (h >= 18 || h < 7) return "dusk";
  return "day";
}

let TILESET: Px | null = null;
function tile(name: string) {
  TILESET ??= drawTileset();
  const i = tileIndex(name);
  const sx = (i % TILESET_COLUMNS) * 16;
  const sy = Math.floor(i / TILESET_COLUMNS) * 16;
  const t = new Px(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const c = TILESET.get(sx + x, sy + y);
      if (c) t.set(x, y, c, TILESET.alpha(sx + x, sy + y));
    }
  return t;
}

type Anim = {
  smoke: { x: number; y: number }[];
  glow: { x: number; y: number; r: number }[];
  ducks: { x: number; y: number }[];
  pigeons: { x: number; y: number }[];
  wave: { look: VillagerLook; x: number; y: number } | null;
  sky: boolean;
};

/** Everything that doesn't move, drawn once per size. */
function compose(scene: Scene, W: number, tod: Tod) {
  const p = new Px(W, H);
  const anim: Anim = { smoke: [], glow: [], ducks: [], pigeons: [], wave: null, sky: true };
  const horizon = H - 34;

  // Indoors: the Barkeep behind his bar, no sky.
  if ("place" in scene && scene.place === "barkeep") {
    anim.sky = false;
    const room = tavernInterior();
    const cx = (BAR.x + BAR.w / 2) * 16;
    const sx = Math.max(0, Math.min(room.w - W, Math.round(cx - W / 2)));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = room.get(sx + x, y + 4);
        p.set(x, y, c ?? "#5b4a3e");
      }
    anim.wave = { look: BARKEEP_LOOK, x: BARKEEP.x * 16 - sx, y: BARKEEP.y * 16 + 4 };
    anim.glow.push({ x: W / 2, y: 26, r: 40 });
    return { p, anim };
  }

  // Sky in four stepped bands with a one-row dither between them.
  const bands = SKY[tod];
  const bandH = Math.ceil(horizon / bands.length);
  for (let y = 0; y < horizon; y++) {
    const b = Math.min(bands.length - 1, Math.floor(y / bandH));
    for (let x = 0; x < W; x++) {
      const edge = y % bandH === 0 && b > 0 && (x + y) % 2 === 0;
      p.set(x, y, edge ? bands[b - 1] : bands[b]);
    }
  }
  if (tod === "night") {
    // a crescent moon
    for (let y = -6; y <= 6; y++)
      for (let x = -6; x <= 6; x++) {
        const inMoon = x * x + y * y <= 30;
        const bite = (x + 3) * (x + 3) + (y - 1) * (y - 1) <= 26;
        if (inMoon && !bite) p.set(W - 34 + x, 14 + y, "#f3ead6");
      }
  }
  // Two rolling hill lines.
  const [far, near] = HILLS[tod];
  for (let x = 0; x < W; x++) {
    const hf = Math.round(horizon - 12 - 5 * Math.sin(x / 29 + 1.3) - 2 * Math.sin(x / 9));
    const hn = Math.round(horizon - 5 - 3 * Math.sin(x / 17 + 4) - Math.sin(x / 5));
    for (let y = hf; y < horizon; y++) p.set(x, y, far);
    for (let y = hn; y < horizon; y++) p.set(x, y, near);
  }

  // Ground: two rows of tiles; paving for places on the square.
  const square =
    "place" in scene && ["well", "board", "tavern", "bank", "tower", "hall"].includes(scene.place);
  for (let tx = 0; tx < W; tx += 16)
    for (const ty of [horizon, horizon + 16, horizon + 32]) {
      if (ty >= H) continue;
      const name = square
        ? hash2(tx, ty, 3) < 0.15
          ? "stone0"
          : "stone0"
        : `grass${hash2(tx, ty, 1) < 0.15 ? 1 : hash2(tx, ty, 2) < 0.3 ? 2 : 0}`;
      p.blit(tile(name), tx, ty);
      if (square && hash2(tx, ty, 9) < 0.18) p.blit(tile(hash2(tx, ty, 8) < 0.5 ? "moss" : "crack"), tx, ty);
      if (!square && hash2(tx, ty, 6) < 0.12)
        p.blit(tile(hash2(tx, ty, 7) < 0.6 ? "flowers" : "tuft"), tx, ty);
    }
  // A path (or brick avenue) running up to the door.
  const mid = Math.floor(W / 32) * 16;
  if (!("place" in scene && scene.place === "pond"))
    for (const ty of [horizon + 16, horizon + 32])
      if (ty < H) p.blit(tile(square ? "brick10" : "path10"), mid, ty);

  // The building, centred, its base on the ground.
  const base = H - 6;
  let main: Px | null = null;
  let mainY = 0;
  const side: { kind: Parameters<typeof B.prop>[0] }[] = [];
  const glowAt = (x: number, y: number, r = 14) => anim.glow.push({ x, y, r });
  const now = new Date();
  if ("place" in scene) {
    switch (scene.place) {
      case "well":
        main = B.well(4, true);
        side.push({ kind: "bench" }, { kind: "lamp" }, { kind: "planter" }, { kind: "planterTree" });
        anim.pigeons.push(
          { x: W / 2 - 40, y: base },
          { x: W / 2 + 34, y: base - 2 },
          { x: W / 2 + 46, y: base },
        );
        break;
      case "board":
        main = B.noticeBoard(7);
        side.push({ kind: "lamp" }, { kind: "planter" }, { kind: "bench" }, { kind: "planterTree" });
        break;
      case "tavern":
        main = B.tavern({});
        side.push({ kind: "crates" }, { kind: "barrel" }, { kind: "lamp" }, { kind: "flowerCart" });
        break;
      case "bank":
        main = B.bank();
        side.push({ kind: "lamp" }, { kind: "planter" }, { kind: "planterTree" });
        break;
      case "tower":
        main = B.clockTower(now.getHours(), now.getMinutes());
        side.push({ kind: "planterTree" }, { kind: "lamp" }, { kind: "planter" });
        break;
      case "hall":
        main = B.townHall();
        side.push({ kind: "lamp" }, { kind: "planterTree" }, { kind: "planter" });
        break;
      case "lanterns":
        main = B.lanternRooms([0, 1, 2, 3].map((i) => i < (scene.live ?? 0)));
        side.push({ kind: "tree" }, { kind: "pine" }, { kind: "tree" });
        break;
      case "gate":
        main = B.gate();
        side.push({ kind: "signpost" }, { kind: "tree" }, { kind: "mapStand" }, { kind: "pine" });
        break;
      case "market": {
        const stalls = [
          B.stall("#e8836b", ["#d8c27c", "#6f86b5", "#e8836b"]),
          B.stall("#4fa3a0", ["#e8836b", "#d8c27c"]),
          B.stall("#b86f98", ["#f3ead6", "#f3ead6"]),
        ];
        const total = stalls.length * 48 + 8;
        let x = Math.round(W / 2 - total / 2);
        for (const st of stalls) {
          p.blit(st, x, base - st.h + 2);
          x += 52;
        }
        side.push({ kind: "crates" }, { kind: "tree" }, { kind: "barrel" });
        break;
      }
      case "pond": {
        // water across the foreground, a dock, ducks and the donation lantern
        for (let y = horizon + 6; y < H; y++)
          for (let x = 0; x < W; x++) {
            const r = ((x - W / 2) / (W * 0.46)) ** 2 + ((y - (H + 8)) / 30) ** 2;
            if (r < 1) p.set(x, y, (x * 3 + y * 7) % 23 === 0 ? "#b4d9ee" : "#86bedf");
            else if (r < 1.12) p.set(x, y, "#76a86a");
          }
        for (let x = W / 2 + 30; x < W / 2 + 62; x += 16) p.blit(tile("dock"), x, H - 22);
        const dl = B.prop("donationLantern");
        p.blit(dl, Math.round(W / 2 + 58), H - 22 - dl.h + 4);
        anim.ducks.push(
          { x: W / 2 - 50, y: H - 14 },
          { x: W / 2 - 20, y: H - 9 },
          { x: W / 2 + 8, y: H - 16 },
        );
        side.push({ kind: "tree" }, { kind: "pine" }, { kind: "tree" });
        break;
      }
      case "map":
        main = B.prop("mapStand");
        side.push({ kind: "signpost" }, { kind: "tree" }, { kind: "pine" }, { kind: "tree" });
        break;
    }
  } else if ("guild" in scene) {
    const g = GUILDS.find((x) => x.id === scene.guild);
    if (g) {
      main = B.guildHall(g, ICONS[g.icon], scene.running ?? false);
      if (scene.running) anim.smoke.push({ x: Math.round(W / 2 + main.w / 2 - 16), y: base - main.h + 4 });
    }
    side.push({ kind: "tree" }, { kind: "pine" }, { kind: "tree" }, { kind: "pine" });
  } else {
    const h = scene.hut;
    main = B.hut(h.roof, h.look);
    side.push({ kind: "tree" }, { kind: "pine" }, { kind: "tree" });
  }

  // Side dressing, alternating outward from the centre, back props a little higher.
  const mw = main?.w ?? 150;
  const drawSide = (dir: -1 | 1) => {
    let x = dir < 0 ? W / 2 - mw / 2 - 14 : W / 2 + mw / 2 + 14;
    for (let i = 0; i < 12; i++) {
      const s = side[(i + (dir > 0 ? 1 : 0)) % side.length];
      const a = B.prop(s.kind);
      const ax = Math.round(dir < 0 ? x - a.w : x);
      if (ax + a.w < -4 || ax > W + 4) break;
      p.blit(a, ax, base - a.h - (i % 2) * 3 + 1);
      if (s.kind === "lamp" && tod !== "day")
        glowAt(ax + Math.floor(a.w / 2), base - a.h - (i % 2) * 3 + 6, 16);
      x += dir * (a.w + 18 + Math.floor(hash2(i, dir, 5) * 14));
    }
  };
  drawSide(-1);
  drawSide(1);

  if (main) {
    const mx = Math.round(W / 2 - main.w / 2);
    // the tower is seen from below: show its clock, let the base run off the bottom
    mainY = "place" in scene && scene.place === "tower" ? 2 : base - main.h + 2;
    p.blit(main, mx, mainY);
    if ("place" in scene) {
      if (scene.place === "tavern") {
        anim.smoke.push({ x: mx + main.w - 18, y: mainY + 2 });
        for (const wx of [16, 34, main.w - 34, main.w - 16]) glowAt(mx + wx, mainY + 44, 12);
        anim.wave = { look: BARKEEP_LOOK, x: mx + main.w / 2 + 14, y: base - 30 };
      }
      if (scene.place === "lanterns")
        for (let r = 0; r < Math.min(4, scene.live ?? 0); r++) glowAt(mx + r * 32 + 25, mainY + 30, 12);
      if (scene.place === "board")
        anim.wave = { look: lookFromSeed("reader-at-the-board"), x: mx + main.w + 2, y: base - 30 };
    }
    if ("hut" in scene) {
      const h = scene.hut;
      const win = h.presence === "free" ? "lit" : h.presence === "afk" ? "curtains" : "dark";
      p.blit(B.hutWindow(win), mx + 10, mainY + 30);
      if (h.presence === "busy" || h.presence === "session")
        p.blit(B.doorSign(h.presence === "session" ? "lesson" : "closed"), mx + 25, mainY + 32);
      const g = B.gardenItem(h.look.garden);
      p.blit(g, mx + 2, mainY + 47 - g.h);
      if (h.presence === "free") {
        glowAt(mx + 15, mainY + 34, 14);
        anim.smoke.push({ x: mx + 36, y: mainY + 4 });
      }
      if (h.kitty)
        p.blit(
          fieldKitty(h.kitty, "down", h.presence === "away" || h.presence === "offline" ? "sleep" : "sit", 0),
          mx + 34,
          mainY + 33,
        );
      if (h.mailbox) {
        const mb = B.prop("signpost");
        p.blit(mb, mx + main.w + 2, mainY + 47 - mb.h);
      }
      if (h.villager) anim.wave = { look: h.villager, x: mx - 18, y: base - 30 };
    }
  }
  return { p, anim };
}

function toCanvas(p: Px) {
  const c = document.createElement("canvas");
  c.width = p.w;
  c.height = p.h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.w, p.h), 0, 0);
  return c;
}

export function PlaceBanner({ scene, className }: { scene: Scene; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(scene);
  useEffect(() => {
    const canvas = ref.current;
    const box = wrap.current;
    if (!canvas || !box) return;
    const sc: Scene = JSON.parse(key);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let timer = 0;
    let base: HTMLCanvasElement | null = null;
    let anim: Anim | null = null;
    let W = 0;
    let tod: Tod = timeOfDay();
    const sprites = new Map<string, HTMLCanvasElement>();
    const sprite = (k: string, make: () => Px) => {
      let c = sprites.get(k);
      if (!c) {
        c = toCanvas(make());
        sprites.set(k, c);
      }
      return c;
    };
    const stars = Array.from({ length: 34 }, (_, i) => ({
      x: hash2(i, 1, 81),
      y: hash2(i, 2, 83),
      tw: hash2(i, 3, 85),
    }));
    const build = () => {
      W = Math.max(160, Math.ceil(box.clientWidth / S));
      canvas.width = W;
      canvas.height = H;
      // whole-pixel scale only: the canvas is exactly W × 2 wide and the frame clips the last pixel or two
      canvas.style.width = `${W * S}px`;
      tod = timeOfDay();
      const r = compose(sc, W, tod);
      base = toCanvas(r.p);
      anim = r.anim;
    };
    let f = 0;
    const draw = () => {
      if (!base || !anim) return;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(base, 0, 0);
      const t = f / 8;
      if (anim.sky && tod === "night")
        for (const s of stars) {
          if ((f + Math.floor(s.tw * 40)) % 40 < 3) continue; // a slow twinkle
          ctx.fillStyle = s.tw > 0.8 ? "#ffe3a1" : "#f3ead6";
          ctx.fillRect(Math.floor(s.x * W), Math.floor(s.y * (H - 46)), 1, 1);
        }
      if (anim.sky && tod !== "night") {
        // three clouds drifting east, wrapping
        ctx.fillStyle = tod === "dusk" ? "#f6d9c4" : "#fbf6ec";
        for (let i = 0; i < 3; i++) {
          const cx = Math.floor(((i * 137 + t * 2.2) % (W + 60)) - 30);
          const cy = 8 + i * 9;
          ctx.fillRect(cx, cy, 22, 4);
          ctx.fillRect(cx + 4, cy - 3, 12, 3);
          ctx.fillRect(cx + 14, cy - 2, 6, 2);
        }
      }
      // birds now and then on clear days
      if (anim.sky && tod === "day" && f % 160 < 70) {
        const bx = Math.floor(((f % 160) / 70) * (W + 20)) - 10;
        ctx.drawImage(
          sprite(`bird${Math.floor(f / 3) % 2}`, () => critter("bird", Math.floor(f / 3) % 2)),
          bx,
          18 + Math.floor(Math.sin(f / 5) * 2),
        );
      }
      for (const d of anim.ducks)
        ctx.drawImage(
          sprite(`duck${Math.floor(f / 6) % 2}`, () => critter("duck", Math.floor(f / 6) % 2)),
          Math.round(d.x + Math.sin(t / 2 + d.x) * 4),
          d.y,
        );
      for (const pg of anim.pigeons) {
        const fr = Math.floor((f + pg.x) / 7) % 2;
        ctx.drawImage(
          sprite(`pigeon${fr}`, () => critter("pigeon", fr)),
          Math.round(pg.x),
          pg.y - 8,
        );
      }
      if (anim.wave) {
        const fr = reduced ? 0 : Math.floor(f / 4) % 3;
        const look = anim.wave.look;
        ctx.drawImage(
          sprite(`v:${JSON.stringify(look)}:${fr}`, () =>
            villagerFrame(look, "down", f % 48 < 18 ? "wave" : "idle", fr),
          ),
          Math.round(anim.wave.x),
          anim.wave.y,
        );
      }
      for (const s of anim.smoke)
        for (let k = 0; k < 3; k++) {
          const life = ((t * 6 + k * 13) % 39) / 39;
          ctx.globalAlpha = 0.7 * (1 - life);
          ctx.fillStyle = "#e9e4ee";
          const sz = 2 + Math.floor(life * 3);
          ctx.fillRect(
            Math.round(s.x + Math.sin(life * 6 + k) * 2 + life * 6),
            Math.round(s.y - life * 26),
            sz,
            sz,
          );
        }
      ctx.globalAlpha = 1;
      if (tod !== "day") {
        // night lies over the ground and buildings; warm light punches through
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = tod === "night" ? "rgba(58,50,96,0.5)" : "rgba(160,110,140,0.22)";
        ctx.fillRect(0, anim.sky ? H - 46 : 0, W, H);
        ctx.globalCompositeOperation = "lighter";
        for (const g of anim.glow) {
          if (g.r <= 0) continue;
          for (let i = 3; i >= 1; i--) {
            ctx.fillStyle = `rgba(255,227,161,${0.09 * (4 - i)})`;
            ctx.beginPath();
            ctx.arc(g.x, g.y, (g.r * i) / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalCompositeOperation = "source-over";
      }
      f++;
    };
    build();
    draw();
    const ro = new ResizeObserver(() => {
      build();
      draw();
    });
    ro.observe(box);
    if (!reduced) {
      const loop = () => {
        draw();
        timer = window.setTimeout(() => {
          raf = requestAnimationFrame(loop);
        }, 1000 / 8);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [key]);
  return (
    <div ref={wrap} aria-hidden className={`overflow-hidden ${className ?? ""}`}>
      <canvas ref={ref} className="block h-[160px]" style={{ imageRendering: "pixelated" }} />
    </div>
  );
}
