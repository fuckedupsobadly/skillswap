/**
 * Seven ranks. Each needs a level AND real teaching, so nobody reaches the top by only taking lessons.
 * Rank never drops: if XP is revoked the level can fall, but an earned rank stays.
 */
export type RankId = "kitten" | "tabby" | "alley-cat" | "lynx" | "puma" | "snow-leopard" | "lion";
export type Slot = "head" | "neck" | "charm" | "face" | "back" | "tail" | "bed" | "room" | "toy";

export type RankStats = {
  level: number;
  minutesTaught: number;
  sessionsTaught: number;
  categoriesTaught: number;
  trustLevel: number;
};

export const RANKS: {
  id: RankId;
  name: string;
  level: number;
  condition: string;
  met: (s: RankStats) => boolean;
  slots: Slot[];
}[] = [
  { id: "kitten", name: "Kitten", level: 1, condition: "", met: () => true, slots: ["head", "neck", "toy"] },
  {
    id: "tabby",
    name: "Tabby",
    level: 5,
    condition: "1 session taught",
    met: (s) => s.sessionsTaught >= 1,
    slots: ["charm", "bed", "room"],
  },
  {
    id: "alley-cat",
    name: "Alley Cat",
    level: 10,
    condition: "5 h taught",
    met: (s) => s.minutesTaught >= 300,
    slots: ["face", "back"],
  },
  {
    id: "lynx",
    name: "Lynx",
    level: 18,
    condition: "20 h taught",
    met: (s) => s.minutesTaught >= 1200,
    slots: ["tail"],
  },
  {
    id: "puma",
    name: "Puma",
    level: 26,
    condition: "taught in 3 categories",
    met: (s) => s.categoriesTaught >= 3,
    slots: [],
  },
  {
    id: "snow-leopard",
    name: "Snow Leopard",
    level: 35,
    condition: "trust level 3",
    met: (s) => s.trustLevel >= 3,
    slots: [],
  },
  {
    id: "lion",
    name: "Lion",
    level: 45,
    condition: "200 h taught",
    met: (s) => s.minutesTaught >= 12000,
    slots: [],
  },
];

export const rankIndex = (id: RankId) => RANKS.findIndex((r) => r.id === id);
export const rankName = (id: RankId) => RANKS[rankIndex(id)]?.name ?? "Kitten";

/** The highest rank the stats qualify for — but never below the rank already held. */
export function rankFor(stats: RankStats, held: RankId = "kitten"): RankId {
  let best = 0;
  RANKS.forEach((r, i) => {
    if (stats.level >= r.level && r.met(stats)) best = i;
  });
  return RANKS[Math.max(best, rankIndex(held))].id;
}

export function nextRank(current: RankId) {
  return RANKS[rankIndex(current) + 1] ?? null;
}

/** Slots open at a rank: every slot from that rank and all ranks below it. */
export function slotsOpen(rank: RankId): Set<Slot> {
  return new Set(RANKS.slice(0, rankIndex(rank) + 1).flatMap((r) => r.slots));
}
