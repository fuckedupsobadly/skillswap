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
console.log("wrote public/ui/frame-{paper,paper-shade,lantern}.png");
