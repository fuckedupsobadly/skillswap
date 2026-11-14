import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, ITEMS } from "@/modules/game/catalog";
import { levelForXp, levelProgress, xpForLevel } from "@/modules/game/curve";
import {
  decode,
  describe as describeGenome,
  encode,
  roll,
  VISIBLE_COMBINATIONS,
} from "@/modules/game/genome";
import { needsAt } from "@/modules/game/needs";
import { KEY_COUNT, paletteFor } from "@/modules/game/palette";
import { RANKS, rankFor, rankIndex, slotsOpen } from "@/modules/game/ranks";
import { ANIM_NAMES, ANIMS, FRAMES_PER_STAGE } from "@/modules/game/rig/anim";
import { ART, ITEM_COLORS, normalize } from "@/modules/game/rig/items";
import { draw } from "@/modules/game/rig/kitty";
import { FRAME } from "@/modules/game/rig/raster";
import { describeRule } from "@/modules/game/rules";
import { sessionXp } from "@/modules/game/xp";

describe("level curve", () => {
  it("matches the spec's anchor values", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(40);
    expect(xpForLevel(5)).toBe(422);
    expect(xpForLevel(10)).toBe(1676);
    expect(xpForLevel(50)).toBe(29881);
  });
  it("level is monotonic and inverse to the curve", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40000 }), (xp) => {
        const n = levelForXp(xp);
        expect(xpForLevel(n)).toBeLessThanOrEqual(xp);
        if (n < 50) expect(xpForLevel(n + 1)).toBeGreaterThan(xp);
        expect(levelForXp(xp + 1)).toBeGreaterThanOrEqual(n);
        const p = levelProgress(xp);
        expect(p.fraction).toBeGreaterThanOrEqual(0);
        expect(p.fraction).toBeLessThanOrEqual(1);
      }),
    );
  });
  it("session XP: 10 per 30 min teaching, 8 learning", () => {
    expect(sessionXp("teacher", 60)).toBe(20);
    expect(sessionXp("learner", 60)).toBe(16);
    expect(sessionXp("teacher", 60, true)).toBe(30);
  });
});

describe("ranks", () => {
  const base = { level: 50, minutesTaught: 0, sessionsTaught: 0, categoriesTaught: 0, trustLevel: 0 };
  it("need teaching, not just levels", () => {
    expect(rankFor(base)).toBe("kitten");
    expect(rankFor({ ...base, sessionsTaught: 1 })).toBe("tabby");
    expect(rankFor({ ...base, sessionsTaught: 20, minutesTaught: 1200, categoriesTaught: 3 })).toBe("puma");
    expect(
      rankFor({ ...base, sessionsTaught: 300, minutesTaught: 12000, categoriesTaught: 5, trustLevel: 3 }),
    ).toBe("lion");
  });
  it("never drop", () => {
    expect(rankFor({ ...base, level: 1 }, "lynx")).toBe("lynx");
  });
  it("open slots grow with rank", () => {
    expect([...slotsOpen("kitten")].sort()).toEqual(["head", "neck", "toy"]);
    expect(slotsOpen("tabby").has("charm")).toBe(true);
    expect(slotsOpen("lynx").has("tail")).toBe(true);
    expect(RANKS.map((r) => r.name)).toEqual([
      "Kitten",
      "Tabby",
      "Alley Cat",
      "Lynx",
      "Puma",
      "Snow Leopard",
      "Lion",
    ]);
    expect(rankIndex("lion")).toBe(6);
  });
});

describe("genome", () => {
  const hex = () => fc.stringMatching(/^[0-9a-f]{64}$/);
  it("is deterministic and round-trips through its code", () => {
    fc.assert(
      fc.property(hex(), (seed) => {
        const g = roll(seed);
        expect(roll(seed)).toEqual(g);
        const code = encode(g);
        expect(code).toMatch(/^v1\.c\d{2}\.p\d\.l\d\.w\d\.e\d\.r\d\.t\d\.b\d\.s\d$/);
        const { personality: _p, ...visible } = decode(code);
        const { personality: _q, ...expected } = g;
        expect(visible).toEqual(expected);
        expect(describeGenome(g).length).toBeGreaterThan(5);
      }),
      { numRuns: 300 },
    );
  });
  it("keeps rare genes rare", () => {
    let odd = 0;
    let folded = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const g = roll(i.toString(16).padStart(8, "0").repeat(8));
      if (g.eyes === 4) odd++;
      if (g.ears === 2) folded++;
    }
    expect(odd / N).toBeLessThan(0.04);
    expect(folded / N).toBeLessThan(0.06);
    expect(odd).toBeGreaterThan(0);
  });
  it("has the spec's 622,080 visible combinations", () => expect(VISIBLE_COMBINATIONS).toBe(622080));
  it("rejects malformed codes", () => {
    expect(() => decode("v1.c99.p0.l0.w0.e0.r0.t0.b0.s0")).toThrow();
    expect(() => decode("hello")).toThrow();
  });
});

describe("needs", () => {
  it("decay while away but never reach zero, and energy recovers", () => {
    const start = { hunger: 1, energy: 0.2, play: 1, affection: 1 };
    const later = needsAt(start, new Date(0), new Date(1000 * 3_600_000));
    expect(later.hunger).toBeGreaterThan(0);
    expect(later.affection).toBeGreaterThan(0);
    expect(later.energy).toBe(1);
  });
});

describe("sprite validation (what the art build step checks)", () => {
  const g = decode("v1.c00.p1.l0.w5.e4.r1.t1.b1.s1");
  it("has the spec's frame counts: about 105 per growth stage", () => {
    expect(FRAMES_PER_STAGE).toBe(105);
    expect(ANIMS.walk.frames.length).toBe(6);
    expect(ANIMS.slowBlink.frames.length).toBe(6);
    expect(ANIMS.groom.frames.length).toBe(8);
  });
  for (const stage of ["kitten", "young", "adult"] as const) {
    it(`${stage}: every frame uses only reserved keys, keeps anchors inside the frame, and has feet on the ground`, () => {
      for (const name of ANIM_NAMES) {
        for (const pose of ANIMS[name].frames) {
          const f = draw(g, stage, pose);
          expect(f.keys.length).toBe(FRAME * FRAME);
          for (const k of f.keys) expect(k).toBeLessThan(KEY_COUNT);
          for (const p of Object.values(f.anchors)) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThan(FRAME);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThan(FRAME);
          }
          expect(f.keys.some((k) => k === 1)).toBe(true); // outlined
        }
      }
    });
  }
  it("every palette key has a colour for every genome", () => {
    for (let coat = 0; coat < 12; coat++)
      for (const pattern of [0, 5, 7])
        for (const eyes of [0, 4]) {
          const p = paletteFor({ coat, pattern, eyes, shade: 1 });
          for (let k = 1; k < KEY_COUNT; k++) expect(p[k][3]).toBeGreaterThan(0);
        }
  });
  it("every catalogue item has art, and art uses only known colours", () => {
    for (const it of ITEMS) {
      const art = ART[it.id];
      expect(art, it.id).toBeDefined();
      for (const sprite of [art.front, art.side, ...(art.frames ?? [])].filter(Boolean) as string[][]) {
        for (const row of normalize(sprite))
          for (const ch of row) if (ch !== ".") expect(ITEM_COLORS[ch], `${it.id}: ${ch}`).toBeDefined();
      }
    }
  });
  it("every achievement rewards a real item, and every rule has a sentence", () => {
    const ids = new Set(ITEMS.map((i) => i.id));
    for (const a of ACHIEVEMENTS) {
      expect(ids.has(a.itemId)).toBe(true);
      expect(describeRule(a.rule)).not.toMatch(/undefined/);
    }
    for (const it of ITEMS) expect(describeRule(it.rule)).not.toMatch(/undefined/);
  });
});
