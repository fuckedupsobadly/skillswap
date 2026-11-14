import { door } from "./buildings";
import { hash2, INK, light, mix, Px, shade, T } from "./pixels";
import { C } from "./tiles";

/**
 * Inside The Swapped Mug (§8.3): long tables, a fireplace, the chalkboard by the fire, the Barkeep behind the
 * bar. 20 × 14 tiles. Each proposed swap cycle becomes a table with a chair for everyone in the loop.
 */
export const TAVERN_W = 20;
export const TAVERN_H = 14;
export const BAR = { x: 12, y: 3, w: 7, h: 2 };
export const BARKEEP = { x: 15, y: 3 };
export const FIRE = { x: 1, y: 1, w: 3, h: 3 };
export const CHALK = { x: 5, y: 1, w: 3, h: 2 };
export const EXIT = { x: 9, y: 13 };
export const TABLE_PLOTS = [
  { x: 3, y: 7 },
  { x: 9, y: 7 },
  { x: 15, y: 7 },
  { x: 3, y: 10 },
  { x: 15, y: 10 },
];

export function tavernInterior() {
  const p = new Px(TAVERN_W * T, TAVERN_H * T);
  // floor planks
  for (let y = 4 * T; y < TAVERN_H * T; y++)
    for (let x = 0; x < TAVERN_W * T; x++) {
      const plank = Math.floor((x + (Math.floor(y / 6) % 2) * 9) / 18);
      const seam = y % 6 === 0 || (x + (Math.floor(y / 6) % 2) * 9) % 18 === 0;
      p.set(
        x,
        y,
        seam ? C.woodShade : hash2(plank, Math.floor(y / 6), 3) < 0.5 ? C.wood : light(C.wood, 0.08),
      );
    }
  // wainscot walls
  p.rect(0, 0, TAVERN_W * T, 4 * T, "#c99a64");
  for (let x = 0; x < TAVERN_W * T; x += 8) p.vline(x, 0, 4 * T, "#b5854f");
  p.rect(0, 3 * T, TAVERN_W * T, 6, "#8a5a3c");
  p.hline(0, 4 * T - 1, TAVERN_W * T, INK);
  // windows on the back wall: warm light
  for (const wx of [9 * T, 10 * T + 8]) {
    p.rect(wx, 10, 12, 14, "#ffe3a1");
    p.vline(wx + 6, 10, 14, "#c99a64");
    p.hline(wx - 1, 9, 14, INK)
      .hline(wx - 1, 24, 14, INK)
      .vline(wx - 1, 10, 14, INK)
      .vline(wx + 12, 10, 14, INK);
  }
  // fireplace
  const f = FIRE;
  p.rect(f.x * T, f.y * T - 6, f.w * T, f.h * T + 6, "#a9a2b3");
  for (let y = f.y * T - 6; y < (f.y + f.h) * T; y += 4) p.hline(f.x * T, y, f.w * T, "#8f88a0");
  p.rect(f.x * T + 10, f.y * T + 18, f.w * T - 20, 22, "#3e3346");
  p.hline(f.x * T - 2, f.y * T + 14, f.w * T + 4, "#7f5534");
  // chalkboard by the fire
  const c = CHALK;
  p.rect(c.x * T, c.y * T, c.w * T, c.h * T, "#3e4a44");
  p.hline(c.x * T, c.y * T, c.w * T, "#7f5534").hline(c.x * T, (c.y + c.h) * T - 1, c.w * T, "#7f5534");
  for (let i = 0; i < 4; i++) p.hline(c.x * T + 6, c.y * T + 7 + i * 6, 18 + (i % 2) * 10, "#d6dcd3");
  // the bar
  const b = BAR;
  p.rect(b.x * T, b.y * T + 4, b.w * T, b.h * T - 4, "#8a5a3c");
  p.rect(b.x * T, b.y * T + 4, b.w * T, 5, "#a8774f");
  for (let x = b.x * T + 6; x < (b.x + b.w) * T; x += 14) p.rect(x, b.y * T, 4, 5, "#e8cfa6"); // mugs
  // shelves of bottles behind the bar
  p.hline(b.x * T, 16, b.w * T, "#7f5534");
  for (let x = b.x * T + 3; x < (b.x + b.w) * T; x += 7)
    p.rect(x, 8, 3, 8, ["#6f86b5", "#5e9e57", "#b86f98", "#c98b6b"][Math.floor(x / 7) % 4]);
  // exit door
  door(p, EXIT.x * T + 4, TAVERN_H * T - 13, "#7a4a2f", 24, 12);
  // a rug by the fire
  for (let y = 5 * T; y < 6 * T + 6; y++)
    for (let x = T; x < 4 * T; x++) p.set(x, y, (x + y) % 6 < 3 ? "#b0614b" : shade("#b0614b", 0.2));
  return p;
}

/** A round table with N chairs; your chair is marked by its cushion colour only when you sit. */
export function table() {
  const p = new Px(2 * T, 2 * T);
  for (let y = 0; y < 2 * T; y++)
    for (let x = 0; x < 2 * T; x++) {
      const d = Math.hypot((x - 15.5) / 13, (y - 13) / 9);
      if (d <= 1) p.set(x, y, d > 0.85 ? C.woodShade : (x + y) % 7 === 0 ? light(C.wood, 0.12) : C.wood);
    }
  p.rect(14, 22, 4, 8, C.woodShade);
  p.rect(10, 6, 5, 4, "#e8cfa6"); // a mug
  return p.outline(INK);
}

export function chair() {
  const p = new Px(10, 10);
  p.rect(1, 1, 8, 7, C.wood)
    .hline(1, 1, 8, light(C.wood, 0.25))
    .rect(2, 8, 1, 2, C.woodShade)
    .rect(7, 8, 1, 2, C.woodShade);
  return p.outline(INK);
}

/** Flame frames for the fireplace. */
export function flame(f: number) {
  const p = new Px(20, 14);
  const rows =
    f % 2
      ? ["....o.....", "...ooo..o.", "..oyyoooo.", ".oyyyyyyo.", "oyyrryyryo", "orrrrrrrro"]
      : [".....o....", "..o.ooo...", ".ooyyyyo..", ".oyyyyyyo.", "oyryyrryyo", "orrrrrrrro"];
  p.ascii(5, 6, rows, { o: "#e8836b", y: "#ffe3a1", r: "#c86650" });
  return p;
}

export const tavernBlocked = (x: number, y: number) => {
  if (x < 0 || y < 0 || x >= TAVERN_W || y >= TAVERN_H) return true;
  if (y < 4) return true; // walls
  if (x >= BAR.x && x < BAR.x + BAR.w && y < BAR.y + BAR.h + 1) return true;
  for (const t of TABLE_PLOTS) if (x >= t.x && x < t.x + 2 && y >= t.y && y < t.y + 2) return true;
  return false;
};
export { mix };
