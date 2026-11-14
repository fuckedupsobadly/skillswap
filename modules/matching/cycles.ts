/**
 * Swap cycles (pure). Members are nodes; an edge A → B means A can teach B something B wants.
 * A cycle A → B → C → A lets everyone teach one session and learn one session, so the net cost is zero.
 */
export type Edge<T = unknown> = { from: string; to: string; score: number; data: T };
export type Graph<T = unknown> = Map<string, Edge<T>[]>;
export type Cycle<T = unknown> = { members: string[]; edges: Edge<T>[]; score: number };

export const MIN_CYCLE = 2;
export const MAX_CYCLE = 5;

/**
 * Keep the best edge per ordered pair, then each node's strongest `maxOutDegree` edges to bound the search.
 * Edges touching `pin` (the member being matched) are never pruned — otherwise a newcomer, whose edges usually
 * score lower than established members', would be cut out of the very search run on their behalf.
 */
export function buildGraph<T>(edges: readonly Edge<T>[], maxOutDegree = 8, pin?: string): Graph<T> {
  const best = new Map<string, Edge<T>>();
  for (const e of edges) {
    if (e.from === e.to || !(e.score > 0)) continue;
    const key = `${e.from}\u0000${e.to}`;
    const cur = best.get(key);
    if (!cur || e.score > cur.score) best.set(key, e);
  }
  const g: Graph<T> = new Map();
  for (const e of best.values()) {
    const list = g.get(e.from) ?? [];
    list.push(e);
    g.set(e.from, list);
  }
  for (const [k, list] of g) {
    list.sort((a, b) => b.score - a.score || a.to.localeCompare(b.to));
    const top = list.slice(0, maxOutDegree);
    const pinned = pin ? list.slice(maxOutDegree).filter((e) => e.from === pin || e.to === pin) : [];
    g.set(k, [...top, ...pinned]);
  }
  return g;
}

/**
 * Depth-limited search for directed cycles of MIN_CYCLE..maxLen members.
 * Without `through`, each cycle is counted once by starting from its smallest id and only visiting larger ids.
 * With `through`, only cycles containing that member are returned (each once, rotated to start there).
 */
export function findCycles<T>(
  g: Graph<T>,
  opts: { maxLen?: number; through?: string; limit?: number } = {},
): Cycle<T>[] {
  const maxLen = Math.min(opts.maxLen ?? MAX_CYCLE, MAX_CYCLE);
  const limit = opts.limit ?? 10_000;
  const out: Cycle<T>[] = [];
  const starts = opts.through ? [opts.through] : [...g.keys()].sort();

  for (const start of starts) {
    const path: string[] = [start];
    const used: Edge<T>[] = [];
    const onPath = new Set([start]);
    const dfs = (node: string) => {
      if (out.length >= limit) return;
      for (const e of g.get(node) ?? []) {
        if (e.to === start) {
          if (path.length >= MIN_CYCLE) {
            const edges = [...used, e];
            out.push({ members: [...path], edges, score: edges.reduce((a, x) => a + x.score, 0) });
          }
          continue;
        }
        if (onPath.has(e.to) || path.length >= maxLen) continue;
        if (!opts.through && e.to < start) continue; // canonical rotation: start is the smallest id
        onPath.add(e.to);
        path.push(e.to);
        used.push(e);
        dfs(e.to);
        used.pop();
        path.pop();
        onPath.delete(e.to);
      }
    };
    dfs(start);
  }
  return out;
}

/** Greedy pass: take cycles by total score, skipping any that reuse a member already placed. */
export function selectCycles<T>(
  cycles: readonly Cycle<T>[],
  exclude: ReadonlySet<string> = new Set(),
): Cycle<T>[] {
  const taken = new Set(exclude);
  const chosen: Cycle<T>[] = [];
  const sorted = [...cycles].sort((a, b) => b.score - a.score || a.members.length - b.members.length);
  for (const c of sorted) {
    if (c.members.some((m) => taken.has(m))) continue;
    for (const m of c.members) taken.add(m);
    chosen.push(c);
  }
  return chosen;
}

/** Rotation-independent identity of a directed cycle. */
export function cycleKey(members: readonly string[]): string {
  let min = 0;
  for (let i = 1; i < members.length; i++) if (members[i] < members[min]) min = i;
  return [...members.slice(min), ...members.slice(0, min)].join(">");
}
