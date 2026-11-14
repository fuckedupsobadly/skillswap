import { hash2, INK, mix, Px, shade, T } from "./pixels";

/**
 * The village tileset (16 × 16 tiles). Ground kinds get 16 edge variants each (bitmask of which sides touch
 * a different ground: 1 N, 2 E, 4 S, 8 W), so paths, paving and shores draw their own borders.
 */
export const C = {
  grass: "#a8cf8e",
  grassShade: "#76a86a",
  grassLight: "#bddca4",
  path: "#ddbd8f",
  pathShade: "#b9935f",
  pathLight: "#e8cfa6",
  water: "#86bedf",
  waterDeep: "#6aa6cb",
  waterLight: "#b4d9ee",
  stone: "#b7b2c2",
  stoneShade: "#9893a6",
  stoneLight: "#cdc9d6",
  wood: "#a8774f",
  woodShade: "#7f5534",
  woodLight: "#c4946a",
  flowerA: "#e8836b",
  flowerB: "#f7f1f7",
  flowerC: "#b49ad8",
  leaf: "#5e9e57",
  leafShade: "#3f7a41",
};

export type Ground = "grass" | "path" | "stone" | "water" | "dock";

const tiles: { name: string; draw: (p: Px) => void }[] = [];
const index = new Map<string, number>();
const add = (name: string, draw: (p: Px) => void) => {
  index.set(name, tiles.length);
  tiles.push({ name, draw });
};

function grass(p: Px, v: number) {
  p.rect(0, 0, T, T, C.grass);
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(hash2(i, v, 3) * 15);
    const y = Math.floor(hash2(v, i, 5) * 15);
    p.set(x, y, C.grassShade);
    p.set(x + 1, y - 1, C.grassShade);
  }
  for (let i = 0; i < 4; i++)
    p.set(Math.floor(hash2(i, v, 9) * 16), Math.floor(hash2(v, i, 11) * 16), C.grassLight);
  if (v === 1) {
    // a few flowers
    p.set(4, 5, C.flowerB);
    p.set(11, 10, C.flowerA);
    p.set(7, 12, C.flowerB);
  }
}

for (let v = 0; v < 3; v++) add(`grass${v}`, (p) => grass(p, v));

function edged(kind: "path" | "stone" | "water", mask: number) {
  return (p: Px) => {
    if (kind === "path") {
      p.rect(0, 0, T, T, C.path);
      for (let i = 0; i < 6; i++)
        p.set(Math.floor(hash2(i, mask, 13) * 16), Math.floor(hash2(mask, i, 17) * 16), C.pathLight);
      for (let i = 0; i < 4; i++)
        p.set(Math.floor(hash2(i, mask, 19) * 16), Math.floor(hash2(mask, i, 23) * 16), C.pathShade);
      // Grass meets path: an uneven fringe, then a darker lip.
      const fringe = (side: number, at: (i: number, d: number) => [number, number]) => {
        if (!(mask & side)) return;
        for (let i = 0; i < T; i++) {
          const depth = hash2(i, side, mask) < 0.35 ? 2 : 1;
          for (let d = 0; d < depth; d++) p.set(...at(i, d), C.grass);
          p.set(...at(i, depth), C.pathShade);
        }
      };
      fringe(1, (i, d) => [i, d]);
      fringe(4, (i, d) => [i, 15 - d]);
      fringe(8, (i, d) => [d, i]);
      fringe(2, (i, d) => [15 - d, i]);
    } else if (kind === "stone") {
      p.rect(0, 0, T, T, C.stone);
      // Paving: offset slabs.
      for (let y = 0; y < T; y += 4) {
        p.hline(0, y, T, C.stoneShade);
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = off; x < T; x += 8) p.vline(x, y, 4, C.stoneShade);
      }
      for (let i = 0; i < 5; i++)
        p.set(Math.floor(hash2(i, mask, 29) * 16), Math.floor(hash2(mask, i, 31) * 16), C.stoneLight);
      if (mask & 1) p.hline(0, 0, T, INK);
      if (mask & 4) p.hline(0, 15, T, mix(INK, C.stone, 0.4));
      if (mask & 8) p.vline(0, 0, T, mix(INK, C.stone, 0.4));
      if (mask & 2) p.vline(15, 0, T, mix(INK, C.stone, 0.4));
    } else {
      p.rect(0, 0, T, T, C.water);
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(hash2(i, mask, 37) * 12);
        const y = Math.floor(hash2(mask, i, 41) * 14);
        p.hline(x, y, 3, C.waterLight);
      }
      const shore = (side: number, at: (i: number, d: number) => [number, number]) => {
        if (!(mask & side)) return;
        for (let i = 0; i < T; i++) {
          p.set(...at(i, 0), C.grass);
          p.set(...at(i, 1), hash2(i, side, 3) < 0.5 ? C.grass : C.grassShade);
          p.set(...at(i, 2), C.waterDeep);
        }
      };
      shore(1, (i, d) => [i, d]);
      shore(4, (i, d) => [i, 15 - d]);
      shore(8, (i, d) => [d, i]);
      shore(2, (i, d) => [15 - d, i]);
    }
  };
}

for (const kind of ["path", "stone", "water"] as const)
  for (let m = 0; m < 16; m++) add(`${kind}${m}`, edged(kind, m));

add("dock", (p) => {
  p.rect(0, 0, T, T, C.wood);
  for (let y = 0; y < T; y += 4) p.hline(0, y, T, C.woodShade);
  for (let y = 1; y < T; y += 4) p.hline(0, y, T, C.woodLight);
  p.set(3, 2, INK);
  p.set(12, 10, INK);
});

// Worn grass: the desire lines. 1 light, 2 patchy, 3 a real dirt path.
for (const level of [1, 2, 3]) {
  add(`wear${level}`, (p) => {
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const h = hash2(x, y, 51);
        const d = Math.hypot(x - 7.5, y - 7.5) / 10;
        if (h < level * 0.28 - d * 0.2)
          p.set(x, y, h < level * 0.12 ? C.pathShade : C.path, level === 3 ? 255 : 210);
      }
  });
}

// Decor (drawn on a transparent tile above the ground).
add("flowers", (p) => {
  const spots: [number, number, string][] = [
    [3, 4, C.flowerA],
    [9, 3, C.flowerB],
    [12, 9, C.flowerC],
    [5, 11, C.flowerB],
    [10, 13, C.flowerA],
  ];
  for (const [x, y, c] of spots) {
    p.set(x, y + 1, C.leafShade);
    p.set(x - 1, y, c);
    p.set(x + 1, y, c);
    p.set(x, y - 1, c);
    p.set(x, y, mix(c, "#fff4d6", 0.5));
  }
});
add("bush", (p) => {
  const rows = [
    "....oooooo......",
    "..ooggggggoo....",
    ".oggglgggggoo...",
    ".ogglllggggggo..",
    "oggggggggggshgo.",
    "ogggggggggsggo..",
    ".oggggggsssgo...",
    "..oosssssoo.....",
    "....oooooo......",
  ];
  p.ascii(1, 5, rows, { o: INK, g: C.leaf, l: mix(C.leaf, "#fff4d6", 0.3), s: C.leafShade, h: C.flowerA });
});
add("rock", (p) => {
  p.ascii(4, 8, ["..oooo..", ".otttto.", "otltttso", "ottttsso", ".oooooo."], {
    o: INK,
    t: C.stone,
    l: C.stoneLight,
    s: C.stoneShade,
  });
});
add("tuft", (p) => {
  for (const [x, y] of [
    [4, 9],
    [6, 8],
    [8, 10],
    [11, 7],
  ])
    p.vline(x, y, 3, C.grassShade);
});
add("fenceH", (p) => {
  p.rect(0, 6, T, 2, C.wood).hline(0, 5, T, INK).hline(0, 8, T, INK);
  p.rect(0, 10, T, 2, C.wood).hline(0, 9, T, INK).hline(0, 12, T, INK);
  p.rect(6, 3, 3, 12, C.woodLight)
    .vline(5, 3, 12, INK)
    .vline(9, 3, 12, INK)
    .hline(5, 2, 5, INK)
    .hline(5, 15, 5, INK);
});
add("fenceV", (p) => {
  p.rect(6, 0, 3, T, C.wood).vline(5, 0, T, INK).vline(9, 0, T, INK);
});
add("stepstone", (p) => {
  p.ascii(3, 4, ["..ooo..", ".ottto.", "otllsto", ".oooo.."], {
    o: mix(INK, C.stone, 0.3),
    t: C.stone,
    l: C.stoneLight,
    s: C.stoneShade,
  });
  p.ascii(8, 9, ["..ooo..", ".ottto.", "otltsto", ".oooo.."], {
    o: mix(INK, C.stone, 0.3),
    t: C.stone,
    l: C.stoneLight,
    s: C.stoneShade,
  });
});

export const TILESET_COLUMNS = 16;
export const TILE_COUNT = tiles.length;
export const tileIndex = (name: string) => {
  const i = index.get(name);
  if (i === undefined) throw new Error(`unknown tile ${name}`);
  return i;
};
/** Tiled gid = index + firstgid (1). */
export const gid = (name: string) => tileIndex(name) + 1;

/** The whole tileset as one image (what Tiled and Phaser load). */
export function drawTileset() {
  const rows = Math.ceil(tiles.length / TILESET_COLUMNS);
  const out = new Px(TILESET_COLUMNS * T, rows * T);
  tiles.forEach((t, i) => {
    const p = new Px(T, T);
    t.draw(p);
    out.blit(p, (i % TILESET_COLUMNS) * T, Math.floor(i / TILESET_COLUMNS) * T);
  });
  return out;
}

export { shade };
