import { seedFromHex, weighted, xoshiro128 } from "./rng";

/**
 * A kitty's genome. Visible genes form a compact versioned code (unique per kitty);
 * personality is hidden and only tilts behaviour.
 */
export const COATS = [
  "Lavender gray",
  "Orange",
  "Cream",
  "Black",
  "White",
  "Brown",
  "Blue-gray",
  "Cinnamon",
  "Fawn",
  "Silver",
  "Chocolate",
  "Smoke",
] as const;
export const PATTERNS = [
  "Solid",
  "Tabby",
  "Spotted",
  "Tuxedo",
  "Bicolor",
  "Calico",
  "Tortoiseshell",
  "Colorpoint",
] as const;
export const MARKINGS = ["None", "Muzzle", "Chest", "Socks", "Blaze", "Muzzle and chest"] as const;
export const EYES = ["Green", "Amber", "Blue", "Copper", "Odd-eyed"] as const;
export const EARS = ["Upright", "Tufted", "Folded"] as const;
export const TAILS = ["Long", "Fluffy", "Short bob"] as const;
export const BODIES = ["Slim", "Round"] as const;
export const SHADES = ["Light", "Normal", "Deep"] as const;
export const LAYOUTS = 4;

/** Weight tables. Odd eyes are 2 %, folded ears 3 %, as the spec says. */
const W = {
  coat: [12, 9, 8, 8, 6, 8, 8, 7, 7, 7, 6, 6],
  pattern: [14, 22, 12, 12, 12, 8, 8, 8],
  layout: [1, 1, 1, 1],
  markings: [26, 16, 16, 14, 10, 18],
  eyes: [30, 30, 20, 18, 2],
  ears: [87, 10, 3],
  tail: [55, 30, 15],
  body: [50, 50],
  shade: [25, 50, 25],
} as const;

export type Personality = {
  playful: number;
  sleepy: number;
  curious: number;
  affectionate: number;
  sassy: number;
};

export type Genome = {
  coat: number;
  pattern: number;
  layout: number;
  markings: number;
  eyes: number;
  ears: number;
  tail: number;
  body: number;
  shade: number;
  personality: Personality;
};

export const TRAITS = ["playful", "sleepy", "curious", "affectionate", "sassy"] as const;

export function roll(seedHex: string): Genome {
  const rand = xoshiro128(seedFromHex(seedHex));
  const g = {
    coat: weighted(rand, W.coat),
    pattern: weighted(rand, W.pattern),
    layout: weighted(rand, W.layout),
    markings: weighted(rand, W.markings),
    eyes: weighted(rand, W.eyes),
    ears: weighted(rand, W.ears),
    tail: weighted(rand, W.tail),
    body: weighted(rand, W.body),
    shade: weighted(rand, W.shade),
  };
  // Tuxedo is white chest, muzzle and paws by definition; calico and bicolor carry their own white.
  if (g.pattern === 3 && g.markings === 0) g.markings = 5;
  const personality = Object.fromEntries(
    TRAITS.map((t) => [t, Math.round(rand() * 100) / 100]),
  ) as Personality;
  return { ...g, personality };
}

/** v1.c03.p2.l1.w5.e0.r0.t1.b1.s2 — the visible part only; it carries a unique index. */
export function encode(g: Omit<Genome, "personality">): string {
  return `v1.c${String(g.coat).padStart(2, "0")}.p${g.pattern}.l${g.layout}.w${g.markings}.e${g.eyes}.r${g.ears}.t${g.tail}.b${g.body}.s${g.shade}`;
}

const CODE = /^v1\.c(\d{2})\.p(\d)\.l(\d)\.w(\d)\.e(\d)\.r(\d)\.t(\d)\.b(\d)\.s(\d)$/;

export function decode(code: string, personality?: Personality): Genome {
  const m = CODE.exec(code);
  if (!m) throw new Error(`bad genome code: ${code}`);
  const [coat, pattern, layout, markings, eyes, ears, tail, body, shade] = m.slice(1).map(Number);
  const limits = [
    COATS.length,
    PATTERNS.length,
    LAYOUTS,
    MARKINGS.length,
    EYES.length,
    EARS.length,
    TAILS.length,
    BODIES.length,
    SHADES.length,
  ];
  [coat, pattern, layout, markings, eyes, ears, tail, body, shade].forEach((v, i) => {
    if (v >= limits[i]) throw new Error(`bad genome code: ${code}`);
  });
  return {
    coat,
    pattern,
    layout,
    markings,
    eyes,
    ears,
    tail,
    body,
    shade,
    personality: personality ?? { playful: 0.5, sleepy: 0.5, curious: 0.5, affectionate: 0.5, sassy: 0.5 },
  };
}

/** Plain-language description, e.g. "Lavender gray tabby, green eyes, tufted ears". */
export function describe(g: Genome): string {
  const coat = COATS[g.coat].toLowerCase();
  const pattern = PATTERNS[g.pattern].toLowerCase();
  const parts = [`${coat.charAt(0).toUpperCase()}${coat.slice(1)} ${g.pattern === 0 ? "solid" : pattern}`];
  parts.push(`${EYES[g.eyes].toLowerCase()} eyes`);
  if (g.ears !== 0) parts.push(`${EARS[g.ears].toLowerCase()} ears`);
  if (g.tail !== 0) parts.push(`${TAILS[g.tail].toLowerCase()} tail`);
  return parts.join(", ");
}

/** Rarity is cosmetic and never for sale; shown so a member knows their kitty is unusual. */
export function rareGenes(g: Genome): string[] {
  const out: string[] = [];
  if (g.eyes === 4) out.push("Odd eyes");
  if (g.ears === 2) out.push("Folded ears");
  if (g.ears === 1) out.push("Tufted ears");
  return out;
}

/** Visible combinations: 12 × 8 × 4 × 6 × 5 × 3 × 3 × 2 × 3 = 622,080. */
export const VISIBLE_COMBINATIONS =
  COATS.length *
  PATTERNS.length *
  LAYOUTS *
  MARKINGS.length *
  EYES.length *
  EARS.length *
  TAILS.length *
  BODIES.length *
  SHADES.length;

export type Stage = "kitten" | "young" | "adult";
export const stageForLevel = (level: number): Stage =>
  level >= 26 ? "adult" : level >= 10 ? "young" : "kitten";
