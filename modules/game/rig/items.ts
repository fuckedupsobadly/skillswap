import type { Slot } from "../ranks";

/**
 * Item art. Each item is drawn once per view (front, side) and attached at an anchor the body rig defines
 * for every frame, so one drawing fits every pose and growth stage. Same rules as the cat: 1 px plum outline,
 * flat fills, no anti-aliasing.
 */
export const ITEM_COLORS: Record<string, string> = {
  o: "#2d2033", // outline
  h: "#ffffff",
  w: "#f7f3f8",
  g: "#cfc8d8",
  s: "#b9bfcc",
  S: "#8b93a6",
  k: "#3e3346",
  K: "#5b4e66",
  r: "#e46a6f",
  R: "#b34a5a",
  p: "#f5b3c6",
  P: "#de7fa1",
  b: "#7fb3e8",
  B: "#3f5f9a",
  t: "#6cc4b8",
  T: "#3f8f87",
  y: "#f4cc63",
  Y: "#c9952e",
  G: "#7fbe6e",
  D: "#4e8752",
  n: "#c69563",
  N: "#8a5d3a",
  c: "#f1dfbf",
  C: "#d9be92",
  v: "#a68ad8",
  V: "#6e58a8",
  l: "#d8ccef",
  m: "#a9dcc8",
  u: "#f6a65a",
  U: "#cf6f2c",
  x: "#1f2a52", // night sky
  z: "#f7b27a", // sunrise
};

export type Sprite = string[];
export type ItemArt = {
  front?: Sprite;
  side?: Sprite;
  /** Extra frames for animated items (shimmering bell, tail sparkle). */
  frames?: Sprite[];
  /** Pixel offset from the slot anchor. */
  dx?: number;
  dy?: number;
  behind?: boolean;
  /** Only shown in this view. */
  only?: "front" | "side";
};

/** Where each slot's sprite attaches: which rig anchor, and which point of the sprite sits on it. */
export const SLOT_ANCHOR: Record<
  Slot,
  { anchor: "headTop" | "eyes" | "neck" | "back" | "tailTip" | "ground"; align: "bottom" | "top" | "center" }
> = {
  head: { anchor: "headTop", align: "bottom" },
  face: { anchor: "eyes", align: "center" },
  neck: { anchor: "neck", align: "top" },
  charm: { anchor: "neck", align: "top" },
  back: { anchor: "back", align: "center" },
  tail: { anchor: "tailTip", align: "center" },
  bed: { anchor: "ground", align: "bottom" },
  room: { anchor: "ground", align: "bottom" },
  toy: { anchor: "ground", align: "bottom" },
};

const collar = (c: string) => [`oooooooooooo`, `o${c.repeat(10)}o`];

export const ART: Record<string, ItemArt> = {
  // ── Head ──────────────────────────────────────────────────────────────────
  beanie: {
    dy: 3,
    front: ["....oooo....", "..ooBBBBoo..", ".oBBbBBbBBo.", ".oBBBBBBBBo.", "oowwwwwwwwoo", ".oooooooooo."],
    side: ["...oooo...", ".ooBBBBoo.", "oBBbBBbBBo", "owwwwwwwwo", "oooooooooo"],
  },
  beret: {
    dy: 2,
    dx: -1,
    front: [".....o......", "..oooPooo...", ".oPPPPPPPPo.", "oPPPPPPPPPPo", ".oooooooooo."],
  },
  "chef-hat": {
    dy: 2,
    front: [".oo.oo.oo.", "owwowwowwo", "owwwwwwwwo", ".owwwwwwo.", ".oggggggo.", ".oooooooo."],
  },
  headphones: {
    dy: 6,
    front: [
      "......oooooooooo......",
      ".....oVVVVVVVVVVo.....",
      "..ooo............ooo..",
      ".oVVo............oVVo.",
      ".ovVo............oVvo.",
      ".oVVo............oVVo.",
      "..oo..............oo..",
    ],
    side: ["..oooooo..", ".oVVVVVVo.", "o......oVo", ".......ovVo", ".......oVVo", "........oo."],
  },
  "grad-cap": {
    dy: 2,
    front: [
      "......oo......",
      "...oookkooo...",
      ".ookkkkkkkkoo.",
      "okkkkkkkkkkkko",
      ".ooookkkkooooy",
      "....okkkko..y.",
      "....oooooo..Y.",
    ],
  },
  "flower-crown": {
    dy: 3,
    front: [".oo..ooo..oo.", "oppooyhyoopPo", "oDGGGGGGGGGDo", ".ooooooooooo."],
    side: [".oo.ooo.", "oppoyhyo", "oDGGGGDo", ".oooooo."],
  },
  sweatband: {
    dy: 5,
    front: ["oooooooooooooooooo", "orrwrrrrrrrrrrwrro", "oooooooooooooooooo"],
    side: ["ooooooooooo", "orrwrrrrwro", "ooooooooooo"],
  },
  crown: {
    dy: 2,
    front: [".o...oo...o.", "oyo.oyyo.oyo", "oyyoyyyyoyyo", "oyyyyryyyyyo", "oYYYYYYYYYYo", "oooooooooooo"],
  },
  "leaf-hat": {
    dy: 3,
    front: [".......oo...", "....ooooGo..", "..oouuuuoo..", ".ouuUuuUuuo.", "oonnnnnnnnoo", ".oooooooooo."],
  },
  "straw-hat": {
    dy: 3,
    front: [
      "....oooooo....",
      "...oyyyyyyo...",
      "...orrrrrro...",
      ".ooyyyyyyyyoo.",
      "oyyyyyyyyyyyyo",
      ".oooooooooooo.",
    ],
  },

  // ── Face ──────────────────────────────────────────────────────────────────
  glasses: {
    front: [".ooo......ooo.", "o...oooooo...o", "o...o....o...o", ".ooo......ooo."],
    side: [".ooo.", "o...o", "o...o", ".ooo."],
    dx: 0,
  },
  sunglasses: {
    front: ["ooooo....ooooo", "okhkooooookhko", "okkko....okkko", ".ooo......ooo."],
    side: ["ooooo", "okhko", "okkko", ".ooo."],
  },
  monocle: {
    front: [".ooo.", "o...o", "o...o", ".ooo.", "...o.", "...o.", "....o"],
    side: [".ooo.", "o...o", "o...o", ".ooo."],
    dx: 4,
  },
  "gold-whiskers": {
    dy: 3,
    front: [
      "yyyy.....................yyyy",
      "....YY.................YY....",
      "yyy.......................yyy",
    ],
    side: ["....yyyy", "..YY....", "yyy....."],
    dx: 0,
  },

  // ── Neck ──────────────────────────────────────────────────────────────────
  scarf: {
    front: [
      "oooooooooooooo",
      "orrRrrRrrRrrRo",
      "oooooooorrRoo.",
      ".......orrRo..",
      ".......orrRo..",
      ".......oooo...",
    ],
    side: ["oooooooo", "orrRrrRo", "oorrRooo", ".orrRo..", ".oooo..."],
  },
  "heart-bandana": {
    front: [
      "oooooooooooo",
      "oppPppppPppo",
      ".oppphpppo..",
      "..oppppPo...",
      "...oPppo....",
      "....opo.....",
      ".....o......",
    ],
  },
  "bow-tie": {
    front: ["oo.....oo", "oVVo.oVVo", "oVvVoVvVo", "oVVo.oVVo", "oo.....oo"],
    side: ["oo.", "oVo", "ovo", "oVo", "oo."],
  },
  "patchwork-scarf": {
    front: [
      "oooooooooooooo",
      "orrbbyyGGrrbbo",
      "oooooooobbyoo.",
      ".......oyyGo..",
      ".......oGGro..",
      ".......oooo...",
    ],
    side: ["oooooooo", "orrbbyyo", "ooGGrooo", ".obbyo..", ".oooo..."],
  },
  "winter-scarf": {
    front: [
      "oooooooooooooo",
      "ottwttwttwttwo",
      "ooooooooottwo.",
      "........ottwo.",
      "........owtto.",
      "........oooo..",
    ],
    side: ["oooooooo", "ottwttwo", "oottwooo", ".owtto..", ".oooo..."],
  },

  // ── Collar charms (each carries its collar) ─────────────────────────────────
  bell: {
    front: [...collar("r"), ".....oyyo...", "....oyyyyo..", "....oYooYo..", ".....oooo..."],
    side: ["oooooo", "orrrro", ".oyyo.", "oyYYo.", ".oooo."],
  },
  "animated-bell": {
    front: [...collar("V"), ".....oyyo...", "....oyhyyo..", "....oYooYo..", ".....oooo..."],
    frames: [
      [...collar("V"), ".....oyyo...", "....oyhyyo..", "....oYooYo..", ".....oooo..."],
      [...collar("V"), ".....oyyo..h", "....oyyhyo..", "....oYooYo..", ".....oooo..."],
      [...collar("V"), ".h...oyyo...", "....oyyyho..", "....oYooYo..", ".....oooo..."],
    ],
  },
  "chain-charm": {
    front: [...collar("V"), "......o.....", ".....oso....", "....os.so...", ".....oso....", "......o....."],
  },
  "globe-charm": {
    front: [...collar("B"), ".....ooo....", "....obGbo...", "....oGbbo...", "....obbGo...", ".....ooo...."],
  },
  "star-charm": {
    front: [...collar("P"), "......o.....", ".....oyo....", "....oyyyo...", ".....oyo....", "....oo.oo..."],
  },
  "heart-bell": {
    front: [
      ...collar("p"),
      "....oo.oo...",
      "...oPpoPpo..",
      "...oPppppo..",
      "....oPppo...",
      ".....oPo....",
      "......o.....",
    ],
  },
  "scales-charm": {
    front: [...collar("Y"), "......o.....", "...ooooooo..", "..oyo.o.oyo.", "..ooo.o.ooo.", "....ooooo..."],
  },
  "pocket-watch": {
    front: [...collar("N"), ".....ooo....", "....owwwo...", "....owkwo...", "....owwwo...", ".....ooo...."],
  },

  // ── Back ──────────────────────────────────────────────────────────────────
  backpack: {
    side: [".oooooo.", "onnnnnno", "onNNNNno", "onnyynno", "onnnnnno", ".oooooo."],
    front: ["on........no", "on........no", ".n........n."],
    dy: -1,
  },
  "map-backpack": {
    side: [".oooooo.", "occcccco", "ocGbCcco", "occCGbco", "onnnnnno", ".oooooo."],
    front: ["on........no", "on........no", ".n........n."],
    dy: -1,
  },
  cape: {
    behind: true,
    front: [
      "....oooooooooooo....",
      "...orrrrrrrrrrrrro...",
      "..orrrrrrrrrrrrrrro..",
      ".orrrrrrrrrrrrrrrrro.",
      ".orrrrrrrrrrrrrrrrrro",
      "orrrrrrrrrrrrrrrrrrro",
      "oRrrrrrrrrrrrrrrrrrRo",
      "ooooooooooooooooooooo",
    ],
    side: ["oooooooo....", "orrrrrrroo..", "orrrrrrrrro.", ".orrrrrrrrro", "..oooRRRRRo.", ".......oooo."],
    dy: 3,
  },
  wings: {
    behind: true,
    front: [
      "oo....................oo",
      "olloo..............oollo",
      "ollllo............ollllo",
      ".olllvo..........ovlllo.",
      "..ollo............ollo..",
      "...oo..............oo...",
    ],
    side: ["oo....", "olloo.", "ollllo", ".olllvo", "..ollo", "...oo."],
    dy: -2,
  },
  laptop: {
    side: [".oooooooo", ".osssssso", ".osbbbbso", ".osbbbbso", "oooooooooo", "oSSSSSSSSo", "oooooooooo"],
    only: "side",
    dy: -3,
  },
  "tool-belt": {
    front: [
      "oooooooooooooooo",
      "onnnnyynnnnnnnno",
      "oooonoooonoooooo",
      "....oso..oNo....",
      "....oso..oNo....",
      ".....o....o.....",
    ],
    side: ["oooooooo", "onnyynno", "ooonoooo", "..oso...", "...o...."],
    dy: 5,
  },
  megaphone: {
    side: ["....oo", "..ooyo", "ooyyyo", "oryyyo", "ooyyyo", "..ooyo", "....oo"],
    only: "side",
    dy: -3,
  },

  // ── Tail ──────────────────────────────────────────────────────────────────
  ribbon: { front: ["oo.oo", "oPoPo", ".oPo.", "oPoPo", "oo.oo"] },
  "pom-pom": { front: [".ooo.", "oywyo", "owyyo", ".ooo."] },
  sparkle: {
    front: ["..h..", ".hyh.", "..h.."],
    frames: [
      ["..h..", ".hyh.", "..h.."],
      [".....", "..y..", "....."],
      ["h...h", ".....", "..h.."],
    ],
  },

  // ── Beds (under the cat) ─────────────────────────────────────────────────
  "cardboard-box": {
    dy: 1,
    front: [
      "oooooooooooooooooooooooo",
      "oCccccccccccccccccccccCo",
      "occccccccccccccccccccccco",
      "occccccccccCCcccccccccco",
      "occccccccccccccccccccccco",
      "oooooooooooooooooooooooo",
    ],
  },
  basket: {
    behind: true,
    dy: 1,
    front: [
      "..oooooooooooooooooooooooooo..",
      ".onnNnnNnnNnnNnnNnnNnnNnnNnno.",
      "onNnnNnnNnnNnnNnnNnnNnnNnnNnno",
      "onnnnnnnnnnnnnnnnnnnnnnnnnnnno",
      ".onnNnnNnnNnnNnnNnnNnnNnnNnno.",
      "..oooooooooooooooooooooooooo..",
    ],
  },
  cushion: {
    behind: true,
    dy: 1,
    front: [
      "...oooooooooooooooooooooooo...",
      ".oopppppppppppppppppppppppppoo.",
      "oppPpppppppppppppppppppppppPppo",
      "oppppppppppppppppppppppppppppo",
      ".ooPPPPPPPPPPPPPPPPPPPPPPPPoo.",
      "...oooooooooooooooooooooooo...",
    ],
  },

  // ── Toys (separate objects the kitty plays with) ─────────────────────────
  yarn: { front: [".oooo..", "orrRro.", "oRrrRo.", "orRrro.", ".oooo.o", "......."] },
  mouse: { front: [".oo.....", "ossoo...", "osssso.o", ".oooooo.", "........"] },
  feather: { front: ["....oo", "...ovo", "..ovvo", ".ovvo.", ".oo...", "o.....", "o....."] },

  // ── Room pieces (profile room) ───────────────────────────────────────────
  window: {
    front: [
      "oooooooooooooooooo",
      "obbbbbbbbobbbbbbbo",
      "obhbbbbbbobhbbbbbo",
      "obbbbbbbbobbbbbbbo",
      "oooooooooooooooooo",
      "obbbbbbbbobbbbbbbo",
      "obbbbbbbbobbbbbbbo",
      "oooooooooooooooooo",
      "ogggggggggggggggggo",
      "oooooooooooooooooooo",
    ],
  },
  "sunrise-window": {
    front: [
      "oooooooooooooooooo",
      "ozzzzzzzzozzzzzzzo",
      "ozzzzyyzzozzzzzzzo",
      "ozzzyyyyzozzzzzzzo",
      "oooooooooooooooooo",
      "oppppppppoppppppppo",
      "oGGGGGGGGoGGGGGGGGo",
      "oooooooooooooooooo",
      "ogggggggggggggggggo",
      "oooooooooooooooooooo",
    ],
  },
  "moon-window": {
    front: [
      "oooooooooooooooooo",
      "oxxxxxxxxoxxxxhxxo",
      "oxxwwxxxxoxxxxxxxo",
      "oxxxwxxhxoxxhxxxxo",
      "oooooooooooooooooo",
      "oxxxxxxxxoxxxxxxxo",
      "oxxxhxxxxoxxxxxhxo",
      "oooooooooooooooooo",
      "ogggggggggggggggggo",
      "oooooooooooooooooooo",
    ],
  },
  plant: {
    front: [
      "...oo.oo...",
      "..oGGoGDo..",
      ".oGDGoGGDo.",
      ".oGGoGoGGo.",
      "..ooGGGoo..",
      "...oDGDo...",
      "..ooooooo..",
      "..oUuuuUo..",
      "..ouuuuuo..",
      "...ooooo...",
    ],
  },
  bookshelf: {
    front: [
      "oooooooooooooo",
      "onrbBynGvRbyno",
      "onrbBynGvRbyno",
      "oooooooooooooo",
      "onGvyrbnBRyrno",
      "onGvyrbnBRyrno",
      "oooooooooooooo",
      "on..........no",
      "oooooooooooooo",
    ],
  },
  rug: {
    front: [
      "....oooooooooooooooooooooo....",
      "..oovvvvvvvvvvvvvvvvvvvvvvoo..",
      ".ovvllvvllvvllvvllvvllvvllvvo.",
      "..oovvvvvvvvvvvvvvvvvvvvvvoo..",
      "....oooooooooooooooooooooo....",
    ],
  },
};

/** Pad rows to a rectangle so sloppy edits can't misalign a sprite. */
export function normalize(rows: Sprite): Sprite {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.replace(/ /g, ".").padEnd(w, "."));
}

export function spriteFor(art: ItemArt, view: "front" | "side" | "curl", frame = 0): Sprite | null {
  if (art.only && art.only !== (view === "curl" ? "side" : view)) return null;
  if (art.frames) return normalize(art.frames[frame % art.frames.length]);
  const s = view === "front" ? (art.front ?? art.side) : (art.side ?? art.front);
  return s ? normalize(s) : null;
}
