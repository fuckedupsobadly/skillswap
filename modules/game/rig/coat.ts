import type { Genome } from "../genome";
import type { Coat, CoatFn, Role } from "./raster";

export type View = "front" | "side" | "curl";

/** Deterministic lattice hash in [0, 1). */
function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise: bilinear between lattice hashes, for calico and tortoiseshell patches. */
function noise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
}

/**
 * Coat for one pixel. Patterns use part-local coordinates (nx, ny in −1..1, t along limbs), which is what the
 * spec's UV layer does: one drawing per pose, every pattern wraps onto it.
 * Pattern indices: 0 solid, 1 tabby, 2 spotted, 3 tuxedo, 4 bicolor, 5 calico, 6 tortoiseshell, 7 colorpoint.
 * Markings: 0 none, 1 muzzle, 2 chest, 3 socks, 4 blaze, 5 muzzle and chest.
 */
export function coatFor(g: Genome, view: View): CoatFn {
  const L = g.layout;
  const p = g.pattern;
  const muzzle = g.markings === 1 || g.markings === 5 || p === 3;
  const chest = g.markings === 2 || g.markings === 5 || p === 3;
  const socks = g.markings === 3 || p === 3 || p === 4;
  const blaze = g.markings === 4;

  const isMuzzle = (role: Role, nx: number, ny: number) => {
    if (role !== "head") return false;
    if (view === "side") return nx > 0.18 && ny > 0.05;
    return ny > 0.12 && Math.abs(nx) < 0.38 + (ny - 0.12) * 0.45;
  };
  const isChest = (role: Role, nx: number, ny: number) => {
    if (role !== "body") return false;
    if (view === "side") return nx > 0.42 && ny > -0.25;
    if (view === "curl") return false;
    return Math.abs(nx) < (p === 3 ? 0.5 : 0.36) && ny < (p === 3 ? 0.9 : 0.45);
  };
  const isBlaze = (role: Role, x: number, nx: number, ny: number, cx: number) => {
    if (role !== "head") return false;
    if (view === "side") return nx > 0.6 && ny < 0.15 && ny > -0.75;
    return Math.abs(x + 0.5 - cx) < 1.01 && ny < 0.2 && ny > -0.95;
  };

  return (role, x, y, nx, ny, t, m) => {
    let c: Coat = "fur";

    switch (p) {
      case 1: {
        // Tabby: forehead "M", cheek bars, rings on legs and tail, curved bands on the body sides.
        if (role === "head" && view !== "curl") {
          const dx = Math.round(x + 0.5 - m.cx);
          if (view === "front") {
            if (ny < -0.32 && [-3, 0, 3].includes(dx + (dx >= 0 ? 0 : 1) - (L % 2))) c = "pattern";
            if (Math.abs(nx) > 0.72 && (Math.round(y - m.cy) === 1 || Math.round(y - m.cy) === 3))
              c = "pattern";
          } else if (ny < -0.4 && (Math.round(x) + L) % 3 === 0) c = "pattern";
        }
        if (role === "body") {
          if (view === "front" && Math.abs(nx) > 0.4 && (y + L) % 3 === 0) c = "pattern";
          if (view !== "front" && ny < 0.55 && (Math.round(x + ny * 2) + L) % 4 === 0) c = "pattern";
        }
        if (role === "leg" && (y + L) % 3 === 0 && ny < 0.6) c = "pattern";
        if (role === "tail" && Math.floor(t * m.len + L) % 3 === 0) c = "pattern";
        break;
      }
      case 2: {
        // Spotted: small spots on a 4 px grid, placed by hash, never on the face.
        if (role === "body" || role === "leg" || role === "tail" || (role === "head" && ny < -0.45)) {
          const gx = Math.floor((x + L * 2) / 4);
          const gy = Math.floor((y + L) / 4);
          const lx = (x + L * 2) % 4;
          const ly = (y + L) % 4;
          if (hash(gx, gy, 7 + L) < 0.55 && lx >= 1 && lx <= 2 && ly >= 1 && ly <= 2 && (lx + ly) % 3 !== 0)
            c = "pattern";
        }
        break;
      }
      case 4: {
        // Bicolor: white below, colour above.
        if (role === "leg" || role === "paw") c = "white";
        if (role === "body" && ny > (view === "front" ? 0.05 : 0.15)) c = "white";
        if (role === "head" && view !== "side" && ny > 0.25) c = "white";
        if (role === "head" && view === "side" && ny > 0.2 && nx > 0) c = "white";
        break;
      }
      case 5: {
        // Calico: a white base with orange and black patches; legs mostly white.
        c = "white";
        if (role !== "leg" && role !== "paw") {
          const n = noise(x / 5 + L * 3.1, y / 5 + L * 1.7, 31 + L);
          if (n < 0.36) c = "patchA";
          else if (n > 0.66) c = "patchB";
          if (role === "head" && ny < -0.2) c = n < 0.5 ? "patchA" : "patchB";
          if (role === "ear") c = nx < 0 ? "patchA" : "patchB";
        }
        break;
      }
      case 6: {
        // Tortoiseshell: mottled black and orange, no white of its own.
        const n = noise(x / 3.5 + L * 2.3, y / 3.5 + L * 0.9, 53 + L) + (hash(x, y, 91 + L) - 0.5) * 0.25;
        c = n < 0.5 ? "patchB" : "patchA";
        break;
      }
      case 7: {
        // Colorpoint: pale body, coloured points — ears, face mask, paws, lower legs, tail.
        if (role === "ear" || role === "tail" || role === "paw") c = "pattern";
        if (role === "leg" && ny > -0.1) c = "pattern";
        if (role === "head" && view === "front" && Math.abs(nx) < 0.55 && ny > -0.3) c = "pattern";
        if (role === "head" && view === "side" && nx > 0.1 && ny > -0.35) c = "pattern";
        if (role === "head" && view === "curl" && nx < 0.2) c = "pattern";
        break;
      }
      default:
        break;
    }

    // White markings on top of the pattern.
    if (muzzle && isMuzzle(role, nx, ny)) c = "white";
    if (chest && isChest(role, nx, ny)) c = "white";
    if (socks && (role === "paw" || (role === "leg" && (ny > 0.25 || t > 0.6)))) c = "white";
    if (blaze && isBlaze(role, x, nx, ny, m.cx)) c = "white";
    if (p === 3 && role === "body" && view === "front" && ny > 0.2 && Math.abs(nx) < 0.6) c = "white";
    return c;
  };
}
