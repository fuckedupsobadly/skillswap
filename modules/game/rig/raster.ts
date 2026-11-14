import { K } from "../palette";

/**
 * Pixel rig raster: parts are pixel-snapped shapes drawn into a label map in z order, then coloured by role,
 * pattern and lighting, then outlined. Output is a buffer of palette KEYS — never colours — so every kitty,
 * stage and pose shares one drawing and the compositor swaps colours at render time.
 */
export const FRAME = 48;
export const GROUND_Y = 44; // feet sit on row 44

export type Role = "head" | "ear" | "body" | "leg" | "paw" | "tail";

export type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "capsule"; pts: [number, number][]; r: number }
  | { kind: "poly"; pts: [number, number][] };

export type Part = {
  role: Role;
  /** Parts in the same group merge with no line between them (head + ears). */
  group: string;
  z: number;
  shape: Shape;
  /** Far-side limbs are drawn one tone darker. */
  far?: boolean;
};

type Meta = Part & { cx: number; cy: number; rx: number; ry: number; len: number };

export type Point = { x: number; y: number };
export type Anchors = {
  headTop: Point;
  eyes: Point;
  neck: Point;
  back: Point;
  tailTip: Point;
  ground: Point;
  mouth: Point;
};

export type Frame = { keys: Uint8Array; anchors: Anchors; facing: 1 | -1 };

// ── Geometry ────────────────────────────────────────────────────────────────

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const ex = ax + dx * t - px;
  const ey = ay + dy * t - py;
  return { d: Math.hypot(ex, ey), t };
}

function inPoly(x: number, y: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Sample at pixel centres; returns position along the shape (0..1) for capsules, or -1 when outside. */
function hit(s: Shape, x: number, y: number): number {
  const px = x + 0.5;
  const py = y + 0.5;
  if (s.kind === "ellipse") return ((px - s.cx) / s.rx) ** 2 + ((py - s.cy) / s.ry) ** 2 <= 1 ? 0 : -1;
  if (s.kind === "poly") return inPoly(px, py, s.pts) ? 0 : -1;
  let total = 0;
  const lens = s.pts.slice(1).map((p, i) => {
    const l = Math.hypot(p[0] - s.pts[i][0], p[1] - s.pts[i][1]);
    total += l;
    return l;
  });
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    const [ax, ay] = s.pts[i];
    const [bx, by] = s.pts[i + 1];
    const { d, t } = segDist(px, py, ax, ay, bx, by);
    if (d <= s.r) return (acc + t * lens[i]) / (total || 1);
    acc += lens[i];
  }
  return -1;
}

function bounds(s: Shape) {
  if (s.kind === "ellipse") return { cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry, len: 0 };
  const xs = s.pts.map((p) => p[0]);
  const ys = s.pts.map((p) => p[1]);
  const pad = s.kind === "capsule" ? s.r : 0;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  let len = 0;
  for (let i = 1; i < s.pts.length; i++)
    len += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    rx: Math.max(1, (maxX - minX) / 2),
    ry: Math.max(1, (maxY - minY) / 2),
    len,
  };
}

// ── Canvas ──────────────────────────────────────────────────────────────────

/** What a pixel is made of before lighting: plain fur, pattern, white, or a calico/tortie patch. */
export type Coat = "fur" | "pattern" | "white" | "patchA" | "patchB";
export type CoatFn = (
  role: Role,
  x: number,
  y: number,
  nx: number,
  ny: number,
  t: number,
  meta: Meta,
) => Coat;

export class Canvas {
  readonly keys = new Uint8Array(FRAME * FRAME);
  private label = new Int16Array(FRAME * FRAME).fill(-1);
  private along = new Float32Array(FRAME * FRAME);
  private parts: Meta[] = [];

  add(part: Part) {
    const meta: Meta = { ...part, ...bounds(part.shape) };
    const i = this.parts.push(meta) - 1;
    const x0 = Math.max(0, Math.floor(meta.cx - meta.rx - 1));
    const x1 = Math.min(FRAME - 1, Math.ceil(meta.cx + meta.rx + 1));
    const y0 = Math.max(0, Math.floor(meta.cy - meta.ry - 1));
    const y1 = Math.min(FRAME - 1, Math.ceil(meta.cy + meta.ry + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = hit(part.shape, x, y);
        if (t < 0) continue;
        const at = y * FRAME + x;
        const cur = this.label[at];
        if (cur === -1 || this.parts[cur].z <= part.z) {
          this.label[at] = i;
          this.along[at] = t;
        }
      }
    }
    return this;
  }

  partAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= FRAME || y >= FRAME) return null;
    const l = this.label[y * FRAME + x];
    return l === -1 ? null : this.parts[l];
  }

  /** Colour every part pixel by its coat and lighting, then draw the outlines. */
  paint(coat: CoatFn) {
    for (let y = 0; y < FRAME; y++) {
      for (let x = 0; x < FRAME; x++) {
        const at = y * FRAME + x;
        const l = this.label[at];
        if (l === -1) continue;
        const m = this.parts[l];
        const nx = (x + 0.5 - m.cx) / m.rx;
        const ny = (y + 0.5 - m.cy) / m.ry;
        const kind = coat(m.role, x, y, nx, ny, this.along[at], m);
        // Light from the top left: right and bottom edges fall into shadow; a thin warm rim on the top left.
        let light = nx * 0.45 + ny * 0.9;
        if (m.shape.kind === "capsule") light = nx * 0.9 + (m.role === "tail" ? 0 : ny * 0.4);
        const tone = m.far
          ? "shadow"
          : light > 0.62
            ? "shadow"
            : light < -0.82 && m.role !== "paw"
              ? "light"
              : "base";
        this.keys[at] = toneKey(kind, tone);
      }
    }
    // Inner outlines: where a part touches a part in front of it from another group, the back part's edge
    // becomes a 1 px line, so overlapping limbs and the chin read clearly.
    const inner: number[] = [];
    for (let y = 0; y < FRAME; y++) {
      for (let x = 0; x < FRAME; x++) {
        const a = this.partAt(x, y);
        if (!a) continue;
        for (const [dx, dy] of N4) {
          const b = this.partAt(x + dx, y + dy);
          if (b && b.group !== a.group && b.z > a.z) {
            inner.push(y * FRAME + x);
            break;
          }
        }
      }
    }
    for (const at of inner) this.keys[at] = K.outline;
    // Exterior outline: every empty pixel that touches the silhouette (4-neighbours) — a clean 1 px line.
    const outer: number[] = [];
    for (let y = 0; y < FRAME; y++) {
      for (let x = 0; x < FRAME; x++) {
        if (this.label[y * FRAME + x] !== -1) continue;
        if (N4.some(([dx, dy]) => this.partAt(x + dx, y + dy))) outer.push(y * FRAME + x);
      }
    }
    for (const at of outer) this.keys[at] = K.outline;
    return this;
  }

  /** Set one pixel's key (face details, inner ears). Ignores pixels outside the silhouette unless forced. */
  put(x: number, y: number, key: number, force = false) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= FRAME || y >= FRAME) return;
    if (!force && this.label[y * FRAME + x] === -1) return;
    this.keys[y * FRAME + x] = key;
  }

  get(x: number, y: number) {
    return this.keys[Math.round(y) * FRAME + Math.round(x)] ?? 0;
  }

  /** The soft two-tone ground shadow under the feet, drawn only where the cat isn't. */
  ground(cx: number, rx: number) {
    for (let y = GROUND_Y; y <= GROUND_Y + 2; y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - (GROUND_Y + 1)) / 1.6) ** 2;
        if (d > 1 || x < 0 || x >= FRAME || this.keys[y * FRAME + x] !== 0) continue;
        this.keys[y * FRAME + x] = d < 0.45 ? K.ground : K.groundLight;
      }
    }
    return this;
  }
}

const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function toneKey(kind: Coat, tone: "shadow" | "base" | "light") {
  switch (kind) {
    case "pattern":
      return tone === "shadow" ? K.patternShadow : K.pattern;
    case "white":
      return tone === "shadow" ? K.whiteShadow : K.white;
    case "patchA":
      return tone === "shadow" ? K.patchAShadow : K.patchA;
    case "patchB":
      return tone === "shadow" ? K.patchBShadow : K.patchB;
    default:
      return tone === "shadow" ? K.furShadow : tone === "light" ? K.furLight : K.fur;
  }
}

/** Mirror a frame horizontally (side views facing the other way). */
export function mirror(f: Frame): Frame {
  const keys = new Uint8Array(FRAME * FRAME);
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) keys[y * FRAME + x] = f.keys[y * FRAME + (FRAME - 1 - x)];
  const m = (p: Point): Point => ({ x: FRAME - 1 - p.x, y: p.y });
  const a = f.anchors;
  return {
    keys,
    facing: (f.facing * -1) as 1 | -1,
    anchors: {
      headTop: m(a.headTop),
      eyes: m(a.eyes),
      neck: m(a.neck),
      back: m(a.back),
      tailTip: m(a.tailTip),
      ground: m(a.ground),
      mouth: m(a.mouth),
    },
  };
}
