import { writeFileSync } from "node:fs";
import * as B from "@/modules/village/art/buildings";
import { critter, fieldKitty, lookFromSeed, villagerFrame } from "@/modules/village/art/people";
import type { Px } from "@/modules/village/art/pixels";
import { drawTileset } from "@/modules/village/art/tiles";
import { GUILDS } from "@/modules/village/guilds";
import { ICONS } from "@/ui/pixel/icon-art";
import { encodePng } from "./png";

/** Dev tool: npx tsx scripts/village-sheet.ts out.png — buildings, villagers, critters on one sheet. */
const out = process.argv[2] ?? "village-sheet.png";
const S = 3;
const items: Px[] = [];
items.push(
  B.tavern({}),
  B.bank(),
  B.clockTower(9, 15),
  B.townHall(),
  B.well(4, true),
  B.noticeBoard(7),
  B.lanternRooms([true, false, false, true]),
  B.stall("#e8836b", ["#d8c27c", "#6f86b5"]),
  B.gate(),
);
for (const g of GUILDS) items.push(B.guildHall(g, ICONS[g.icon], g.id === "bards-hall"));
for (const [i, w] of (["lit", "dark", "curtains"] as const).entries()) {
  const h = B.hut(GUILDS[i * 3].roof, { roof: i as 0 | 1 | 2, door: i, garden: i, sign: i });
  h.blit(B.hutWindow(w), 10, 30);
  items.push(h);
}
for (const k of [
  "tree",
  "pine",
  "oven",
  "easel",
  "target",
  "cart",
  "stoneGarden",
  "paperLantern",
  "mapStand",
  "signpost",
  "donationLantern",
  "chalk",
] as const)
  items.push(B.prop(k));
const people: Px[] = [];
for (let i = 0; i < 10; i++) {
  const l = lookFromSeed(`member-${i}`);
  for (const [v, a, f] of [
    ["down", "idle", 0],
    ["down", "walk", 1],
    ["up", "walk", 0],
    ["right", "walk", 1],
    ["down", "wave", 1],
    ["down", "sleep", 0],
    ["down", "read", 0],
    ["right", "point", 1],
    ["down", "sit", 0],
  ] as const)
    people.push(villagerFrame(l, v, a, f));
}
for (const v of ["down", "up", "right"] as const)
  people.push(fieldKitty("v1.c00.p1.l0.w5.e0.r0.t0.b1.s1", v, "walk", 1));
people.push(
  fieldKitty("v1.c01.p1.l0.w0.e0.r0.t0.b1.s1", "down", "sleep", 0),
  critter("chicken", 0),
  critter("duck", 0),
  critter("bird", 0),
);
const tiles = drawTileset();

const W = 1600;
let x = 8;
let y = 8;
let rowH = 0;
const placed: [Px, number, number][] = [];
for (const p of [...items, ...people, tiles]) {
  if (x + p.w * S > W) {
    x = 8;
    y += rowH + 8;
    rowH = 0;
  }
  placed.push([p, x, y]);
  x += p.w * S + 8;
  rowH = Math.max(rowH, p.h * S);
}
const H = y + rowH + 8;
const img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0xa8, 0xcf, 0x8e, 255], i * 4);
for (const [p, ox, oy] of placed)
  for (let j = 0; j < p.h; j++)
    for (let i = 0; i < p.w; i++) {
      const k = (j * p.w + i) * 4;
      const a = p.data[k + 3] / 255;
      if (!a) continue;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const o = ((oy + j * S + sy) * W + ox + i * S + sx) * 4;
          for (let c = 0; c < 3; c++) img[o + c] = p.data[k + c] * a + img[o + c] * (1 - a);
        }
    }
writeFileSync(out, encodePng(W, H, img));
console.log(`wrote ${out} ${W}x${H}`);
