import { hash2, INK, mix, Px } from "./pixels";

/**
 * The plaza around the Wishing Well: one hand-laid mosaic, drawn per pixel in polar coordinates so the rings
 * and the compass rose stay round at 16 px tiles. Outside in: a stone curb, two rings of radial setts, a plum
 * accent band with studs, a sandstone disc carrying an 8-point compass rose (terracotta to the cardinal
 * points, slate to the diagonals), and the dark footing the well stands on.
 */
const SAND = "#e8d6b2";
const SAND_LINE = "#d6c095";
const SETT = ["#cdc9d6", "#c2bdcd", "#d8d3df", "#b7b2c2"];
const SETT_WARM = ["#e3cfa8", "#d9c39b", "#ecdcbc"];
const MORTAR = "#9893a6";
const CURB_DARK = "#7d7690";
const CURB_LIGHT = "#dcd8e3";
const BAND = "#7d6f9c";
const BAND_STUD = "#b49ad8";
const TERRA = "#c98b6b";
const TERRA_SHADE = "#a86d50";
const SLATE = "#9893a6";
const SLATE_SHADE = "#7d7690";
const OUTLINE = mix(INK, "#9893a6", 0.35);

export const PLAZA_PX = 180; // image size; the radius is 88 px = 5.5 tiles

export function plazaMosaic() {
  const S = PLAZA_PX;
  const c = S / 2;
  const p = new Px(S, S);
  const TAU = Math.PI * 2;
  const star = (x: number, y: number) => {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    // 0 = north, clockwise
    const th = (Math.atan2(x + 0.5 - c, -(y + 0.5 - c)) + TAU) % TAU;
    const q = Math.PI / 2;
    const main = th % q; // offset from the nearest cardinal axis, 0..q
    const aMain = Math.min(main, q - main);
    const diag = (th + q / 2) % q;
    const aDiag = Math.min(diag, q - diag);
    const W = Math.PI / 4;
    const rMain = 57 * (1 - aMain / W) + 10;
    const rDiag = 40 * (1 - aDiag / W) + 10;
    if (d <= rMain && aMain <= aDiag) return { kind: "main" as const, side: main < q / 2 };
    if (d <= rDiag) return { kind: "diag" as const, side: diag < q / 2 };
    return null;
  };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      if (d > 88) continue;
      const th = (Math.atan2(dx, -dy) + TAU) % TAU;
      let col: string;
      if (d > 86) col = CURB_DARK;
      else if (d > 84) col = CURB_LIGHT;
      else if (d > 64) {
        // two rings of radial setts, offset by half a stone, with mortar between
        const outer = d > 74.5;
        if (Math.abs(d - 74.5) < 0.7 || d < 64.8) col = MORTAR;
        else {
          const n = outer ? 56 : 44;
          const f = (th / TAU) * n + (outer ? 0.5 : 0);
          const seg = Math.floor(f);
          if (f - seg < 0.09) col = MORTAR;
          else {
            const pal = outer ? SETT : SETT_WARM;
            col = pal[Math.floor(hash2(seg, outer ? 1 : 2, 71) * pal.length)];
          }
        }
      } else if (d > 60) {
        // the accent band, studded every few degrees
        const f = (th / TAU) * 36;
        col = f - Math.floor(f) < 0.2 && Math.abs(d - 62) < 1 ? BAND_STUD : BAND;
      } else if (d > 22) {
        const st = star(x, y);
        if (st) col = st.kind === "main" ? (st.side ? TERRA : TERRA_SHADE) : st.side ? SLATE : SLATE_SHADE;
        else {
          const f = (th / TAU) * 32;
          col = f - Math.floor(f) < 0.06 || Math.abs(d - 41) < 0.6 ? SAND_LINE : SAND;
        }
      } else col = SLATE_SHADE;
      p.set(x, y, col);
    }
  // outline the rose so it reads at a glance, then a little wear
  const inside = (x: number, y: number) => {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    return d > 22 && d <= 60 && star(x, y) !== null;
  };
  for (let y = 1; y < S - 1; y++)
    for (let x = 1; x < S - 1; x++)
      if (inside(x, y) && (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1)))
        p.set(x, y, OUTLINE);
  // a north tip in ink: the rose points the way to the Guild Quarter
  p.rect(c - 1, c - 67 + 2, 2, 3, INK);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (p.alpha(x, y) === 0) continue;
      const h = hash2(x, y, 73);
      if (h < 0.025) p.set(x, y, mix(p.get(x, y) ?? SAND, "#ffffff", 0.25));
      else if (h > 0.975) p.set(x, y, mix(p.get(x, y) ?? SAND, INK, 0.12));
    }
  return p;
}

const FLAGS = ["#f7f1f7", "#b49ad8", "#e8836b", "#86bedf", "#dba287"];

/** Bunting strung between two lamp heads, sagging in the middle; small triangular flags every 6 px. */
export function bunting(width: number, sag = 7) {
  const h = sag + 8;
  const p = new Px(width, h);
  const yAt = (x: number) => Math.round(sag * (1 - ((x - width / 2) / (width / 2)) ** 2));
  const line = mix(INK, "#9893a6", 0.2);
  for (let x = 0; x < width; x++) p.set(x, yAt(x), line);
  let i = 0;
  for (let x = 4; x < width - 4; x += 6) {
    const y0 = yAt(x + 1) + 1;
    const col = FLAGS[i++ % FLAGS.length];
    p.ascii(x - 1, y0, ["offfo", ".ofo.", "..o.."], { o: INK, f: col });
  }
  return p;
}
