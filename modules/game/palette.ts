import type { Genome } from "./genome";

/**
 * Colour keys. Sprites are drawn with these indices; the compositor maps each to the genome's colours once.
 * One master palette; each kitty uses its own slice for fur, shared colours for face and outline.
 */
export const K = {
  none: 0,
  outline: 1,
  fur: 2,
  furShadow: 3,
  furLight: 4,
  pattern: 5,
  patternShadow: 6,
  white: 7,
  whiteShadow: 8,
  earInner: 9,
  cheek: 10,
  nose: 11,
  iris: 12,
  iris2: 13,
  eyeLight: 14,
  pupil: 15,
  ground: 16,
  groundLight: 17,
  patchA: 18,
  patchAShadow: 19,
  patchB: 20,
  patchBShadow: 21,
  mouth: 22,
  tongue: 23,
} as const;
export const KEY_COUNT = 24;

/** The outline: a single very dark plum, never pure black. Also the interface's ink colour. */
export const PLUM = "#2d2033";

const COAT_BASE = [
  "#b3a9c4",
  "#e9a15b",
  "#eed9b4",
  "#4a4152",
  "#f2eef3",
  "#9c7458",
  "#8e9db3",
  "#c27c55",
  "#d9b79a",
  "#c5c9d3",
  "#6e4c3e",
  "#7c7584",
];
const EYE = ["#7fb86e", "#e3a43b", "#6fa6e0", "#cc7a3e"];

type HSL = [number, number, number];

function hexToHsl(hex: string): HSL {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex([h, s, l]: HSL): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r, g, b]
    .map((v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** Rotate a hue toward a target by a fraction of the shortest arc. */
function toward(h: number, target: number, f: number) {
  const d = ((target - h + 540) % 360) - 180;
  return (h + d * f + 360) % 360;
}

/** Hue-shifted shading: shadows lean purple, highlights lean warm. */
export function shadeOf(hex: string, dl: number, shift = 0.2) {
  const [h, s, l] = hexToHsl(hex);
  // Shadows lean purple but lose a little saturation, so warm coats go rosy-brown rather than red.
  if (dl < 0)
    return hslToHex([toward(h, 275, shift * (s > 0.5 ? 0.6 : 1)), clamp(s * 0.78 + 0.03), clamp(l + dl)]);
  return hslToHex([toward(h, 45, shift), clamp(s * 1.04), clamp(l + dl)]);
}

export function furSlice(coatIdx: number, shadeIdx: number) {
  const shift = [0.07, 0, -0.08][shadeIdx] ?? 0;
  const [h, s, l] = hexToHsl(COAT_BASE[coatIdx]);
  const base = hslToHex([h, s, clamp(l + shift)]);
  const dark = l + shift < 0.35;
  return {
    fur: base,
    furShadow: shadeOf(base, dark ? -0.07 : -0.13),
    furLight: shadeOf(base, dark ? 0.09 : 0.07),
    // Pattern tones stay close to the coat's hue so an orange tabby's stripes read as deep orange, not red.
    pattern: shadeOf(base, dark ? -0.11 : -0.2, 0.06),
    patternShadow: shadeOf(base, dark ? -0.16 : -0.28, 0.1),
  };
}

export type RGBA = [number, number, number, number];
const rgba = (hex: string, a = 255): RGBA => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
};

/** Full key → colour table for one genome. Index = key, value = RGBA. */
export function paletteFor(g: Pick<Genome, "coat" | "shade" | "eyes" | "pattern">): RGBA[] {
  const coat = g.pattern === 7 ? 2 : g.coat; // colorpoint: a pale body; the coat colour goes to the points
  const fur = furSlice(coat, g.shade);
  const points = furSlice(g.coat === 2 || g.coat === 4 ? 5 : g.coat, Math.min(2, g.shade + 1));
  const isPatchy = g.pattern === 5 || g.pattern === 6;
  const orange = furSlice(1, g.shade);
  const black = furSlice(3, 1);
  const p = new Array<RGBA>(24).fill([0, 0, 0, 0]);
  p[K.outline] = rgba(PLUM);
  p[K.fur] = rgba(fur.fur);
  p[K.furShadow] = rgba(fur.furShadow);
  p[K.furLight] = rgba(fur.furLight);
  p[K.pattern] = rgba(g.pattern === 7 ? points.fur : fur.pattern);
  p[K.patternShadow] = rgba(g.pattern === 7 ? points.furShadow : fur.patternShadow);
  p[K.white] = rgba("#f7f3f8");
  p[K.whiteShadow] = rgba("#dcd2e4");
  p[K.earInner] = rgba("#f2a5b8");
  p[K.cheek] = rgba("#f5b3c6");
  p[K.nose] = rgba("#dd7f9c");
  const iris = g.eyes === 4 ? [EYE[2], EYE[1]] : [EYE[g.eyes], EYE[g.eyes]];
  p[K.iris] = rgba(iris[0]);
  p[K.iris2] = rgba(iris[1]);
  p[K.eyeLight] = rgba("#ffffff");
  p[K.pupil] = rgba(PLUM);
  p[K.ground] = rgba("#cfc6da", 150);
  p[K.groundLight] = rgba("#e4ddeb", 120);
  p[K.patchA] = rgba(isPatchy ? orange.fur : fur.pattern);
  p[K.patchAShadow] = rgba(isPatchy ? orange.furShadow : fur.patternShadow);
  p[K.patchB] = rgba(isPatchy ? black.fur : fur.pattern);
  p[K.patchBShadow] = rgba(isPatchy ? black.furShadow : fur.patternShadow);
  p[K.mouth] = rgba("#8c3a5b");
  p[K.tongue] = rgba("#f08aa8");
  return p;
}

export const COAT_SWATCH = (coat: number) => COAT_BASE[coat];
