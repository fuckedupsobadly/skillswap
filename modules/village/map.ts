import { hash2 } from "./art/pixels";
import { type Ground, gid, TILE_COUNT, TILESET_COLUMNS } from "./art/tiles";
import { GUILDS } from "./guilds";

/**
 * The core village, hand-made in code and exported as a Tiled JSON map (16 px tiles). Places map 1:1 to
 * product features (§3.1). Residential plots are an object layer; huts are assigned per viewer at runtime.
 */
export const MAP_W = 64;
export const MAP_H = 46;

export type Place = {
  id: string;
  name: string;
  /** The plain twin page (and the sheet the village opens). */
  route: string;
  verb: string;
  kind: "building" | "object" | "guild" | "hut-row" | "area";
  art: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The tile you stand on to interact (in front of the door). */
  front: { x: number; y: number };
  blurb: string;
  district: "Town Square" | "Guild Quarter" | "Residential Lanes" | "South";
};

const GUILD_POS_A = [3, 12, 21, 36, 45, 54];
const GUILD_POS_B = [1, 9, 17, 25, 36, 45, 54];
const ROW_A = ["greenhouse", "training-grounds", "tea-house", "counting-house", "helpers-lodge", "tailor"];
const ROW_B = [
  "scriptorium",
  "tinkers-workshop",
  "painters-loft",
  "bards-hall",
  "bakehouse",
  "carpenters-yard",
  "game-parlor",
];

const place = (p: Omit<Place, "front"> & { front?: { x: number; y: number } }): Place => ({
  ...p,
  front: p.front ?? { x: p.x + Math.floor(p.w / 2), y: p.y + p.h },
});

export const PLACES: Place[] = [
  place({
    id: "well",
    name: "Wishing Well",
    route: "/well",
    verb: "Make a wish",
    kind: "object",
    art: "well",
    x: 30,
    y: 21,
    w: 3,
    h: 3,
    district: "Town Square",
    blurb: "Post a learning request",
    front: { x: 31, y: 24 },
  }),
  place({
    id: "board",
    name: "Notice Board",
    route: "/board",
    verb: "Read",
    kind: "object",
    art: "board",
    x: 22,
    y: 18,
    w: 3,
    h: 2,
    district: "Town Square",
    blurb: "Requests and offers, filterable",
  }),
  place({
    id: "tavern",
    name: "The Swapped Mug",
    route: "/tavern",
    verb: "Enter",
    kind: "building",
    art: "tavern",
    x: 20,
    y: 27,
    w: 6,
    h: 5,
    district: "Town Square",
    blurb: "Swap cycles at the tables; the Barkeep (AI) at the bar",
  }),
  place({
    id: "bank",
    name: "Hourglass Bank",
    route: "/bank",
    verb: "Enter",
    kind: "building",
    art: "bank",
    x: 26,
    y: 28,
    w: 5,
    h: 4,
    district: "Town Square",
    blurb: "Balance, held hours, history, gifting",
  }),
  place({
    id: "tower",
    name: "Clock Tower",
    route: "/tower",
    verb: "Climb",
    kind: "building",
    art: "tower",
    x: 40,
    y: 15,
    w: 3,
    h: 7,
    district: "Town Square",
    blurb: "Check the gears: verify the public ledger",
  }),
  place({
    id: "hall",
    name: "Town Hall",
    route: "/hall",
    verb: "Enter",
    kind: "building",
    art: "hall",
    x: 35,
    y: 27,
    w: 7,
    h: 5,
    district: "Town Square",
    blurb: "Settings, trust level, the disputes court",
  }),
  place({
    id: "lanterns",
    name: "Lantern Rooms",
    route: "/sessions",
    verb: "Enter",
    kind: "building",
    art: "lanterns",
    x: 36,
    y: 35,
    w: 8,
    h: 3,
    district: "South",
    blurb: "Live session rooms",
    front: { x: 39, y: 38 },
  }),
  place({
    id: "market",
    name: "Market Row",
    route: "/market",
    verb: "Browse",
    kind: "area",
    art: "market",
    x: 46,
    y: 39,
    w: 15,
    h: 3,
    district: "South",
    blurb: "Career and business skills; the Plus booth",
    front: { x: 51, y: 42 },
  }),
  place({
    id: "pond",
    name: "Community Pond",
    route: "/pond",
    verb: "Visit",
    kind: "area",
    art: "pond",
    x: 3,
    y: 36,
    w: 15,
    h: 7,
    district: "South",
    blurb: "Gift hours to the pool, or ask it for some",
    front: { x: 15, y: 37 },
  }),
  place({
    id: "gate",
    name: "The Gate",
    route: "/gate",
    verb: "Read",
    kind: "building",
    art: "gate",
    x: 30,
    y: 41,
    w: 4,
    h: 3,
    district: "South",
    blurb: "Arrival, your villager, Plain mode",
    front: { x: 29, y: 43 },
  }),
  ...ROW_A.map((id, i) => guildPlace(id, GUILD_POS_A[i], 0)),
  ...ROW_B.map((id, i) => guildPlace(id, GUILD_POS_B[i], 7)),
];

function guildPlace(id: string, x: number, y: number): Place {
  const g = GUILDS.find((x) => x.id === id)!;
  return place({
    id: `guild-${id}`,
    name: g.name,
    route: `/guild/${id}`,
    verb: "Enter",
    kind: "guild",
    art: `guild:${id}`,
    x,
    y,
    w: 6,
    h: 5,
    district: "Guild Quarter",
    blurb: g.categories.length ? `${g.cue}` : "",
  });
}

/** Hut plots, nearest the square first, so the members most relevant to you get the closest huts. */
export type Plot = { id: number; x: number; y: number; side: "W" | "E" };
const PLOT_ROWS = [15, 20, 25, 30];
export const PLOTS: Plot[] = (() => {
  const out: Plot[] = [];
  for (const y of PLOT_ROWS) {
    for (const x of [14, 10, 6, 2]) out.push({ id: 0, x, y, side: "W" });
    for (const x of [46, 50, 54, 58]) out.push({ id: 0, x, y, side: "E" });
  }
  // nearest the Well first
  out.sort((a, b) => Math.hypot(a.x + 1.5 - 31.5, a.y - 22) - Math.hypot(b.x + 1.5 - 31.5, b.y - 22));
  return out.map((p, i) => ({ ...p, id: i }));
})();

export const SPAWN = { x: 31, y: 44 };

type Prop = { kind: string; x: number; y: number };
export const PROPS: Prop[] = [
  // around the square
  { kind: "tree", x: 19, y: 15 },
  { kind: "tree", x: 43, y: 24 },
  { kind: "bench", x: 27, y: 24 },
  { kind: "bench", x: 34, y: 24 },
  { kind: "barrel", x: 26, y: 30 },
  { kind: "paperLantern", x: 29, y: 21 },
  // guild cues
  { kind: "target", x: 18, y: 2 },
  { kind: "oven", x: 42, y: 10 },
  { kind: "easel", x: 23, y: 9 },
  { kind: "sawhorse", x: 51, y: 10 },
  { kind: "woodstack", x: 52, y: 11 },
  { kind: "cart", x: 51, y: 3 },
  { kind: "boxes", x: 52, y: 4 },
  { kind: "stoneGarden", x: 27, y: 3 },
  { kind: "paperLantern", x: 27, y: 1 },
  { kind: "chalk", x: 61, y: 10 },
  // gate
  { kind: "signpost", x: 28, y: 42 },
  { kind: "mapStand", x: 34, y: 42 },
  // pond
  { kind: "donationLantern", x: 16, y: 37 },
  // trees along the edges
  ...[
    [0, 14],
    [63, 14],
    [0, 35],
    [20, 36],
    [24, 39],
    [44, 44],
    [61, 36],
    [62, 44],
    [2, 44],
    [26, 44],
    [37, 44],
    [19, 40],
    [63, 30],
    [0, 25],
  ].map(([x, y]) => ({ kind: hash2(x, y, 4) < 0.5 ? "tree" : "pine", x, y })),
];

// ── Ground ─────────────────────────────────────────────────────────────────

export function groundGrid(): Ground[][] {
  const g: Ground[][] = Array.from({ length: MAP_H }, () => Array<Ground>(MAP_W).fill("grass"));
  const fill = (x0: number, y0: number, w: number, h: number, k: Ground) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) g[y][x] = k;
  };
  // Guild Quarter roads
  fill(0, 5, MAP_W, 2, "path");
  fill(0, 12, MAP_W, 2, "path");
  fill(31, 5, 2, 9, "path");
  // Town Square
  fill(19, 14, 26, 20, "stone");
  // Residential lanes
  for (const y of [18, 23, 28, 33]) {
    fill(1, y, 18, 1, "path");
    fill(45, y, 18, 1, "path");
  }
  fill(1, 14, 1, 20, "path");
  fill(62, 14, 1, 20, "path");
  // South: main road to the gate, the Lantern Rooms lane, Market Row, the pond path
  fill(31, 34, 2, 12, "path");
  fill(33, 38, 12, 1, "path");
  fill(33, 42, 29, 1, "path");
  fill(1, 34, 30, 1, "path");
  fill(14, 35, 1, 2, "path");
  // pond
  for (let y = 36; y < 44; y++)
    for (let x = 2; x < 18; x++)
      if (((x + 0.5 - 10) / 7.2) ** 2 + ((y + 0.5 - 39.5) / 3.6) ** 2 <= 1) g[y][x] = "water";
  fill(15, 37, 2, 2, "dock");
  return g;
}

function variant(g: Ground[][], x: number, y: number) {
  const k = g[y][x];
  if (k === "grass") return gid(`grass${hash2(x, y, 1) < 0.12 ? 1 : hash2(x, y, 2) < 0.25 ? 2 : 0}`);
  if (k === "dock") return gid("dock");
  const diff = (dx: number, dy: number) => {
    const n = g[y + dy]?.[x + dx];
    if (!n) return false;
    if (k === "water") return n !== "water" && n !== "dock";
    if (k === "stone") return n !== "stone";
    return n === "grass";
  };
  const mask = (diff(0, -1) ? 1 : 0) | (diff(1, 0) ? 2 : 0) | (diff(0, 1) ? 4 : 0) | (diff(-1, 0) ? 8 : 0);
  return gid(`${k}${mask}`);
}

/** Tiles blocked for walking: buildings (all but the bottom-front edge of open areas), water, props. */
export function collisionGrid(): boolean[][] {
  const g = groundGrid();
  const block: boolean[][] = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false));
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (g[y][x] === "water") block[y][x] = true;
  for (const p of PLACES) {
    if (p.kind === "area") continue;
    for (let y = p.y; y < p.y + p.h; y++)
      for (let x = p.x; x < p.x + p.w; x++)
        if (y >= 0 && x >= 0 && y < MAP_H && x < MAP_W) block[y][x] = true;
  }
  // gate arch: posts only, the road passes under it
  for (let y = 41; y < 44; y++) for (let x = 31; x < 33; x++) block[y][x] = false;
  // market stalls block, the lane in front does not
  for (const sx of [46, 50, 54, 58])
    for (let y = 39; y < 42; y++) for (let x = sx; x < sx + 3; x++) block[y][x] = true;
  for (const plot of PLOTS)
    for (let y = plot.y; y < plot.y + 3; y++) for (let x = plot.x; x < plot.x + 3; x++) block[y][x] = true;
  for (const pr of PROPS)
    if (
      pr.kind === "tree" ||
      pr.kind === "pine" ||
      pr.kind === "barrel" ||
      pr.kind === "oven" ||
      pr.kind === "woodstack"
    )
      block[pr.y][pr.x] = true;
  for (let y = 37; y < 39; y++) for (let x = 15; x < 17; x++) block[y][x] = false; // the dock is walkable
  return block;
}

const prop = (name: string, type: string, value: string | number | boolean) => ({ name, type, value });

/** Build the Tiled JSON (orthogonal, 16 px, one embedded tileset). */
export function tiledMap() {
  const g = groundGrid();
  const block = collisionGrid();
  const ground: number[] = [];
  const decor: number[] = [];
  const collide: number[] = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      ground.push(variant(g, x, y));
      const free = g[y][x] === "grass" && !block[y][x] && hash2(x, y, 9) < 0.06;
      decor.push(
        free
          ? gid(
              hash2(x, y, 10) < 0.5
                ? "flowers"
                : hash2(x, y, 11) < 0.5
                  ? "tuft"
                  : hash2(x, y, 12) < 0.6
                    ? "bush"
                    : "rock",
            )
          : 0,
      );
      collide.push(block[y][x] ? 1 : 0);
    }
  let oid = 1;
  const layer = (id: number, name: string, data: number[], visible = true) => ({
    id,
    name,
    type: "tilelayer",
    width: MAP_W,
    height: MAP_H,
    x: 0,
    y: 0,
    opacity: 1,
    visible,
    data,
  });
  const objects = (id: number, name: string, list: object[]) => ({
    id,
    name,
    type: "objectgroup",
    draworder: "topdown",
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    objects: list,
  });
  return {
    type: "map",
    version: "1.10",
    tiledversion: "1.11.0",
    orientation: "orthogonal",
    renderorder: "right-down",
    infinite: false,
    width: MAP_W,
    height: MAP_H,
    tilewidth: 16,
    tileheight: 16,
    nextlayerid: 8,
    nextobjectid: 0,
    properties: [prop("name", "string", "SkillSwap Village")],
    tilesets: [
      {
        firstgid: 1,
        name: "village",
        image: "tiles.png",
        imagewidth: TILESET_COLUMNS * 16,
        imageheight: Math.ceil(TILE_COUNT / TILESET_COLUMNS) * 16,
        tilewidth: 16,
        tileheight: 16,
        tilecount: TILE_COUNT,
        columns: TILESET_COLUMNS,
        margin: 0,
        spacing: 0,
      },
    ],
    layers: [
      layer(1, "ground", ground),
      layer(2, "decor", decor),
      layer(3, "collision", collide, false),
      objects(
        4,
        "places",
        PLACES.map((p) => ({
          id: oid++,
          name: p.name,
          type: p.kind,
          x: p.x * 16,
          y: p.y * 16,
          width: p.w * 16,
          height: p.h * 16,
          rotation: 0,
          visible: true,
          properties: [
            prop("placeId", "string", p.id),
            prop("route", "string", p.route),
            prop("verb", "string", p.verb),
            prop("art", "string", p.art),
            prop("frontX", "int", p.front.x),
            prop("frontY", "int", p.front.y),
          ],
        })),
      ),
      objects(
        5,
        "hut-plots",
        PLOTS.map((pl) => ({
          id: oid++,
          name: `plot-${pl.id}`,
          type: "plot",
          x: pl.x * 16,
          y: pl.y * 16,
          width: 48,
          height: 48,
          rotation: 0,
          visible: true,
          properties: [prop("plot", "int", pl.id), prop("side", "string", pl.side)],
        })),
      ),
      objects(
        6,
        "props",
        PROPS.map((pr) => ({
          id: oid++,
          name: pr.kind,
          type: "prop",
          x: pr.x * 16,
          y: pr.y * 16,
          width: 16,
          height: 16,
          rotation: 0,
          visible: true,
          properties: [],
        })),
      ),
      objects(7, "spawns", [
        {
          id: oid++,
          name: "gate",
          type: "spawn",
          x: SPAWN.x * 16,
          y: SPAWN.y * 16,
          width: 16,
          height: 16,
          rotation: 0,
          visible: true,
          properties: [],
        },
      ]),
    ],
  };
}

export const placeById = new Map(PLACES.map((p) => [p.id, p]));
