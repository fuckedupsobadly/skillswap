/**
 * A* on the collision grid exported from Tiled (§6.1 click-to-move). 4-directional, matching tile-snapped
 * walking; Manhattan heuristic; binary heap. Returns the path excluding the start, or null.
 */
export type Pt = { x: number; y: number };

export function astar(
  blocked: (x: number, y: number) => boolean,
  w: number,
  h: number,
  from: Pt,
  to: Pt,
  limit = 6000,
): Pt[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (blocked(to.x, to.y)) return null;
  const key = (x: number, y: number) => y * w + x;
  const g = new Map<number, number>([[key(from.x, from.y), 0]]);
  const came = new Map<number, number>();
  const heap: [number, number][] = [[manhattan(from, to), key(from.x, from.y)]];
  const closed = new Set<number>();
  let steps = 0;
  while (heap.length && steps++ < limit) {
    const [, cur] = pop(heap);
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    if (cx === to.x && cy === to.y) {
      const out: Pt[] = [];
      for (let k = cur; k !== key(from.x, from.y); k = came.get(k)!)
        out.unshift({ x: k % w, y: Math.floor(k / w) });
      return out;
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || blocked(nx, ny)) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = (g.get(cur) ?? 0) + 1;
      if (ng < (g.get(nk) ?? Number.POSITIVE_INFINITY)) {
        g.set(nk, ng);
        came.set(nk, cur);
        push(heap, [ng + manhattan({ x: nx, y: ny }, to), nk]);
      }
    }
  }
  return null;
}

/** The nearest walkable tile to a target (for clicking on a building or a person). */
export function nearestFree(
  blocked: (x: number, y: number) => boolean,
  w: number,
  h: number,
  t: Pt,
): Pt | null {
  for (let r = 0; r < 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = t.x + dx;
        const y = t.y + dy;
        if (x >= 0 && y >= 0 && x < w && y < h && !blocked(x, y)) return { x, y };
      }
  return null;
}

const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
const manhattan = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function push(h: [number, number][], v: [number, number]) {
  h.push(v);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h[p][0] <= h[i][0]) break;
    [h[p], h[i]] = [h[i], h[p]];
    i = p;
  }
}
function pop(h: [number, number][]) {
  const top = h[0];
  const last = h.pop()!;
  if (h.length) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < h.length && h[l][0] < h[m][0]) m = l;
      if (r < h.length && h[r][0] < h[m][0]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]];
      i = m;
    }
  }
  return top;
}
