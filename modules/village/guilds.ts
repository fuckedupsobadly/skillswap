import type { IconName } from "@/ui/pixel/icons";

/**
 * Guild Quarter (§3.2): every category gets a building. Roof colour = category colour everywhere (hut roofs,
 * notice-board pins, map pins), always paired with the guild's sign icon so it works without colour.
 * Warm yellow and mustard are kept well away from lantern gold, which is reserved for actions and lit lanterns.
 */
export type Guild = {
  id: string;
  name: string;
  categories: string[];
  roof: string;
  roofShade: string;
  icon: IconName;
  cue: string;
};

export const GUILDS: Guild[] = [
  {
    id: "scriptorium",
    name: "Scriptorium",
    categories: ["languages", "writing-communication", "academic"],
    roof: "#6f86b5",
    roofShade: "#55699a",
    icon: "book",
    cue: "Tall windows, book sign",
  },
  {
    id: "tinkers-workshop",
    name: "Tinker's Workshop",
    categories: ["tech-coding", "tech-help"],
    roof: "#4fa3a0",
    roofShade: "#3a8380",
    icon: "gear",
    cue: "Gear sign, chimney with sparks",
  },
  {
    id: "painters-loft",
    name: "Painter's Loft",
    categories: ["design-creative", "video-photo-audio"],
    roof: "#e8836b",
    roofShade: "#c86650",
    icon: "easel",
    cue: "Easel on the balcony",
  },
  {
    id: "bards-hall",
    name: "Bard's Hall",
    categories: ["music"],
    roof: "#b86f98",
    roofShade: "#97557c",
    icon: "lute",
    cue: "Lute sign; notes drift out when a class runs",
  },
  {
    id: "bakehouse",
    name: "Bakehouse",
    categories: ["cooking-food"],
    roof: "#d8c27c",
    roofShade: "#b9a25e",
    icon: "bread",
    cue: "Bread oven, steam",
  },
  {
    id: "training-grounds",
    name: "Training Grounds",
    categories: ["fitness-sports"],
    roof: "#5e9e57",
    roofShade: "#487f43",
    icon: "target",
    cue: "Open yard with a target and track",
  },
  {
    id: "tea-house",
    name: "Tea House",
    categories: ["mind-wellness"],
    roof: "#a9c3a2",
    roofShade: "#8aa583",
    icon: "teacup",
    cue: "Lanterns and a little stone garden",
  },
  {
    id: "carpenters-yard",
    name: "Carpenter's Yard",
    categories: ["home-diy", "crafts-making", "vehicles-bikes"],
    roof: "#9a6b4a",
    roofShade: "#7b5236",
    icon: "saw",
    cue: "Sawhorse, wood stack",
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    categories: ["garden-outdoors"],
    roof: "#8fd0b8",
    roofShade: "#6fb29a",
    icon: "sprout",
    cue: "Glass roof, plants",
  },
  {
    id: "game-parlor",
    name: "Game Parlor",
    categories: ["games-hobbies"],
    roof: "#b39a4a",
    roofShade: "#927c34",
    icon: "chess",
    cue: "Chessboard sign",
  },
  {
    id: "tailor",
    name: "Tailor",
    categories: ["style-beauty"],
    roof: "#d49aa6",
    roofShade: "#b67c89",
    icon: "needle",
    cue: "Mannequin in the window",
  },
  {
    id: "counting-house",
    name: "Counting House",
    categories: ["money-basics"],
    roof: "#8c9bae",
    roofShade: "#6f7e92",
    icon: "abacus",
    cue: "Abacus sign",
  },
  {
    id: "helpers-lodge",
    name: "Helpers' Lodge",
    categories: ["helping-hands"],
    roof: "#6fa654",
    roofShade: "#57873f",
    icon: "cart",
    cue: "Cart and boxes outside",
  },
];

/** Career and business lives on Market Row, not in a guild hall. */
export const MARKET = {
  id: "market-row",
  name: "Market Row",
  categories: ["career-business"],
  roof: "#c7836b",
  roofShade: "#a8664f",
  icon: "sign" as IconName,
};

export const guildById = new Map(GUILDS.map((g) => [g.id, g]));
export function guildForCategory(slug: string) {
  return GUILDS.find((g) => g.categories.includes(slug)) ?? null;
}
/** The identity colour for any category: its guild's roof, or Market Row's awning for career and business. */
export function categoryColor(slug: string) {
  return guildForCategory(slug)?.roof ?? MARKET.roof;
}
export function categoryIcon(slug: string): IconName {
  return guildForCategory(slug)?.icon ?? MARKET.icon;
}
