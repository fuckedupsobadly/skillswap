import type { Slot } from "./ranks";
import type { Rule } from "./rules";

export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export type Item = {
  id: string;
  slot: Slot;
  name: string;
  rule: Rule;
  rarity: Rarity;
  animated?: boolean;
  effect?: boolean;
};

/**
 * Items are earned, never bought: by level, by rank, by achievements, by teaching in a category, and by
 * season. So a kitty's outfit tells other members what its owner actually does.
 */
export const ITEMS: Item[] = [
  // Level track: one item every 5 levels.
  { id: "scarf", slot: "neck", name: "Striped scarf", rule: { type: "level", level: 5 }, rarity: "common" },
  { id: "beanie", slot: "head", name: "Beanie", rule: { type: "level", level: 10 }, rarity: "common" },
  {
    id: "backpack",
    slot: "back",
    name: "Tiny backpack",
    rule: { type: "level", level: 15 },
    rarity: "common",
  },
  { id: "bow-tie", slot: "neck", name: "Bow tie", rule: { type: "level", level: 20 }, rarity: "uncommon" },
  {
    id: "glasses",
    slot: "face",
    name: "Round glasses",
    rule: { type: "level", level: 25 },
    rarity: "uncommon",
  },
  { id: "cape", slot: "back", name: "Cape", rule: { type: "level", level: 30 }, rarity: "rare" },
  { id: "sunglasses", slot: "face", name: "Sunglasses", rule: { type: "level", level: 35 }, rarity: "rare" },
  { id: "ribbon", slot: "tail", name: "Tail ribbon", rule: { type: "level", level: 40 }, rarity: "rare" },
  { id: "monocle", slot: "face", name: "Monocle", rule: { type: "level", level: 45 }, rarity: "legendary" },
  {
    id: "pom-pom",
    slot: "tail",
    name: "Golden pom-pom",
    rule: { type: "level", level: 50 },
    rarity: "legendary",
  },
  // Early toys, so play has something to chase from the start.
  { id: "mouse", slot: "toy", name: "Toy mouse", rule: { type: "level", level: 3 }, rarity: "common" },
  { id: "feather", slot: "toy", name: "Feather wand", rule: { type: "level", level: 8 }, rarity: "common" },
  // Rank signatures.
  {
    id: "cardboard-box",
    slot: "bed",
    name: "Cardboard box",
    rule: { type: "rank", rank: "tabby" },
    rarity: "common",
  },
  { id: "window", slot: "room", name: "Window", rule: { type: "rank", rank: "tabby" }, rarity: "common" },
  { id: "rug", slot: "room", name: "Rug", rule: { type: "rank", rank: "alley-cat" }, rarity: "uncommon" },
  {
    id: "animated-bell",
    slot: "charm",
    name: "Shimmering bell",
    rule: { type: "rank", rank: "lynx" },
    rarity: "rare",
    animated: true,
  },
  {
    id: "sparkle",
    slot: "tail",
    name: "Tail sparkle",
    rule: { type: "rank", rank: "snow-leopard" },
    rarity: "legendary",
    animated: true,
    effect: true,
  },
  { id: "crown", slot: "head", name: "Crown", rule: { type: "rank", rank: "lion" }, rarity: "legendary" },
  // Teaching a category: 5 h taught unlocks its themed item.
  {
    id: "chef-hat",
    slot: "head",
    name: "Chef hat",
    rule: { type: "category_hours", category: "cooking-food", minutes: 300 },
    rarity: "uncommon",
  },
  {
    id: "headphones",
    slot: "head",
    name: "Headphones",
    rule: { type: "category_hours", category: "music", minutes: 300 },
    rarity: "uncommon",
  },
  {
    id: "laptop",
    slot: "back",
    name: "Tiny laptop",
    rule: { type: "category_hours", category: "tech-coding", minutes: 300 },
    rarity: "uncommon",
  },
  {
    id: "beret",
    slot: "head",
    name: "Beret",
    rule: { type: "category_hours", category: "design-creative", minutes: 300 },
    rarity: "uncommon",
  },
  {
    id: "sweatband",
    slot: "head",
    name: "Sweatband",
    rule: { type: "category_hours", category: "fitness-sports", minutes: 300 },
    rarity: "uncommon",
  },
  {
    id: "tool-belt",
    slot: "back",
    name: "Tool belt",
    rule: { type: "category_hours", category: "home-diy", minutes: 300 },
    rarity: "uncommon",
  },
  {
    id: "grad-cap",
    slot: "head",
    name: "Graduation cap",
    rule: { type: "category_hours", category: "academic", minutes: 300 },
    rarity: "uncommon",
  },
  {
    id: "flower-crown",
    slot: "head",
    name: "Flower crown",
    rule: { type: "category_hours", category: "garden-outdoors", minutes: 300 },
    rarity: "uncommon",
  },
  {
    id: "globe-charm",
    slot: "charm",
    name: "Globe charm",
    rule: {
      type: "any",
      rules: [
        { type: "achievement", id: "polyglot-paws" },
        { type: "category_hours", category: "languages", minutes: 300 },
      ],
    },
    rarity: "uncommon",
  },
  // Achievement rewards.
  {
    id: "yarn",
    slot: "toy",
    name: "Yarn ball",
    rule: { type: "achievement", id: "first-paw" },
    rarity: "common",
  },
  {
    id: "bell",
    slot: "charm",
    name: "Bell",
    rule: { type: "achievement", id: "first-lesson-given" },
    rarity: "common",
  },
  {
    id: "chain-charm",
    slot: "charm",
    name: "Chain-link charm",
    rule: { type: "achievement", id: "full-circle" },
    rarity: "uncommon",
  },
  {
    id: "patchwork-scarf",
    slot: "neck",
    name: "Patchwork scarf",
    rule: { type: "achievement", id: "jack-of-all-trades" },
    rarity: "rare",
  },
  {
    id: "pocket-watch",
    slot: "charm",
    name: "Pocket watch",
    rule: { type: "achievement", id: "reliable" },
    rarity: "rare",
  },
  {
    id: "heart-bandana",
    slot: "neck",
    name: "Heart bandana",
    rule: { type: "achievement", id: "kind-words" },
    rarity: "uncommon",
  },
  {
    id: "star-charm",
    slot: "charm",
    name: "Star charm",
    rule: { type: "achievement", id: "crowd-favorite" },
    rarity: "uncommon",
  },
  {
    id: "megaphone",
    slot: "back",
    name: "Tiny megaphone",
    rule: { type: "achievement", id: "group-leader" },
    rarity: "rare",
  },
  {
    id: "heart-bell",
    slot: "charm",
    name: "Heart bell",
    rule: { type: "achievement", id: "open-paws" },
    rarity: "uncommon",
  },
  {
    id: "scales-charm",
    slot: "charm",
    name: "Scales charm",
    rule: { type: "achievement", id: "fair-judge" },
    rarity: "rare",
  },
  {
    id: "sunrise-window",
    slot: "room",
    name: "Sunrise window",
    rule: { type: "achievement", id: "early-bird" },
    rarity: "uncommon",
  },
  {
    id: "moon-window",
    slot: "room",
    name: "Moon window",
    rule: { type: "achievement", id: "night-owl" },
    rarity: "uncommon",
  },
  {
    id: "gold-whiskers",
    slot: "face",
    name: "Gold whiskers",
    rule: { type: "achievement", id: "mentors-mentor" },
    rarity: "legendary",
    effect: true,
  },
  {
    id: "cushion",
    slot: "bed",
    name: "Cushion",
    rule: { type: "achievement", id: "cat-whisperer" },
    rarity: "uncommon",
  },
  {
    id: "map-backpack",
    slot: "back",
    name: "Map backpack",
    rule: { type: "achievement", id: "explorer" },
    rarity: "uncommon",
  },
  // Milestones for the room and bed.
  {
    id: "basket",
    slot: "bed",
    name: "Basket",
    rule: { type: "settled_sessions", count: 10 },
    rarity: "common",
  },
  {
    id: "plant",
    slot: "room",
    name: "Plant",
    rule: { type: "settled_sessions", count: 25 },
    rarity: "common",
  },
  {
    id: "bookshelf",
    slot: "room",
    name: "Bookshelf",
    rule: { type: "settled_sessions", count: 50 },
    rarity: "uncommon",
  },
  // Seasonal sets: they return every year.
  {
    id: "winter-scarf",
    slot: "neck",
    name: "Winter scarf",
    rule: { type: "season", season: "winter" },
    rarity: "uncommon",
  },
  {
    id: "wings",
    slot: "back",
    name: "Spring wings",
    rule: { type: "season", season: "spring" },
    rarity: "uncommon",
  },
  {
    id: "straw-hat",
    slot: "head",
    name: "Straw hat",
    rule: { type: "season", season: "summer" },
    rarity: "uncommon",
  },
  {
    id: "leaf-hat",
    slot: "head",
    name: "Autumn leaf hat",
    rule: { type: "season", season: "autumn" },
    rarity: "uncommon",
  },
];

export type Achievement = { id: string; name: string; rule: Rule; itemId: string };

/** Achievements reward breadth, kindness and reliability, not grinding. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-paw", name: "First Paw", rule: { type: "settled_sessions", count: 1 }, itemId: "yarn" },
  {
    id: "first-lesson-given",
    name: "First Lesson Given",
    rule: { type: "settled_sessions", role: "teacher", count: 1 },
    itemId: "bell",
  },
  {
    id: "full-circle",
    name: "Full Circle",
    rule: { type: "cycles_completed", count: 1 },
    itemId: "chain-charm",
  },
  {
    id: "polyglot-paws",
    name: "Polyglot Paws",
    rule: { type: "learned_skills_in_category", category: "languages", count: 3 },
    itemId: "globe-charm",
  },
  {
    id: "jack-of-all-trades",
    name: "Jack of All Trades",
    rule: { type: "categories_taught", count: 5 },
    itemId: "patchwork-scarf",
  },
  { id: "reliable", name: "Reliable", rule: { type: "clean_streak", count: 20 }, itemId: "pocket-watch" },
  {
    id: "kind-words",
    name: "Kind Words",
    rule: { type: "reviews_written", count: 25 },
    itemId: "heart-bandana",
  },
  {
    id: "crowd-favorite",
    name: "Crowd Favorite",
    rule: { type: "five_stars_received", count: 10 },
    itemId: "star-charm",
  },
  {
    id: "group-leader",
    name: "Group Leader",
    rule: { type: "group_classes_taught", count: 5 },
    itemId: "megaphone",
  },
  {
    id: "open-paws",
    name: "Open Paws",
    rule: { type: "gifted_to_community", minutes: 600 },
    itemId: "heart-bell",
  },
  {
    id: "fair-judge",
    name: "Fair Judge",
    rule: { type: "dispute_panels", count: 5 },
    itemId: "scales-charm",
  },
  {
    id: "early-bird",
    name: "Early Bird",
    rule: { type: "early_sessions", count: 5 },
    itemId: "sunrise-window",
  },
  { id: "night-owl", name: "Night Owl", rule: { type: "late_sessions", count: 5 }, itemId: "moon-window" },
  {
    id: "mentors-mentor",
    name: "Mentor's Mentor",
    rule: { type: "mentees_teaching", count: 1 },
    itemId: "gold-whiskers",
  },
  { id: "cat-whisperer", name: "Cat Whisperer", rule: { type: "slow_blinks", count: 50 }, itemId: "cushion" },
  { id: "explorer", name: "Explorer", rule: { type: "skill_pages", count: 25 }, itemId: "map-backpack" },
];

export const itemById = new Map(ITEMS.map((i) => [i.id, i]));
export const achievementById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
