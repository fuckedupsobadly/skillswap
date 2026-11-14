import { describe, expect, it } from "vitest";
import { TAXONOMY } from "@/db/taxonomy";
import { astar, nearestFree } from "@/modules/village/astar";
import { GUILDS } from "@/modules/village/guilds";
import { collisionGrid, MAP_H, MAP_W, PLACES, PLOTS, SPAWN, tiledMap } from "@/modules/village/map";

const block = collisionGrid();
const blocked = (x: number, y: number) => block[y]?.[x] ?? true;

describe("village map", () => {
  it("every place's front step is walkable and reachable on foot from the Gate", () => {
    for (const p of PLACES) {
      expect(blocked(p.front.x, p.front.y), `${p.name} front`).toBe(false);
      expect(astar(blocked, MAP_W, MAP_H, SPAWN, p.front), `${p.name} reachable`).not.toBeNull();
    }
  });
  it("every hut plot's doorstep is reachable", () => {
    for (const pl of PLOTS) {
      const step = { x: pl.x + 1, y: pl.y + 3 };
      expect(blocked(step.x, step.y), `plot ${pl.id}`).toBe(false);
      expect(astar(blocked, MAP_W, MAP_H, SPAWN, step)).not.toBeNull();
    }
  });
  it("the square is a hub: key features are close to the Well", () => {
    const well = { x: 31, y: 24 };
    for (const id of ["board", "tavern", "bank", "tower", "hall"]) {
      const p = PLACES.find((x) => x.id === id)!;
      const path = astar(blocked, MAP_W, MAP_H, well, p.front)!;
      expect(path.length, id).toBeLessThanOrEqual(16);
    }
  });
  it("the Gate is about 8 tiles of walking from the square (onboarding step 4)", () => {
    const path = astar(blocked, MAP_W, MAP_H, SPAWN, { x: 31, y: 33 })!;
    expect(path.length).toBeGreaterThanOrEqual(8);
    expect(path.length).toBeLessThanOrEqual(12);
  });
  it("every category has a building: 13 guild halls plus Market Row cover all 20 categories", () => {
    expect(PLACES.filter((p) => p.kind === "guild")).toHaveLength(13);
    const covered = new Set([...GUILDS.flatMap((g) => g.categories), "career-business"]);
    for (const c of TAXONOMY) expect(covered.has(c.slug), c.slug).toBe(true);
  });
  it("exports valid Tiled JSON", () => {
    const m = tiledMap();
    for (const l of m.layers)
      if (l.type === "tilelayer") expect((l as { data: number[] }).data).toHaveLength(MAP_W * MAP_H);
    expect(m.tilesets[0].tilecount).toBeGreaterThan(50);
  });
  it("A* finds the shortest 4-way path and refuses blocked targets", () => {
    const open = () => false;
    expect(astar(open, 10, 10, { x: 0, y: 0 }, { x: 3, y: 4 })).toHaveLength(7);
    expect(astar((x, y) => x === 5 && y === 5, 10, 10, { x: 0, y: 0 }, { x: 5, y: 5 })).toBeNull();
    expect(nearestFree((x, y) => x === 5 && y === 5, 10, 10, { x: 5, y: 5 })).not.toEqual({ x: 5, y: 5 });
  });
});
