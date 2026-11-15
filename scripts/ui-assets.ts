import { mkdirSync, writeFileSync } from "node:fs";
import { encodePng } from "./png";

/**
 * 9-slice panel and button frames (SkillSwap Village UI §10.3): 2 px ink border with stepped — not rounded —
 * corners, filled with the panel's colour. Slice = 4 px. Run: npx tsx scripts/ui-assets.ts
 */
const INK = [0x2b, 0x1b, 0x33, 255];
const FILLS: Record<string, number[]> = {
  paper: [0xfb, 0xf6, 0xec, 255],
  "paper-shade": [0xea, 0xdf, 0xcb, 255],
  lantern: [0xf2, 0xb3, 0x3d, 255],
  // the hanging sign a sheet's title is painted on
  wood: [0xe2, 0xc7, 0x9a, 255],
};
// 9 × 9: 4 px corners, 1 px stretchable middle. X = ink, . = transparent, f = fill.
const ART = [
  "..XXXXX..",
  ".XXXXXXX.",
  "XXfffffXX",
  "XXfffffXX",
  "XXfffffXX",
  "XXfffffXX",
  "XXfffffXX",
  ".XXXXXXX.",
  "..XXXXX..",
];
mkdirSync("public/ui", { recursive: true });
for (const [name, fill] of Object.entries(FILLS)) {
  const px = new Uint8Array(9 * 9 * 4);
  ART.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = ch === "X" ? INK : ch === "f" ? fill : [0, 0, 0, 0];
      px.set(c, (y * 9 + x) * 4);
    });
  });
  writeFileSync(`public/ui/frame-${name}.png`, encodePng(9, 9, px));
}

/**
 * Paper grain: a 48 × 48 tile of sparse fibres and specks, a few percent of the pixels, so a large sheet
 * reads as paper without a visible repeat. Drawn under the frame (background-clip: padding-box).
 */
{
  const N = 48;
  const px = new Uint8Array(N * N * 4);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const put = (x: number, y: number, c: number[], a: number) =>
    px.set([c[0], c[1], c[2], a], (((y + N) % N) * N + ((x + N) % N)) * 4);
  const SHADE = [0xea, 0xdf, 0xcb];
  const WARM = [0xf3, 0xea, 0xd8];
  const SPECK = [0x2b, 0x1b, 0x33];
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * N);
    const y = Math.floor(rnd() * N);
    // short horizontal fibres
    const len = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < len; k++) put(x + k, y, rnd() < 0.5 ? SHADE : WARM, 255);
  }
  for (let i = 0; i < 9; i++) put(Math.floor(rnd() * N), Math.floor(rnd() * N), SPECK, 26);
  writeFileSync("public/ui/paper-grain.png", encodePng(N, N, px));
}
console.log("wrote public/ui/frame-{paper,paper-shade,lantern,wood}.png and paper-grain.png");
