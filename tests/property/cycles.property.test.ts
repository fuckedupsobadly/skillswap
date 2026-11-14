import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  buildGraph,
  cycleKey,
  type Edge,
  findCycles,
  MAX_CYCLE,
  selectCycles,
} from "@/modules/matching/cycles";

const nodes = ["a", "b", "c", "d", "e", "f", "g", "h"];
const edgesArb = fc.array(
  fc.record({
    from: fc.constantFrom(...nodes),
    to: fc.constantFrom(...nodes),
    score: fc.double({ min: 0.01, max: 1, noNaN: true }),
    data: fc.constant(null),
  }),
  { maxLength: 40 },
);

describe("swap cycle finder", () => {
  it("never repeats a member, never exceeds 5, and every hop is a real edge", () => {
    fc.assert(
      fc.property(edgesArb, (edges: Edge<null>[]) => {
        const g = buildGraph(edges, 8);
        for (const c of findCycles(g)) {
          expect(c.members.length).toBeGreaterThanOrEqual(2);
          expect(c.members.length).toBeLessThanOrEqual(MAX_CYCLE);
          expect(new Set(c.members).size).toBe(c.members.length);
          c.edges.forEach((e, i) => {
            expect(e.from).toBe(c.members[i]);
            expect(e.to).toBe(c.members[(i + 1) % c.members.length]);
            expect(g.get(e.from)?.includes(e)).toBe(true);
          });
        }
      }),
      { numRuns: 500 },
    );
  });

  it("counts each cycle once", () => {
    fc.assert(
      fc.property(edgesArb, (edges: Edge<null>[]) => {
        const keys = findCycles(buildGraph(edges)).map((c) => cycleKey(c.members));
        expect(new Set(keys).size).toBe(keys.length);
      }),
      { numRuns: 500 },
    );
  });

  it("cycles through a member are exactly the global cycles containing that member", () => {
    fc.assert(
      fc.property(edgesArb, fc.constantFrom(...nodes), (edges: Edge<null>[], who) => {
        const g = buildGraph(edges);
        const all = findCycles(g)
          .filter((c) => c.members.includes(who))
          .map((c) => cycleKey(c.members))
          .sort();
        const through = findCycles(g, { through: who })
          .map((c) => cycleKey(c.members))
          .sort();
        expect(through).toEqual(all);
      }),
      { numRuns: 300 },
    );
  });

  it("selected cycles never overlap", () => {
    fc.assert(
      fc.property(edgesArb, (edges: Edge<null>[]) => {
        const chosen = selectCycles(findCycles(buildGraph(edges)));
        const seen = new Set<string>();
        for (const c of chosen)
          for (const m of c.members) {
            expect(seen.has(m)).toBe(false);
            seen.add(m);
          }
      }),
      { numRuns: 500 },
    );
  });
});

describe("pinned member", () => {
  it("keeps a newcomer's low-scoring edges so cycles through them are still found", () => {
    // Teacher t has 10 strong learners and one weak newcomer edge; with pruning at 8 the newcomer would vanish.
    const edges: Edge<null>[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ from: "t", to: `s${i}`, score: 0.9, data: null })),
      { from: "t", to: "new", score: 0.3, data: null },
      { from: "new", to: "t", score: 0.5, data: null },
    ];
    expect(findCycles(buildGraph(edges, 8), { through: "new" })).toHaveLength(0);
    expect(findCycles(buildGraph(edges, 8, "new"), { through: "new" })).toHaveLength(1);
  });
});
