/**
 * Pixel buffer shared by the build script (Tiled tileset PNG) and the browser (runtime textures).
 * No DOM, no canvas: plain RGBA bytes, so the same drawing code runs everywhere and is unit-testable.
 */
export const INK = "#2b1b33";

export class Px {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, color: string | null, alpha = 255): this {
    x = Math.round(x);
    y = Math.round(y);
    if (!color || x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const [r, g, b] = rgb(color);
    const i = (y * this.w + x) * 4;
    if (alpha >= 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
      return this;
    } else {
      const a = alpha / 255;
      const da = this.data[i + 3] / 255;
      const oa = a + da * (1 - a);
      if (oa === 0) return this;
      this.data[i] = (r * a + this.data[i] * da * (1 - a)) / oa;
      this.data[i + 1] = (g * a + this.data[i + 1] * da * (1 - a)) / oa;
      this.data[i + 2] = (b * a + this.data[i + 2] * da * (1 - a)) / oa;
      this.data[i + 3] = oa * 255;
    }
    return this;
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    if (this.data[i + 3] === 0) return null;
    return `#${[this.data[i], this.data[i + 1], this.data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  alpha(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color, alpha);
    return this;
  }

  hline(x: number, y: number, w: number, color: string) {
    return this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: string) {
    return this.rect(x, y, 1, h, color);
  }

  /** Draw ASCII art: each character maps to a colour (or null to skip). */
  ascii(x0: number, y0: number, rows: readonly string[], pal: Record<string, string | null>, flip = false) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = pal[row[x]];
        if (c) this.set(x0 + (flip ? row.length - 1 - x : x), y0 + y, c);
      }
    });
    return this;
  }

  /** 1 px ink outline around every opaque pixel (4-neighbours), like the kitty reference. */
  outline(color = INK) {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue;
        if (
          this.alpha(x + 1, y) > 0 ||
          this.alpha(x - 1, y) > 0 ||
          this.alpha(x, y + 1) > 0 ||
          this.alpha(x, y - 1) > 0
        )
          add.push(x, y);
      }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], color);
    return this;
  }

  blit(src: Px, x0: number, y0: number, flip = false) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const sx = flip ? src.w - 1 - x : x;
        const i = (y * src.w + sx) * 4;
        const a = src.data[i + 3];
        if (!a) continue;
        const hex = `#${[src.data[i], src.data[i + 1], src.data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
        this.set(x0 + x, y0 + y, hex, a);
      }
    return this;
  }

  clone() {
    const p = new Px(this.w, this.h);
    p.data.set(this.data);
    return p;
  }
}

const RGB = new Map<string, [number, number, number]>();
export function rgb(hex: string): [number, number, number] {
  let v = RGB.get(hex);
  if (!v) {
    const n = Number.parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    RGB.set(hex, v);
  }
  return v;
}

/** Mix two colours (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

/** Hue-shifted shade, the kitty reference's rule: shadows lean purple, highlights lean warm. */
export const shade = (c: string, t = 0.22) => mix(c, "#3a2a55", t);
export const light = (c: string, t = 0.22) => mix(c, "#fff4d6", t);

/** Deterministic hash → 0..1, for stable per-tile variation. */
export function hash2(x: number, y: number, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const T = 16; // world tile size
