import type { Genome, Stage } from "../genome";
import { K } from "../palette";
import { coatFor, type View } from "./coat";
import { type Anchors, Canvas, type Frame, GROUND_Y, type Part } from "./raster";

/** Proportions per growth stage: kittens have big heads and short legs; adults are taller and calmer. */
type StageParams = {
  headRx: number;
  headRy: number;
  bodyRx: number;
  bodyRy: number;
  ear: number;
  eyeW: number;
  eyeH: number;
  eyeGap: number;
  sBodyRx: number;
  sBodyRy: number;
  sHeadRx: number;
  sHeadRy: number;
  leg: number;
  tail: number;
};

const STAGES: Record<Stage, StageParams> = {
  kitten: {
    headRx: 10.5,
    headRy: 7.8,
    bodyRx: 7.2,
    bodyRy: 6.2,
    ear: 4.6,
    eyeW: 3,
    eyeH: 3,
    eyeGap: 3,
    sBodyRx: 8.5,
    sBodyRy: 4.8,
    sHeadRx: 6.6,
    sHeadRy: 5.8,
    leg: 4.2,
    tail: 1,
  },
  young: {
    headRx: 10,
    headRy: 7.4,
    bodyRx: 8.2,
    bodyRy: 7.6,
    ear: 5,
    eyeW: 3,
    eyeH: 3,
    eyeGap: 3,
    sBodyRx: 10,
    sBodyRy: 5.2,
    sHeadRx: 6.2,
    sHeadRy: 5.5,
    leg: 5.4,
    tail: 1.2,
  },
  adult: {
    headRx: 9.6,
    headRy: 7.2,
    bodyRx: 9.2,
    bodyRy: 9,
    ear: 5.2,
    eyeW: 2,
    eyeH: 3,
    eyeGap: 3,
    sBodyRx: 11.2,
    sBodyRy: 5.8,
    sHeadRx: 6,
    sHeadRy: 5.4,
    leg: 6.2,
    tail: 1.35,
  },
};

export type Eyes = "open" | "half" | "closed" | "happy" | "down" | "wide";
export type Mouth = "none" | "smile" | "open" | "yawn" | "lick" | "chew";

export type FrontPose = {
  view: "front";
  bob?: number;
  squash?: number;
  headDx?: number;
  headDy?: number;
  eyes?: Eyes;
  mouth?: Mouth;
  pawL?: number;
  pawR?: number;
  groom?: number;
  tail?: number;
  ears?: "up" | "back" | "perk";
  loaf?: boolean;
  shake?: number;
};

export type SideLeg = { dx: number; lift: number };
export type SidePose = {
  view: "side";
  bob?: number;
  crouch?: number;
  stretch?: number;
  headDx?: number;
  headDy?: number;
  eyes?: Eyes;
  mouth?: Mouth;
  legs?: { nf: SideLeg; ff: SideLeg; nb: SideLeg; fb: SideLeg };
  tail?: "up" | "back" | "low" | "curl" | "wrap";
  tailTip?: number;
  ears?: "up" | "back";
  loaf?: boolean;
  tilt?: number;
};

export type CurlPose = { view: "curl"; breath?: number; earTwitch?: boolean };
export type Pose = FrontPose | SidePose | CurlPose;

const r = Math.round;

// ── Face details ────────────────────────────────────────────────────────────

function drawEye(c: Canvas, x0: number, y0: number, w: number, h: number, state: Eyes, iris: number) {
  const row = (y: number, keys: number[]) => {
    keys.forEach((k, i) => {
      c.put(x0 + i, y0 + y, k);
    });
  };
  const P = K.pupil;
  const fill = (k: number) => new Array(w).fill(k);
  switch (state) {
    case "closed":
      row(h - 2, fill(K.outline));
      break;
    case "happy": // ^ ^
      row(
        h - 2,
        w === 3
          ? [K.outline, -1, K.outline].map((k) => (k === -1 ? c.get(x0 + 1, y0 + h - 2) : k))
          : fill(K.outline),
      );
      if (w === 3) c.put(x0 + 1, y0 + h - 3, K.outline);
      break;
    case "half":
      row(h - 2, fill(P));
      row(h - 1, fill(iris));
      row(h - 3, fill(K.outline));
      break;
    case "down":
      row(h - 1, fill(P));
      row(h - 2, fill(K.outline));
      break;
    default: {
      for (let y = 0; y < h - 1; y++) row(y, fill(P));
      row(h - 1, fill(iris));
      c.put(x0, y0, K.eyeLight);
      if (state === "wide" && w === 3) c.put(x0 + 2, y0 + 1, K.eyeLight);
    }
  }
}

function frontFace(c: Canvas, S: StageParams, hx: number, hy: number, pose: FrontPose, odd: boolean) {
  const eyes = pose.eyes ?? "open";
  const top = r(hy - 1);
  const lx = r(hx - S.eyeGap - S.eyeW);
  const rx = r(hx + S.eyeGap);
  drawEye(c, lx, top, S.eyeW, S.eyeH, eyes, K.iris);
  drawEye(c, rx, top, S.eyeW, S.eyeH, eyes, odd ? K.iris2 : K.iris);
  const ny = top + S.eyeH;
  // Cheeks under the outer corner of each eye.
  c.put(lx - 1, ny, K.cheek);
  c.put(lx, ny, K.cheek);
  c.put(rx + S.eyeW - 1, ny, K.cheek);
  c.put(rx + S.eyeW, ny, K.cheek);
  // Nose: two pixels on the centre line.
  const cx = r(hx);
  c.put(cx - 1, ny, K.nose);
  c.put(cx, ny, K.nose);
  const m = pose.mouth ?? "smile";
  if (m === "smile" || m === "lick" || m === "chew") {
    // The little ":3" mouth: down from the nose, out to each side.
    c.put(cx - 2, ny + 1, K.outline);
    c.put(cx + 1, ny + 1, K.outline);
    if (m === "chew") c.put(cx - 1, ny + 1, K.outline);
    if (m === "lick") {
      c.put(cx - 1, ny + 1, K.tongue);
      c.put(cx, ny + 1, K.tongue);
    }
  } else if (m === "open") {
    c.put(cx - 1, ny + 1, K.mouth);
    c.put(cx, ny + 1, K.mouth);
    c.put(cx - 1, ny + 2, K.tongue);
    c.put(cx, ny + 2, K.tongue);
  } else if (m === "yawn") {
    for (let y = 1; y <= 3; y++)
      for (let x = -2; x <= 1; x++) c.put(cx + x, ny + y, y === 3 && x > -2 && x < 1 ? K.tongue : K.mouth);
    c.put(cx - 2, ny + 3, K.outline);
    c.put(cx + 1, ny + 3, K.outline);
  }
}

function earInner(c: Canvas, tip: [number, number], a: [number, number], b: [number, number], inset: number) {
  // Pink inside the ear: the triangle shrunk toward its centroid.
  const gx = (tip[0] + a[0] + b[0]) / 3;
  const gy = (tip[1] + a[1] + b[1]) / 3 + 0.6;
  const s = (p: [number, number]): [number, number] => [gx + (p[0] - gx) * inset, gy + (p[1] - gy) * inset];
  const [t, u, v] = [s(tip), s(a), s(b)];
  const minX = Math.floor(Math.min(t[0], u[0], v[0]));
  const maxX = Math.ceil(Math.max(t[0], u[0], v[0]));
  const minY = Math.floor(Math.min(t[1], u[1], v[1]));
  const maxY = Math.ceil(Math.max(t[1], u[1], v[1]));
  const sign = (p: number[], q: number[], w: number[]) =>
    (p[0] - w[0]) * (q[1] - w[1]) - (q[0] - w[0]) * (p[1] - w[1]);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5];
      const d1 = sign(p, t, u);
      const d2 = sign(p, u, v);
      const d3 = sign(p, v, t);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos) && c.partAt(x, y)?.role === "ear") c.put(x, y, K.earInner);
    }
  }
}

// ── Front (sitting) ─────────────────────────────────────────────────────────

function front(g: Genome, S: StageParams, pose: FrontPose): Frame {
  const c = new Canvas();
  const round = g.body === 1;
  const loaf = pose.loaf ?? false;
  const shake = pose.shake ?? 0;
  const bRy = S.bodyRy + (pose.squash ?? 0) - (loaf ? 1.6 : 0);
  // Taller stages hop less high, so the ear tips always stay inside the 48 px frame.
  const restEarTop =
    GROUND_Y + 1 - 2 * bRy + (loaf ? 4.2 : 3.4) - 2 * S.headRy + (pose.headDy ?? 0) - S.ear * 1.15;
  const bob = Math.max(pose.bob ?? 0, 1.5 - restEarTop);
  const bRx = S.bodyRx + (round ? 1 : 0) + (loaf ? 2 : 0);
  const cx = 24 + shake;
  const bCy = GROUND_Y + 1 - bRy + bob;
  const hx = cx + (pose.headDx ?? 0);
  const hy = bCy - bRy + (loaf ? 4.2 : 3.4) - S.headRy + (pose.headDy ?? 0);
  const fluffy = g.tail === 1;
  const bobTail = g.tail === 2;
  const parts: Part[] = [];

  // Tail curls up the right side, behind the body.
  const flick = pose.tail ?? 0;
  const tx = cx + bRx * 0.55;
  const tailPts: [number, number][] = bobTail
    ? [
        [tx, GROUND_Y - 0.5 + bob],
        [tx + 3, GROUND_Y - 2 + bob],
      ]
    : [
        [tx, GROUND_Y - 0.5 + bob],
        [cx + bRx + 2.5, GROUND_Y - 1.5 + bob],
        [cx + bRx + 4, GROUND_Y - 5 * S.tail + bob],
        [cx + bRx + 3.5 + flick * 1.6, GROUND_Y - 8.5 * S.tail + bob - Math.abs(flick)],
      ];
  if (!loaf)
    parts.push({
      role: "tail",
      group: "tail",
      z: 0,
      shape: { kind: "capsule", pts: tailPts, r: fluffy ? 2 : 1.45 },
    });

  parts.push({
    role: "body",
    group: "body",
    z: 1,
    shape: { kind: "ellipse", cx, cy: bCy, rx: bRx, ry: bRy },
  });
  // Haunches give the sitting body its pear shape.
  for (const s of [-1, 1]) {
    parts.push({
      role: "body",
      group: "body",
      z: 1,
      shape: { kind: "ellipse", cx: cx + s * bRx * 0.62, cy: GROUND_Y - 1.6 + bob, rx: 3.4, ry: 3 },
    });
  }
  if (!loaf) {
    // Front legs and paws. A raised paw (knead, groom) lifts off the ground.
    // Legs merge into the chest (same group as the body); only the paws get their own outline.
    const legX = Math.max(2.1, bRx * 0.31);
    const sides: [number, number][] = [
      [-1, pose.pawL ?? 0],
      [1, pose.pawR ?? 0],
    ];
    for (const [s, lift] of sides) {
      const grooming = s === 1 && (pose.groom ?? 0) > 0;
      const px = grooming ? hx + 2.2 : cx + s * legX;
      const py = grooming ? hy + S.headRy * 0.55 : GROUND_Y - 0.9 - lift + bob;
      parts.push({
        role: "leg",
        group: grooming ? "legR" : "body",
        z: grooming ? 5 : 2, // a grooming paw comes up in front of the face
        shape: {
          kind: "capsule",
          pts: [
            [cx + s * legX, bCy + bRy * 0.05],
            [px, py],
          ],
          r: 1.6,
        },
      });
      parts.push({
        role: "paw",
        group: s < 0 ? "pawL" : "pawR",
        z: grooming ? 5.1 : 2.1,
        shape: { kind: "ellipse", cx: px, cy: py + 0.2, rx: 2.1, ry: 1.45 },
      });
    }
  }

  // Head and ears (one group, so ears merge into the head with no seam).
  const ear =
    S.ear * (g.ears === 2 ? 0.55 : 1) * (pose.ears === "back" ? 0.75 : pose.ears === "perk" ? 1.12 : 1);
  const earPolys: { tip: [number, number]; a: [number, number]; b: [number, number] }[] = [];
  for (const s of [-1, 1]) {
    const a: [number, number] = [hx + s * S.headRx * 0.94, hy - S.headRy * 0.12];
    const b: [number, number] = [hx + s * S.headRx * 0.16, hy - S.headRy * 0.92];
    let tip: [number, number] = [hx + s * S.headRx * 0.74, hy - S.headRy - ear];
    if (g.ears === 2) tip = [hx + s * S.headRx * 1.02, hy - S.headRy * 0.72]; // folded forward and down
    if (pose.ears === "back") tip = [tip[0] + s * 1.6, tip[1] + 1.2];
    earPolys.push({ tip, a, b });
    parts.push({ role: "ear", group: "head", z: 3, shape: { kind: "poly", pts: [a, tip, b] } });
    if (g.ears === 1)
      parts.push({
        role: "ear",
        group: "head",
        z: 3,
        shape: { kind: "capsule", pts: [tip, [tip[0], tip[1] - 1.6]], r: 0.5 },
      });
  }
  parts.push({
    role: "head",
    group: "head",
    z: 4,
    shape: { kind: "ellipse", cx: hx, cy: hy, rx: S.headRx, ry: S.headRy },
  });
  // Fluffy cheeks: the classic wide kitten face.
  for (const s of [-1, 1]) {
    parts.push({
      role: "head",
      group: "head",
      z: 4,
      shape: {
        kind: "ellipse",
        cx: hx + s * S.headRx * 0.62,
        cy: hy + S.headRy * 0.42,
        rx: S.headRx * 0.48,
        ry: S.headRy * 0.5,
      },
    });
  }

  for (const p of parts) c.add(p);
  c.paint(coatFor(g, "front"));
  if (g.ears !== 2) for (const e of earPolys) earInner(c, e.tip, e.a, e.b, 0.48);
  if (!loaf) {
    // A soft crease between the front legs instead of a hard outline.
    for (let y = r(bCy + bRy * 0.35); y <= GROUND_Y - 2 + r(bob); y++) {
      const k = c.get(r(cx) - 1, y);
      if (k === K.fur || k === K.furLight) c.put(r(cx) - 1, y, K.furShadow);
      else if (k === K.white) c.put(r(cx) - 1, y, K.whiteShadow);
      else if (k === K.pattern) c.put(r(cx) - 1, y, K.patternShadow);
    }
  }
  frontFace(c, S, hx, hy, pose, g.eyes === 4);
  c.ground(cx, bRx + 3.5);

  const anchors: Anchors = {
    headTop: { x: r(hx), y: r(hy - S.headRy) },
    eyes: { x: r(hx), y: r(hy - 1 + S.eyeH / 2) },
    neck: { x: r(hx), y: r(hy + S.headRy - 0.5) },
    back: { x: r(cx), y: r(bCy - bRy + 1) },
    tailTip: { x: r(tailPts.at(-1)![0]), y: r(tailPts.at(-1)![1]) },
    ground: { x: r(cx), y: GROUND_Y },
    mouth: { x: r(hx), y: r(hy - 1 + S.eyeH + 2) },
  };
  return { keys: c.keys, anchors, facing: 1 };
}

// ── Side (walking, facing right) ────────────────────────────────────────────

const STILL = {
  nf: { dx: 0, lift: 0 },
  ff: { dx: 0, lift: 0 },
  nb: { dx: 0, lift: 0 },
  fb: { dx: 0, lift: 0 },
};

function side(g: Genome, S: StageParams, pose: SidePose): Frame {
  const c = new Canvas();
  const round = g.body === 1;
  const crouch = pose.crouch ?? 0;
  const bob = pose.bob ?? 0;
  const loaf = pose.loaf ?? false;
  const leg = loaf ? 0 : S.leg - crouch;
  const bRx = S.sBodyRx + (pose.stretch ?? 0) + (round ? 0.6 : 0) + (loaf ? 0.8 : 0);
  const bRy = S.sBodyRy + (round ? 0.6 : 0) + (loaf ? 0.9 : 0);
  const bCx = 22;
  const bCy = GROUND_Y + 1 - leg - bRy + bob + (loaf ? 0 : 0.4);
  const tilt = pose.tilt ?? 0;
  const parts: Part[] = [];
  const legs = pose.legs ?? STILL;
  const fluffy = g.tail === 1;

  // Legs: far side behind the body and a shade darker, near side in front.
  if (!loaf) {
    const spots: [keyof typeof legs, number, boolean][] = [
      ["fb", bCx - bRx * 0.5 + 1.4, true],
      ["ff", bCx + bRx * 0.55 + 1.2, true],
      ["nb", bCx - bRx * 0.5, false],
      ["nf", bCx + bRx * 0.55, false],
    ];
    for (const [k, x, far] of spots) {
      const l = legs[k];
      const isBack = k === "fb" || k === "nb";
      const topY = bCy + bRy * 0.25 + (isBack ? tilt : -tilt);
      const footY = Math.min(GROUND_Y - 0.6, GROUND_Y - 0.6 - l.lift + (bob < 0 ? bob * 0.6 : 0));
      parts.push({
        role: "leg",
        group: `leg-${k}`,
        z: far ? 0.5 : 2,
        far,
        shape: {
          kind: "capsule",
          pts: [
            [x, topY],
            [x + l.dx * 0.45, (topY + footY) / 2 + 0.3],
            [x + l.dx, footY],
          ],
          r: 1.35,
        },
      });
    }
  }

  // Tail.
  const tx = bCx - bRx + 1.2;
  const ty = bCy - bRy * 0.3 + tilt;
  const tip = pose.tailTip ?? 0;
  const len = S.tail * (g.tail === 2 ? 0.35 : 1);
  const tails: Record<NonNullable<SidePose["tail"]>, [number, number][]> = {
    up: [
      [tx, ty],
      [tx - 3 * len, ty - 2.5 * len],
      [tx - 3.5 * len, ty - 7 * len],
      [tx - 2 * len + tip, ty - 10 * len],
    ],
    curl: [
      [tx, ty],
      [tx - 3 * len, ty - 3 * len],
      [tx - 2.2 * len, ty - 8 * len],
      [tx + 0.5 * len + tip, ty - 9.5 * len],
    ],
    back: [
      [tx, ty],
      [tx - 3.6 * len, ty - 1.6 * len],
      [tx - 6.6 * len, ty - 3.4 * len + tip],
    ],
    low: [
      [tx, ty],
      [tx - 4 * len, ty + 2.5 * len],
      [tx - 8 * len, ty + 2 * len + tip],
    ],
    wrap: [
      [tx, ty + 3],
      [tx + 2, GROUND_Y - 0.8],
      [tx + 9, GROUND_Y - 0.6],
      [tx + 13 + tip, GROUND_Y - 1.4],
    ],
  };
  const tailPts = tails[pose.tail ?? "up"];
  parts.push({
    role: "tail",
    group: "tail",
    z: pose.tail === "wrap" ? 2.5 : 0.8,
    shape: { kind: "capsule", pts: tailPts, r: fluffy ? 1.9 : 1.35 },
  });

  parts.push({
    role: "body",
    group: "body",
    z: 1,
    shape: { kind: "ellipse", cx: bCx, cy: bCy, rx: bRx, ry: bRy },
  });
  // Rump and chest bulges so the body isn't a plain sausage.
  parts.push({
    role: "body",
    group: "body",
    z: 1,
    shape: { kind: "ellipse", cx: bCx - bRx * 0.55, cy: bCy + tilt * 0.6, rx: bRy * 1.0, ry: bRy * 1.05 },
  });
  parts.push({
    role: "body",
    group: "body",
    z: 1,
    shape: {
      kind: "ellipse",
      cx: bCx + bRx * 0.6,
      cy: bCy - 0.4 - tilt * 0.6,
      rx: bRy * 0.95,
      ry: bRy * 1.0,
    },
  });

  // Head.
  const hx = bCx + bRx - 0.8 + (pose.headDx ?? 0);
  const hy = bCy - bRy * 0.55 - S.sHeadRy * 0.6 + (pose.headDy ?? 0) - tilt;
  const back = pose.ears === "back";
  const earL = S.ear * (g.ears === 2 ? 0.5 : 1);
  const near = {
    a: [hx - 0.6, hy - S.sHeadRy * 0.86] as [number, number],
    b: [hx + 3.4, hy - S.sHeadRy * 0.62] as [number, number],
    tip: [hx + (back ? -1.5 : 0.8), hy - S.sHeadRy - earL + (back ? 1.6 : 0)] as [number, number],
  };
  const far = {
    a: [hx - 4.2, hy - S.sHeadRy * 0.6] as [number, number],
    b: [hx - 1.2, hy - S.sHeadRy * 0.9] as [number, number],
    tip: [hx - (back ? 5.2 : 3.6), hy - S.sHeadRy - earL * 0.85 + (back ? 1.6 : 0)] as [number, number],
  };
  if (g.ears === 2) {
    near.tip = [hx + 2.8, hy - S.sHeadRy * 0.7];
    far.tip = [hx - 1.6, hy - S.sHeadRy * 0.95];
  }
  parts.push({
    role: "ear",
    group: "head",
    z: 2.9,
    far: true,
    shape: { kind: "poly", pts: [far.a, far.tip, far.b] },
  });
  parts.push({
    role: "head",
    group: "head",
    z: 3,
    shape: { kind: "ellipse", cx: hx, cy: hy, rx: S.sHeadRx, ry: S.sHeadRy },
  });
  // Muzzle bump at the front of the face.
  const mx = hx + S.sHeadRx * 0.72;
  const my = hy + S.sHeadRy * 0.32;
  parts.push({
    role: "head",
    group: "head",
    z: 3,
    shape: { kind: "ellipse", cx: mx, cy: my, rx: 2.6, ry: 2.1 },
  });
  parts.push({
    role: "ear",
    group: "head",
    z: 3.1,
    shape: { kind: "poly", pts: [near.a, near.tip, near.b] },
  });
  if (g.ears === 1)
    parts.push({
      role: "ear",
      group: "head",
      z: 3.1,
      shape: { kind: "capsule", pts: [near.tip, [near.tip[0], near.tip[1] - 1.5]], r: 0.5 },
    });

  for (const p of parts) c.add(p);
  c.paint(coatFor(g, "side"));
  if (g.ears !== 2) earInner(c, near.tip, near.a, near.b, 0.45);

  // Face in profile: one eye, nose at the front, a short mouth line, a cheek.
  const ex = r(hx + S.sHeadRx * 0.28);
  const ey = r(hy - 1.6);
  const eyes = pose.eyes ?? "open";
  if (eyes === "closed" || eyes === "happy") {
    c.put(ex, ey + 1, K.outline);
    c.put(ex + 1, ey + 1, K.outline);
  } else if (eyes === "half" || eyes === "down") {
    c.put(ex, ey + 1, K.pupil);
    c.put(ex + 1, ey + 1, K.pupil);
    c.put(ex, ey, K.outline);
    c.put(ex + 1, ey, K.outline);
  } else {
    c.put(ex, ey, K.eyeLight);
    c.put(ex + 1, ey, K.pupil);
    c.put(ex, ey + 1, K.pupil);
    c.put(ex + 1, ey + 1, K.pupil);
    c.put(ex, ey + 2, g.eyes === 4 ? K.iris2 : K.iris);
    c.put(ex + 1, ey + 2, g.eyes === 4 ? K.iris2 : K.iris);
  }
  const noseX = r(mx + 2.1);
  const noseY = r(my - 1.4);
  c.put(noseX, noseY, K.nose);
  if (pose.mouth === "open" || pose.mouth === "yawn") {
    c.put(noseX - 1, noseY + 2, K.mouth);
    c.put(noseX, noseY + 2, K.mouth);
  } else c.put(noseX - 1, noseY + 2, K.outline);
  c.put(r(hx + 0.5), r(hy + 2), K.cheek);
  c.ground(bCx + 1, bRx + 4);

  const tipPt = tailPts.at(-1)!;
  const anchors: Anchors = {
    headTop: { x: r(hx + 0.5), y: r(hy - S.sHeadRy) },
    eyes: { x: ex, y: ey + 1 },
    neck: { x: r(hx - S.sHeadRx * 0.45), y: r(hy + S.sHeadRy * 0.7) },
    back: { x: r(bCx - 1), y: r(bCy - bRy) },
    tailTip: { x: r(tipPt[0]), y: r(tipPt[1]) },
    ground: { x: r(bCx + 1), y: GROUND_Y },
    mouth: { x: r(mx + 1.5), y: r(my + 1) },
  };
  return { keys: c.keys, anchors, facing: 1 };
}

// ── Curled sleep ────────────────────────────────────────────────────────────

function curl(g: Genome, S: StageParams, pose: CurlPose): Frame {
  const c = new Canvas();
  const scale = S === STAGES.kitten ? 0.92 : S === STAGES.young ? 1 : 1.08;
  const breath = pose.breath ?? 0;
  const bRx = 10.5 * scale + (g.body === 1 ? 0.8 : 0);
  const bRy = 4.6 * scale + breath;
  const bCx = 26;
  const bCy = GROUND_Y + 1 - bRy;
  const hx = 17.5 - (scale - 1) * 4;
  const hy = GROUND_Y - 4.6 * scale;
  const hr = 5.6 * scale;
  const ear = 2.8 * scale * (g.ears === 2 ? 0.5 : 1);
  const parts: Part[] = [
    { role: "body", group: "body", z: 1, shape: { kind: "ellipse", cx: bCx, cy: bCy, rx: bRx, ry: bRy } },
    {
      role: "ear",
      group: "head",
      z: 2,
      far: true,
      shape: {
        kind: "poly",
        pts: [
          [hx + 0.5, hy - hr * 0.8],
          [hx + 3.4, hy - hr - ear + (pose.earTwitch ? 1 : 0)],
          [hx + 4.4, hy - hr * 0.45],
        ],
      },
    },
    {
      role: "head",
      group: "head",
      z: 2.2,
      shape: { kind: "ellipse", cx: hx, cy: hy, rx: hr * 1.08, ry: hr * 0.92 },
    },
    {
      role: "ear",
      group: "head",
      z: 2.3,
      shape: {
        kind: "poly",
        pts: [
          [hx - 4.6, hy - hr * 0.3],
          [hx - 3.6, hy - hr - ear],
          [hx - 0.6, hy - hr * 0.86],
        ],
      },
    },
    {
      role: "tail",
      group: "tail",
      z: 3,
      shape: {
        kind: "capsule",
        pts: [
          [bCx + bRx - 1, bCy + 1.2],
          [bCx + bRx * 0.4, GROUND_Y - 0.4],
          [bCx - 3, GROUND_Y - 0.2],
          [hx + 1, GROUND_Y - 0.6],
        ],
        r: g.tail === 1 ? 1.8 : 1.35,
      },
    },
  ];
  if (g.tail === 2) parts.pop();
  for (const p of parts) c.add(p);
  c.paint(coatFor(g, "curl"));
  // Closed eyes: two short arcs, the face turned toward us.
  const ey = r(hy);
  for (const ex of [r(hx - 3), r(hx + 0.5)]) {
    c.put(ex, ey, K.outline);
    c.put(ex + 1, ey + 1, K.outline);
    c.put(ex + 2, ey, K.outline);
  }
  c.put(r(hx - 0.8), ey + 2, K.nose);
  c.put(r(hx - 4), ey + 2, K.cheek);
  c.put(r(hx + 2.5), ey + 2, K.cheek);
  c.ground(bCx - 2, bRx + 5);

  const anchors: Anchors = {
    headTop: { x: r(hx), y: r(hy - hr) },
    eyes: { x: r(hx - 1), y: ey },
    neck: { x: r(hx + 2), y: r(hy + hr * 0.7) },
    back: { x: r(bCx + 2), y: r(bCy - bRy) },
    tailTip: { x: r(hx + 1), y: GROUND_Y - 1 },
    ground: { x: bCx, y: GROUND_Y },
    mouth: { x: r(hx - 1), y: ey + 3 },
  };
  return { keys: c.keys, anchors, facing: 1 };
}

export function draw(g: Genome, stage: Stage, pose: Pose): Frame {
  const S = STAGES[stage];
  if (pose.view === "front") return front(g, S, pose);
  if (pose.view === "side") return side(g, S, pose);
  return curl(g, S, pose);
}

export type { View };
