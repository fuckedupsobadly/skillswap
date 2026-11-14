import { writeFileSync } from "node:fs";
import { decode, type Genome, type Stage } from "@/modules/game/genome";
import { paletteFor } from "@/modules/game/palette";
import { ANIMS, type AnimName } from "@/modules/game/rig/anim";
import { draw } from "@/modules/game/rig/kitty";
import { FRAME } from "@/modules/game/rig/raster";
import { encodePng } from "./png";

/** Dev tool: `npx tsx scripts/kitty-sheet.ts out.png [mode]` — renders a contact sheet of genomes × poses. */
const out = process.argv[2] ?? "kitty-sheet.png";
const mode = process.argv[3] ?? "genomes";
const SCALE = 4;

type Cell = { g: Genome; stage: Stage; anim: AnimName; frame: number };
const cells: Cell[][] = [];
const ref = decode("v1.c00.p1.l0.w5.e0.r0.t0.b1.s1");

if (mode === "genomes") {
  const codes = [
    "v1.c00.p1.l0.w5.e0.r0.t0.b1.s1",
    "v1.c01.p1.l1.w0.e1.r0.t1.b0.s1",
    "v1.c03.p3.l0.w5.e3.r0.t0.b1.s1",
    "v1.c02.p0.l0.w1.e2.r1.t0.b0.s0",
    "v1.c06.p2.l2.w2.e1.r0.t2.b1.s1",
    "v1.c04.p5.l1.w0.e4.r2.t1.b1.s1",
    "v1.c05.p6.l3.w0.e3.r0.t0.b0.s2",
    "v1.c09.p7.l0.w0.e2.r0.t1.b0.s1",
    "v1.c07.p4.l2.w0.e0.r1.t0.b1.s1",
    "v1.c10.p0.l0.w4.e1.r0.t0.b0.s2",
    "v1.c11.p1.l3.w3.e0.r2.t2.b1.s0",
    "v1.c08.p2.l1.w5.e4.r0.t1.b0.s1",
  ];
  const gs = codes.map((c) => decode(c));
  for (const anim of ["idle", "walk", "sleep"] as AnimName[])
    cells.push(gs.map((g) => ({ g, stage: "kitten", anim, frame: 0 })));
} else if (mode === "stages") {
  for (const stage of ["kitten", "young", "adult"] as Stage[]) {
    cells.push(
      (
        [
          "idle",
          "blink",
          "hop",
          "walk",
          "run",
          "stalk",
          "pounce",
          "loaf",
          "sleep",
          "groom",
          "yawn",
          "knead",
        ] as AnimName[]
      ).map((anim) => ({
        g: ref,
        stage,
        anim,
        frame: anim === "hop" ? 2 : anim === "pounce" ? 2 : anim === "yawn" ? 2 : anim === "knead" ? 2 : 0,
      })),
    );
  }
} else {
  // every frame of every animation, kitten stage
  for (const anim of Object.keys(ANIMS) as AnimName[])
    cells.push(ANIMS[anim].frames.map((_, frame) => ({ g: ref, stage: "kitten", anim, frame })));
}

const cols = Math.max(...cells.map((r) => r.length));
const W = cols * FRAME * SCALE;
const H = cells.length * FRAME * SCALE;
const img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([250, 248, 252, 255], i * 4);
cells.forEach((row, ry) => {
  row.forEach((cell, cx) => {
    const anim = ANIMS[cell.anim];
    const f = draw(cell.g, cell.stage, anim.frames[cell.frame]);
    const pal = paletteFor(cell.g);
    for (let y = 0; y < FRAME; y++)
      for (let x = 0; x < FRAME; x++) {
        const k = f.keys[y * FRAME + x];
        if (!k) continue;
        const [r, g, b, a] = pal[k];
        for (let sy = 0; sy < SCALE; sy++)
          for (let sx = 0; sx < SCALE; sx++) {
            const px = ((ry * FRAME + y) * SCALE + sy) * W + (cx * FRAME + x) * SCALE + sx;
            const t = a / 255;
            img[px * 4] = Math.round(r * t + img[px * 4] * (1 - t));
            img[px * 4 + 1] = Math.round(g * t + img[px * 4 + 1] * (1 - t));
            img[px * 4 + 2] = Math.round(b * t + img[px * 4 + 2] * (1 - t));
          }
      }
  });
});
writeFileSync(out, encodePng(W, H, img));
console.log(`wrote ${out} (${cols}×${cells.length})`);
