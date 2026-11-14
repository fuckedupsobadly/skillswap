import * as Phaser from "phaser";
import type { VillagerLook } from "@/db/schema";
import * as B from "@/modules/village/art/buildings";
import { lookFromSeed } from "@/modules/village/art/people";
import { Px } from "@/modules/village/art/pixels";
import {
  BARKEEP,
  CHALK,
  chair,
  EXIT,
  flame,
  TABLE_PLOTS,
  TAVERN_H,
  TAVERN_W,
  table,
  tavernBlocked,
  tavernInterior,
} from "@/modules/village/art/tavern";
import { gid } from "@/modules/village/art/tiles";
import { astar, nearestFree, type Pt } from "@/modules/village/astar";
import { GUILDS } from "@/modules/village/guilds";
import type { HubEvent, PublicPlayer } from "@/modules/village/hub";
import { MAP_H, MAP_W, PLACES, PLOTS, type Place, PROPS, SPAWN } from "@/modules/village/map";
import type { HutView } from "@/modules/village/service";
import { type Interact, type Prompt, type VillageState, village } from "./store";
import { addPx, critterTexture, kittyTexture, placeTexture, villagerTexture } from "./textures";

/**
 * The village renderer (§12): Phaser 3 in a client-only island. 16 px tiles at 3× (2× on phones and low-end
 * devices); the camera snaps to whole pixels. All UI lives in React; the canvas is aria-hidden.
 */
type Dir = "down" | "up" | "left" | "right";
type Options = { navigate: (route: string) => void; reduced: boolean; lowEnd: boolean; zoom: number };

const TS = 16;
const WALK = 4; // tiles per second
const RUN = 6;
const BARKEEP_LOOK: VillagerLook = {
  body: 2,
  skin: 3,
  hair: 0,
  hairColor: 1,
  eyes: 3,
  brows: 3,
  top: 9,
  topColor: 6,
  bottom: 0,
  bottomColor: 7,
  shoes: 3,
  accessory: "none",
};

const feet = (t: Pt) => ({ x: t.x * TS + 8, y: t.y * TS + 15 });
const dirOf = (dx: number, dy: number): Dir =>
  Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
const viewOf = (d: Dir) => (d === "left" || d === "right" ? "right" : d);

class Walker {
  tile: Pt;
  from: Pt;
  to: Pt | null = null;
  t = 0;
  dir: Dir = "up";
  path: Pt[] = [];
  onArrive: (() => void) | null = null;
  sprite: Phaser.GameObjects.Sprite;
  texKey: string;
  constructor(
    public scene: Phaser.Scene,
    look: VillagerLook,
    at: Pt,
  ) {
    this.tile = { ...at };
    this.from = { ...at };
    this.texKey = villagerTexture(scene, look);
    const f = feet(at);
    this.sprite = scene.add.sprite(f.x, f.y, this.texKey, "up:idle:0").setOrigin(0.5, 1);
    this.play("idle");
  }
  play(anim: "idle" | "walk" | "wave" | "sit" | "sleep" | "read", reducedIdle = false) {
    const v = viewOf(this.dir);
    this.sprite.setFlipX(this.dir === "left");
    const key = `${this.texKey}|${v}:${anim}`;
    if (anim === "idle" && reducedIdle) {
      this.sprite.stop();
      this.sprite.setFrame(`${v}:idle:0`);
      return;
    }
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
  }
  setLook(look: VillagerLook) {
    this.texKey = villagerTexture(this.scene, look);
    this.sprite.setTexture(this.texKey, `${viewOf(this.dir)}:idle:0`);
  }
}

/** A scene that is still running: false once the game is destroyed, when isActive() itself would throw. */
function sceneAlive(scene: Phaser.Scene) {
  try {
    return Boolean(scene.sys?.game) && scene.scene.isActive();
  } catch {
    return false;
  }
}

export class VillageScene extends Phaser.Scene {
  opts!: Options;
  blocked!: boolean[][];
  player!: Walker;
  state: VillageState | null = null;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  interactables: {
    key: string;
    tiles: Pt[];
    rect: Phaser.Geom.Rectangle | null;
    verb: string;
    target: string;
    action: Interact;
    person?: Phaser.GameObjects.Sprite;
  }[] = [];
  hutLayer: Phaser.GameObjects.GameObject[] = [];
  others = new Map<
    string,
    { w: Walker; plate: Phaser.GameObjects.Text; target: Pt; bubble?: Phaser.GameObjects.Container }
  >();
  kitty: {
    sprite: Phaser.GameObjects.Sprite;
    tile: Pt;
    from: Pt;
    to: Pt | null;
    t: number;
    dir: Dir;
    key: string;
  } | null = null;
  trail: Pt[] = [];
  idleSince = 0;
  night!: Phaser.GameObjects.Rectangle;
  glow!: Phaser.GameObjects.Graphics;
  glowSpots: { x: number; y: number; r: number }[] = [];
  marker!: Phaser.GameObjects.Graphics;
  walks = new Map<string, number>();
  es: EventSource | null = null;
  lastSent = 0;
  pixelFont = "monospace";
  bodyFont = "sans-serif";
  plates: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("village");
  }

  init(data: Options) {
    this.opts = data;
  }

  preload() {
    this.load.tilemapTiledJSON("village", "/village/village.json");
    this.load.image("tiles", "/village/tiles.png");
  }

  create() {
    const css = getComputedStyle(document.body);
    this.pixelFont = css.getPropertyValue("--font-pixelify").trim() || "monospace";
    this.bodyFont = css.getPropertyValue("--font-inter").trim() || "sans-serif";

    const map = this.make.tilemap({ key: "village" });
    const ts = map.addTilesetImage("village", "tiles")!;
    map.createLayer("ground", ts)!.setDepth(-10);
    map.createBlankLayer("worn", ts)?.setDepth(-9);
    map.createLayer("decor", ts)!.setDepth(-8);
    const col = map.getLayer("collision")!;
    this.blocked = col.data.map((row) => row.map((t) => t.index > 0));

    // Places: buildings and objects, y-sorted by their bottom edge.
    for (const p of PLACES) {
      if (p.kind === "area") continue;
      const key = placeTexture(this, p.art, { notes: 0, wishes: 0, chimneys: [], liveRooms: 0 });
      this.add
        .image(p.x * TS, p.y * TS, key)
        .setOrigin(0, 0)
        .setDepth((p.y + p.h) * TS)
        .setData("place", p.id);
      this.addInteract({
        key: `place:${p.id}`,
        tiles: [p.front],
        rect: new Phaser.Geom.Rectangle(p.x * TS, p.y * TS, p.w * TS, p.h * TS),
        verb: p.verb,
        target: p.id === "well" ? "" : p.name,
        action: { kind: "place", placeId: p.id, route: p.route },
      });
    }
    // Market Row stalls (one is the Plus booth, clearly labelled, selling no hours)
    const awnings = ["#e8836b", "#4fa3a0", "#b86f98", "#6f86b5"];
    [46, 50, 54, 58].forEach((x, i) => {
      const k = addPx(
        this,
        `stall:${i}`,
        B.stall(awnings[i], i === 3 ? ["#f3ead6", "#f3ead6"] : ["#d8c27c", "#6f86b5", "#e8836b"]),
      );
      this.add
        .image(x * TS, 39 * TS, k)
        .setOrigin(0, 0)
        .setDepth(42 * TS);
    });
    this.addPlate(59.5 * TS, 39 * TS - 2, "Plus booth · sells no hours", false);
    // Props
    for (const pr of PROPS) {
      const k = `prop:${pr.kind}`;
      if (!this.textures.exists(k)) addPx(this, k, B.prop(pr.kind as Parameters<typeof B.prop>[0]));
      const img = this.add
        .image(pr.x * TS + 8, pr.y * TS + 16, k)
        .setOrigin(0.5, 1)
        .setDepth(pr.y * TS + 15);
      if (pr.kind === "mapStand")
        this.addInteract({
          key: "map-stand",
          tiles: [{ x: pr.x, y: pr.y + 1 }],
          rect: img.getBounds(),
          verb: "Read",
          target: "the map",
          action: { kind: "map-stand" },
        });
    }
    // Guild Quarter labels: roof colour is never the only cue — each hall has its sign and name.
    for (const g of GUILDS) {
      const p = PLACES.find((x) => x.id === `guild-${g.id}`)!;
      this.addPlate((p.x + p.w / 2) * TS, p.y * TS - 2, g.name, false, true);
    }

    // You, at the Gate.
    const look = village.get().state?.viewer.look ?? lookFromSeed("you");
    this.player = new Walker(this, look, SPAWN);
    this.player.sprite.setDepth(feet(SPAWN).y);

    // Camera: whole-pixel zoom, follows with a 120 ms ease (instant with reduced motion).
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W * TS, MAP_H * TS);
    cam.setZoom(this.opts.zoom);
    cam.setRoundPixels(true);
    const lerp = this.opts.reduced ? 1 : 0.18;
    cam.startFollow(this.player.sprite, true, lerp, lerp, 0, 16);

    // Night: a multiply tint on the world only, with lantern glow punched through.
    this.night = this.add
      .rectangle(0, 0, MAP_W * TS, MAP_H * TS, 0x3a3260)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(9000)
      .setAlpha(0);
    this.glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(9001);
    this.marker = this.add.graphics().setDepth(8000);

    this.setupInput();
    this.setupCritters();
    this.setupWeather();
    this.time.addEvent({ delay: 20_000, loop: true, callback: () => this.updateNight() });
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.flushWalks() });
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.refreshClock() });
    this.updateNight();

    this.unsub = village.onCommand((c) => this.onCommand(c));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    // game.destroy() (leaving the page) fires DESTROY, not SHUTDOWN: drop the listener either way.
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.connect());
    const s = village.get().state;
    if (s) this.applyState(s);
    this.connect();
    village.set({ ready: true, scene: "village" });
  }

  unsub: () => void = () => {};

  teardown() {
    this.unsub();
    this.unsub = () => {};
    this.es?.close();
    this.es = null;
    this.flushWalks();
  }

  addPlate(x: number, y: number, text: string, pixel = true, small = false) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: pixel ? this.pixelFont : this.bodyFont,
        fontSize: small ? "6px" : "7px",
        color: "#2b1b33",
        backgroundColor: "#fbf6ecdd",
        padding: { x: 2, y: 1 },
        resolution: this.opts.zoom * 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(8500);
    this.plates.push(t);
    return t;
  }

  addInteract(i: VillageScene["interactables"][number]) {
    this.interactables = this.interactables.filter((x) => x.key !== i.key);
    this.interactables.push(i);
  }

  // ── State: huts, traces, worn paths ───────────────────────────────────────

  applyState(s: VillageState) {
    this.state = s;
    this.player.setLook(s.viewer.look);
    for (const o of this.hutLayer) o.destroy();
    this.hutLayer = [];
    this.interactables = this.interactables.filter(
      (i) => !i.key.startsWith("hut:") && !i.key.startsWith("sitter:") && i.key !== "mailbox",
    );
    this.glowSpots = [];
    // traces
    const tr = s.traces;
    for (const p of PLACES) {
      if (!["well", "board", "lanterns"].includes(p.id) && !p.art.startsWith("guild:")) continue;
      const key = placeTexture(this, p.art, tr);
      for (const img of this.children.list)
        if ((img as Phaser.GameObjects.Image).getData?.("place") === p.id)
          (img as Phaser.GameObjects.Image).setTexture(key);
      if (p.art.startsWith("guild:") && tr.chimneys.includes(p.art.slice(6))) {
        // smoke from the guild chimney (a class is running), and music notes from the Bard's Hall
        this.hutLayer.push(
          this.puffs(p.x * TS + p.w * TS - 16, p.y * TS + 2, p.id === "guild-bards-hall" ? "note" : "smoke"),
        );
        this.glowSpots.push(
          { x: p.x * TS + 14, y: p.y * TS + p.h * TS - 30, r: 16 },
          { x: (p.x + p.w) * TS - 14, y: p.y * TS + p.h * TS - 30, r: 16 },
        );
      }
    }
    // tavern windows always glow at night
    this.glowSpots.push({ x: 20 * TS + 48, y: 27 * TS + 44, r: 30 });
    // worn paths
    const worn =
      (this.children.list.find(
        (c) => (c as Phaser.Tilemaps.TilemapLayer).layer?.name === "worn",
      ) as Phaser.Tilemaps.TilemapLayer) ?? null;
    if (worn) for (const [x, y, level] of s.worn) worn.putTileAt(gid(`wear${Math.min(3, level)}`), x, y);
    // huts
    for (const h of s.huts) this.drawHut(h);
    // Onboarding step 4: the Barkeep waves from the tavern door (and is always labelled as an AI).
    if (s.viewer.onboardingStep === 4) {
      const bk = new Walker(this, BARKEEP_LOOK, { x: 25, y: 32 });
      bk.dir = "down";
      bk.play("wave");
      bk.sprite.setDepth(feet({ x: 25, y: 32 }).y);
      this.time.addEvent({ delay: 2400, loop: true, callback: () => bk.sprite.active && bk.play("wave") });
      this.hutLayer.push(bk.sprite, this.addPlate(bk.sprite.x, bk.sprite.y - 33, "Barkeep · AI"));
      this.addInteract({
        key: "sitter:barkeep",
        tiles: [
          { x: 24, y: 32 },
          { x: 25, y: 33 },
          { x: 26, y: 32 },
        ],
        rect: bk.sprite.getBounds(),
        verb: "Talk to",
        target: "the Barkeep",
        action: { kind: "barkeep" },
        person: bk.sprite,
      });
    }
    this.drawGlow();
  }

  drawHut(h: HutView) {
    const plot = PLOTS[h.plot];
    if (!plot) return;
    const x0 = plot.x * TS;
    const y0 = plot.y * TS;
    const hk = `hut:${h.roof}:${JSON.stringify(h.hut)}`;
    if (!this.textures.exists(hk)) addPx(this, hk, B.hut(h.roof, h.hut));
    const depth = y0 + 3 * TS;
    this.hutLayer.push(this.add.image(x0, y0, hk).setOrigin(0, 0).setDepth(depth));
    const win = h.presence === "free" ? "lit" : h.presence === "afk" ? "curtains" : "dark";
    const wk = `window:${win}`;
    if (!this.textures.exists(wk)) addPx(this, wk, B.hutWindow(win));
    this.hutLayer.push(
      this.add
        .image(x0 + 10, y0 + 30, wk)
        .setOrigin(0, 0)
        .setDepth(depth + 1),
    );
    if (h.presence === "free") this.glowSpots.push({ x: x0 + 15, y: y0 + 34, r: 20 });
    if (h.presence === "busy" || h.presence === "session") {
      const sk = `doorsign:${h.presence}`;
      if (!this.textures.exists(sk))
        addPx(this, sk, B.doorSign(h.presence === "session" ? "lesson" : "closed"));
      this.hutLayer.push(
        this.add
          .image(x0 + 25, y0 + 32, sk)
          .setOrigin(0, 0)
          .setDepth(depth + 1),
      );
    }
    if (h.presence === "free") this.hutLayer.push(this.puffs(x0 + 36, y0 + 4, "smoke"));
    if (h.presence === "afk") this.hutLayer.push(this.puffs(x0 + 20, y0 + 26, "z"));
    // garden item
    const gk = `garden:${h.hut.garden}`;
    if (!this.textures.exists(gk)) addPx(this, gk, B.gardenItem(h.hut.garden));
    this.hutLayer.push(
      this.add
        .image(x0 + 2, y0 + 47, gk)
        .setOrigin(0, 1)
        .setDepth(depth + 2),
    );
    // the kitty on the step: asleep when its owner is away or offline
    if (h.kitty) {
      const kk = kittyTexture(this, h.kitty);
      const asleep = h.presence === "offline" || h.presence === "away";
      const k = this.add
        .sprite(x0 + 42, y0 + 47, kk)
        .setOrigin(0.5, 1)
        .setDepth(depth + 3);
      k.play(`${kk}|down:${asleep ? "sleep" : "sit"}`);
      this.hutLayer.push(k);
    }
    // mailbox at your own hut
    const front = { x: plot.x + 1, y: plot.y + 3 };
    if (h.isYou) {
      const mk = "prop:mailbox";
      if (!this.textures.exists(mk)) {
        const p = B.prop("signpost");
        addPx(this, mk, p);
      }
      const unread = this.state?.viewer.unread ?? 0;
      const box = this.add
        .image(x0 + 52, y0 + 47, mk)
        .setOrigin(0.5, 1)
        .setDepth(depth + 2);
      this.hutLayer.push(box);
      if (unread > 0) this.hutLayer.push(this.addPlate(x0 + 52, y0 + 28, `${unread}`, true));
      this.addInteract({
        key: "mailbox",
        tiles: [{ x: plot.x + 3, y: plot.y + 3 }],
        rect: box.getBounds(),
        verb: "Open",
        target: "your mailbox",
        action: { kind: "mailbox" },
      });
      this.addInteract({
        key: `hut:${h.memberId}`,
        tiles: [front],
        rect: new Phaser.Geom.Rectangle(x0, y0, 48, 48),
        verb: "Enter",
        target: "your hut",
        action: { kind: "own-hut" },
      });
      this.hutLayer.push(this.addPlate(x0 + 24, y0, "Your hut", true));
      return;
    }
    // A member who is free now sits by their hut (real availability; sample members are labelled).
    const walking = this.others.has(h.memberId);
    if (h.presence === "free" && !walking && !h.hideMe) {
      const sitter = new Walker(this, h.look, { x: plot.x + 3, y: plot.y + 3 });
      sitter.dir = "down";
      sitter.play("idle", this.opts.reduced);
      sitter.sprite.setDepth(feet({ x: plot.x + 3, y: plot.y + 3 }).y);
      this.hutLayer.push(sitter.sprite);
      this.hutLayer.push(
        this.addPlate(
          sitter.sprite.x,
          sitter.sprite.y - 33,
          `${h.name.split(" ")[0]} · Free now${h.isSample ? " · Sample" : ""}`,
        ),
      );
      this.addInteract({
        key: `sitter:${h.memberId}`,
        tiles: [front, { x: plot.x + 4, y: plot.y + 3 }, { x: plot.x + 3, y: plot.y + 4 }],
        rect: sitter.sprite.getBounds(),
        verb: "Talk to",
        target: h.name.split(" ")[0],
        action: { kind: "member", handle: h.handle },
        person: sitter.sprite,
      });
    }
    this.addInteract({
      key: `hut:${h.memberId}`,
      tiles: [front],
      rect: new Phaser.Geom.Rectangle(x0, y0, 48, 48),
      verb: h.presence === "free" ? "Talk to" : "Read",
      target: h.presence === "free" ? h.name.split(" ")[0] : `${h.name.split(" ")[0]}'s sign`,
      action:
        h.presence === "free" ? { kind: "member", handle: h.handle } : { kind: "sign", handle: h.handle },
    });
  }

  puffs(x: number, y: number, kind: "smoke" | "z" | "note") {
    const k = `puff:${kind}`;
    if (!this.textures.exists(k)) addPx(this, k, B.puff(kind));
    if (this.opts.reduced || this.opts.lowEnd)
      return this.add
        .image(x, y, k)
        .setAlpha(kind === "smoke" ? 0.6 : 0.9)
        .setDepth(8400);
    return this.add
      .particles(x, y, k, {
        speedY: { min: kind === "z" ? -6 : -10, max: kind === "z" ? -4 : -6 },
        speedX: { min: -2, max: 3 },
        lifespan: kind === "z" ? 2200 : 2600,
        frequency: kind === "z" ? 1400 : 700,
        alpha: { start: kind === "smoke" ? 0.7 : 1, end: 0 },
        scale: { start: kind === "smoke" ? 0.8 : 1, end: kind === "smoke" ? 1.4 : 1 },
      })
      .setDepth(8400);
  }

  drawGlow() {
    this.glow.clear();
    const a = this.night.alpha;
    if (a <= 0.01) return;
    for (const g of this.glowSpots) {
      for (let i = 4; i >= 1; i--) {
        this.glow.fillStyle(0xffe3a1, (a * 0.32) / i);
        this.glow.fillCircle(g.x, g.y, (g.r * i) / 2.2);
      }
    }
  }

  /** Night follows the viewer's local time; dawn and dusk blend over 30 minutes. 35 % → 55 % in deep night. */
  updateNight() {
    const d = new Date();
    const h = d.getHours() + d.getMinutes() / 60;
    const ramp = (from: number, to: number) => Math.max(0, Math.min(1, (h - from) / (to - from)));
    let n = 0;
    if (h >= 18.5) n = ramp(18.5, 19);
    else if (h < 6.5) n = 1 - ramp(6, 6.5);
    const deep = h >= 22 || h < 4 ? 1 : h >= 19 ? (h - 19) / 3 : h < 6 ? (6 - h) / 2 : 0;
    this.night.setAlpha(n * (0.35 + 0.2 * Math.max(0, Math.min(1, deep))));
    this.drawGlow();
  }

  refreshClock() {
    const p = PLACES.find((x) => x.id === "tower")!;
    const key = placeTexture(this, "tower", { notes: 0, wishes: 0, chimneys: [], liveRooms: 0 });
    for (const img of this.children.list)
      if ((img as Phaser.GameObjects.Image).getData?.("place") === p.id)
        (img as Phaser.GameObjects.Image).setTexture(key);
  }

  // ── Input ────────────────────────────────────────────────────────────────

  setupInput() {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys("W,A,S,D,E,SHIFT,M,ENTER,T") as Record<string, Phaser.Input.Keyboard.Key>;
    kb.removeCapture("W,A,S,D,E,M,T,SPACE,ENTER");
    kb.on("keydown-E", () => !village.inputBlocked() && this.interact());
    kb.on("keydown-M", () => !village.inputBlocked() && village.set({ overlay: "map" }));
    kb.on("keydown-T", () => !village.inputBlocked() && village.set({ overlay: "say" }));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (village.inputBlocked() || p.getDistance() > 8) return;
      this.clickAt(p.worldX, p.worldY);
    });
    this.input.gamepad?.on(
      "down",
      (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
        if (button.index === 0 && !village.inputBlocked()) this.interact();
      },
    );
  }

  clickAt(wx: number, wy: number) {
    const hit =
      this.interactables.find((i) => i.person?.getBounds().contains(wx, wy)) ??
      this.interactables.find((i) => i.rect?.contains(wx, wy));
    if (hit) {
      // Walk to the nearest free tile in front of it, then open the interaction (§6.1).
      const goal = hit.tiles.find((t) => !this.blocked[t.y]?.[t.x]) ?? hit.tiles[0];
      this.goTo(goal, () => this.run(hit.action));
      return;
    }
    const t = { x: Math.floor(wx / TS), y: Math.floor(wy / TS) };
    const goal = this.isBlocked(t.x, t.y) ? nearestFree((x, y) => this.isBlocked(x, y), MAP_W, MAP_H, t) : t;
    if (goal) this.goTo(goal, null);
  }

  isBlocked(x: number, y: number) {
    return this.blocked[y]?.[x] ?? true;
  }

  goTo(goal: Pt, then: (() => void) | null) {
    const p = this.player;
    const start = p.to ?? p.tile;
    if (this.opts.reduced) {
      // Reduced motion: quick-travel only, no walking camera.
      this.teleport(goal);
      this.arrived();
      then?.();
      return;
    }
    const path = astar((x, y) => this.isBlocked(x, y), MAP_W, MAP_H, start, goal);
    if (!path) return;
    p.path = path;
    p.onArrive = then;
    if (!path.length && then) then();
    this.marker.clear();
    if (path.length) {
      const f = feet(goal);
      this.marker.lineStyle(1, 0x2b1b33, 1).strokeRect(f.x - 5, f.y - 4, 10, 6);
      this.time.delayedCall(900, () => this.marker.clear());
    }
  }

  teleport(t: Pt) {
    const p = this.player;
    p.tile = { ...t };
    p.from = { ...t };
    p.to = null;
    p.path = [];
    const f = feet(t);
    p.sprite.setPosition(f.x, f.y).setDepth(f.y);
    this.cameras.main.centerOn(f.x, f.y);
    if (this.kitty) {
      this.kitty.tile = { x: t.x, y: t.y + 1 };
      this.kitty.from = { ...this.kitty.tile };
      this.kitty.to = null;
      const kf = feet(this.kitty.tile);
      this.kitty.sprite.setPosition(kf.x, kf.y);
    }
    this.sendMove(true);
    this.updatePrompt();
  }

  /** Quick-travel (§6.1, §10.5): 200 ms fade to paper, move, fade back in. */
  quickTravel(t: Pt, then?: () => void) {
    village.set({ fade: true });
    this.time.delayedCall(200, () => {
      this.teleport(t);
      village.set({ fade: false });
      this.arrived();
      then?.();
    });
  }

  keyDir(): Pt | null {
    if (village.inputBlocked()) return null;
    const k = this.keys;
    const c = this.cursors;
    const pad = this.input.gamepad?.getPad(0);
    const sx = pad ? pad.leftStick.x : 0;
    const sy = pad ? pad.leftStick.y : 0;
    if (c.left.isDown || k.A.isDown || sx < -0.5) return { x: -1, y: 0 };
    if (c.right.isDown || k.D.isDown || sx > 0.5) return { x: 1, y: 0 };
    if (c.up.isDown || k.W.isDown || sy < -0.5) return { x: 0, y: -1 };
    if (c.down.isDown || k.S.isDown || sy > 0.5) return { x: 0, y: 1 };
    return null;
  }

  // ── Interaction ──────────────────────────────────────────────────────────

  nearby() {
    const t = this.player.to ?? this.player.tile;
    let best: VillageScene["interactables"][number] | null = null;
    for (const i of this.interactables) {
      if (i.tiles.some((x) => x.x === t.x && x.y === t.y)) {
        if (!best || (i.person && !best.person)) best = i;
      }
    }
    // walking members within one tile
    if (!best)
      for (const [id, o] of this.others) {
        if (Math.abs(o.w.tile.x - t.x) + Math.abs(o.w.tile.y - t.y) <= 1) {
          const hut = this.state?.huts.find((h) => h.memberId === id);
          best = {
            key: `walker:${id}`,
            tiles: [],
            rect: null,
            verb: "Talk to",
            target: o.plate.text.split(" · ")[0],
            action: { kind: "member", handle: hut?.handle ?? id },
          };
        }
      }
    return best;
  }

  lastPromptKey = "";
  updatePrompt() {
    const n = this.nearby();
    const key = n?.key ?? "";
    if (key === this.lastPromptKey) return;
    this.lastPromptKey = key;
    const prompt: Prompt | null = n ? { key, verb: n.verb, target: n.target, action: n.action } : null;
    village.set({ prompt, announce: n ? `${n.target || n.verb} ahead, press E` : "" });
  }

  interact() {
    const n = this.nearby();
    if (n) this.run(n.action);
  }

  run(a: Interact) {
    switch (a.kind) {
      case "place":
        if (a.placeId === "tavern") return this.enterTavern();
        return this.opts.navigate(a.route);
      case "member":
        this.waveAt();
        return village.set({ dialog: { kind: "member", handle: a.handle } });
      case "sign":
        return village.set({ dialog: { kind: "sign", handle: a.handle } });
      case "own-hut":
        return this.opts.navigate("/hut");
      case "mailbox":
        return this.opts.navigate("/inbox");
      case "map-stand":
        return village.set({ overlay: "map" });
      case "barkeep":
        return village.set({ dialog: { kind: "barkeep" } });
      default:
        return undefined;
    }
  }

  waveAt() {
    this.player.play("wave");
    void fetch("/api/v1/village/wave", { method: "POST" }).catch(() => {});
  }

  enterTavern() {
    village.set({ fade: true });
    this.time.delayedCall(200, () => {
      this.flushWalks();
      this.es?.close();
      this.es = null;
      this.scene.sleep();
      this.scene.run("tavern", {
        ...this.opts,
        look: this.player.texKey,
        viewerLook: this.state?.viewer.look,
      });
      village.set({ fade: false, scene: "tavern", prompt: null });
    });
  }

  onCommand(c: Parameters<Parameters<typeof village.onCommand>[0]>[0]) {
    if (!sceneAlive(this)) return;
    if (c.c === "interact") this.interact();
    if (c.c === "wave") this.waveAt();
    if (c.c === "say") this.say(c.text);
    if (c.c === "look") this.player.setLook(c.look);
    if (c.c === "reload") void this.reload();
    if (c.c === "travel") {
      const to = c.to;
      if ("placeId" in to) {
        const p = PLACES.find((x) => x.id === to.placeId);
        if (p) this.quickTravel(p.front);
      } else if ("handle" in to) {
        const h = this.state?.huts.find((x) => x.handle === to.handle);
        const plot = h ? PLOTS[h.plot] : null;
        if (plot) this.quickTravel({ x: plot.x + 1, y: plot.y + 3 });
      } else this.quickTravel({ x: to.x, y: to.y });
    }
  }

  async reload() {
    const r = await fetch("/api/v1/village/state", { cache: "no-store" });
    if (!r.ok) return;
    const s = (await r.json()) as VillageState;
    village.set({ state: s });
    // the page may have left while the request was in flight
    if (sceneAlive(this)) this.applyState(s);
  }

  say(text: string) {
    const t = text.trim().slice(0, 140);
    if (!t) return;
    this.bubble(this.player.sprite, t);
    void fetch("/api/v1/village/say", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    }).catch(() => {});
  }

  bubble(on: Phaser.GameObjects.Sprite, text: string) {
    const t = this.add
      .text(0, 0, text, {
        fontFamily: this.bodyFont,
        fontSize: "7px",
        color: "#2b1b33",
        wordWrap: { width: 90 },
        resolution: this.opts.zoom * 2,
      })
      .setOrigin(0.5, 1);
    const bg = this.add.graphics();
    const w = t.width + 6;
    const h = t.height + 4;
    bg.fillStyle(0xfbf6ec, 1)
      .fillRect(-w / 2, -h - 1, w, h)
      .lineStyle(1, 0x2b1b33, 1)
      .strokeRect(-w / 2, -h - 1, w, h);
    const c = this.add.container(on.x, on.y - 34, [bg, t]).setDepth(8600);
    t.setPosition(0, -3);
    this.time.delayedCall(5000, () => c.destroy());
    return c;
  }

  // ── Presence ─────────────────────────────────────────────────────────────

  connect() {
    if (this.es || !sceneAlive(this)) return;
    const t = this.player.tile;
    const es = new EventSource(`/api/v1/village/stream?x=${t.x}&y=${t.y}`);
    this.es = es;
    es.onmessage = (m) => this.onHub(JSON.parse(m.data) as HubEvent);
  }

  onHub(e: HubEvent) {
    if (e.t === "snapshot") for (const p of e.players) this.addOther(p);
    if (e.t === "join") this.addOther(e.p);
    if (e.t === "leave") {
      const o = this.others.get(e.id);
      o?.w.sprite.destroy();
      o?.plate.destroy();
      this.others.delete(e.id);
    }
    if (e.t === "move") {
      const o = this.others.get(e.id);
      if (o) {
        o.target = { x: e.x, y: e.y };
        o.w.dir = e.dir;
      }
    }
    if (e.t === "say") {
      const o = this.others.get(e.id);
      if (o) this.bubble(o.w.sprite, e.text);
    }
    if (e.t === "wave") this.others.get(e.id)?.w.play("wave");
  }

  addOther(p: PublicPlayer) {
    if (this.others.has(p.memberId)) return;
    const w = new Walker(this, p.look, { x: p.x, y: p.y });
    w.dir = p.dir;
    const hut = this.state?.huts.find((h) => h.memberId === p.memberId);
    const plate = this.addPlate(
      w.sprite.x,
      w.sprite.y - 33,
      `${p.name.split(" ")[0]} · ${hut?.presenceLabel ?? "Online"}`,
    );
    this.others.set(p.memberId, { w, plate, target: { x: p.x, y: p.y } });
  }

  sendMove(force = false) {
    const now = performance.now();
    if (!force && now - this.lastSent < 125) return; // 8 Hz
    this.lastSent = now;
    const p = this.player;
    const t = p.to ?? p.tile;
    void fetch("/api/v1/village/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: t.x, y: t.y, dir: p.dir, anim: p.to ? "walk" : "idle" }),
      keepalive: true,
    }).catch(() => {});
  }

  flushWalks() {
    if (!this.walks.size) return;
    const body = [...this.walks.entries()].map(([k, n]) => [...k.split(",").map(Number), n]);
    this.walks.clear();
    void fetch("/api/v1/village/walks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  }

  // ── Scenery life: non-human, no nameplates, never clickable ──────────────

  critters: { s: Phaser.GameObjects.Sprite; home: Pt; r: number; t: number; water?: boolean }[] = [];
  setupCritters() {
    if (this.opts.lowEnd) return;
    const add = (kind: "chicken" | "duck", x: number, y: number, r: number, water = false) => {
      const k = critterTexture(this, kind);
      const s = this.add
        .sprite(x * TS, y * TS, k, "0")
        .setOrigin(0.5, 1)
        .setDepth(y * TS);
      s.play(`${k}|go`);
      this.critters.push({ s, home: { x: x * TS, y: y * TS }, r, t: 0, water });
    };
    add("chicken", 52, 6, 22);
    add("chicken", 54, 6, 22);
    add("chicken", 43, 13, 18);
    add("duck", 8, 39.5, 26, true);
    add("duck", 11, 40.5, 26, true);
    add("duck", 6, 41, 18, true);
    // the market cat
    const mk = kittyTexture(this, "v1.c01.p1.l2.w0.e1.r0.t1.b1.s1");
    this.add
      .sprite(61 * TS + 8, 41 * TS + 15, mk)
      .setOrigin(0.5, 1)
      .setDepth(41 * TS + 15)
      .play(`${mk}|down:sleep`);
    // birds now and then
    this.time.addEvent({
      delay: 14_000,
      loop: true,
      callback: () => {
        if (this.opts.reduced) return;
        const k = critterTexture(this, "bird");
        const cam = this.cameras.main.worldView;
        const b = this.add
          .sprite(cam.x - 10, cam.y + 20 + Math.random() * cam.height * 0.4, k, "0")
          .setDepth(9500);
        b.play(`${k}|go`);
        this.tweens.add({
          targets: b,
          x: cam.right + 20,
          y: b.y + 30,
          duration: 7000,
          onComplete: () => b.destroy(),
        });
      },
    });
  }

  weather: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Rare and light (§10.5): falling leaves in autumn, otherwise a drizzle. Off with reduced motion. */
  setupWeather() {
    if (this.opts.reduced || this.opts.lowEnd) return;
    const d = new Date();
    const seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
    if ((Math.sin(seed) + 1) / 2 > 0.22) return; // most days are clear
    const autumn = [8, 9, 10].includes(d.getMonth());
    const k = autumn ? "wx:leaf" : "wx:drop";
    if (!this.textures.exists(k)) {
      const p = new Px(autumn ? 3 : 1, autumn ? 2 : 3);
      if (autumn) p.rect(0, 0, 3, 2, "#e8836b").set(1, 1, "#c86650");
      else p.rect(0, 0, 1, 3, "#86bedf");
      addPx(this, k, p);
    }
    this.weather = this.add
      .particles(0, 0, k, {
        x: { min: 0, max: MAP_W * TS },
        y: -10,
        lifespan: 9000,
        speedY: autumn ? { min: 12, max: 22 } : { min: 90, max: 120 },
        speedX: autumn ? { min: -10, max: 10 } : { min: -6, max: -2 },
        frequency: autumn ? 160 : 35,
        alpha: autumn ? 0.9 : 0.5,
        rotate: autumn ? { min: 0, max: 360 } : 0,
      })
      .setDepth(9600);
  }

  // ── Loop ─────────────────────────────────────────────────────────────────

  update(_time: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    const p = this.player;
    const speed = this.keys.SHIFT.isDown ? RUN : WALK;

    if (p.to) {
      p.t += dt * speed;
      const a = feet(p.from);
      const b = feet(p.to);
      const k = Math.min(1, p.t);
      p.sprite.setPosition(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k).setDepth(p.sprite.y);
      if (p.t >= 1) {
        p.tile = p.to;
        p.from = p.to;
        p.to = null;
        p.t = 0;
        this.onTile();
      }
    }
    if (!p.to) {
      const kd = this.keyDir();
      let next: Pt | null = null;
      if (kd) {
        p.path = [];
        p.onArrive = null;
        const t = { x: p.tile.x + kd.x, y: p.tile.y + kd.y };
        p.dir = dirOf(kd.x, kd.y);
        if (!this.isBlocked(t.x, t.y)) next = t;
      } else if (p.path.length) next = p.path.shift()!;
      if (next) {
        p.dir = dirOf(next.x - p.tile.x, next.y - p.tile.y);
        p.to = next;
        p.t = 0;
        p.play("walk");
        this.trail.push({ ...p.tile });
        if (this.trail.length > 4) this.trail.shift();
        this.idleSince = this.time.now;
        this.sendMove();
      } else {
        const playing = p.sprite.anims.currentAnim?.key ?? "";
        if (!playing.endsWith(":wave") || !p.sprite.anims.isPlaying) p.play("idle", this.opts.reduced);
        if (p.onArrive) {
          const f = p.onArrive;
          p.onArrive = null;
          f();
        }
      }
    }

    // others: interpolate toward their last reported tile
    for (const o of this.others.values()) {
      const tgt = feet(o.target);
      const dx = tgt.x - o.w.sprite.x;
      const dy = tgt.y - o.w.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const step = Math.min(dist, RUN * TS * dt);
        o.w.sprite
          .setPosition(o.w.sprite.x + (dx / dist) * step, o.w.sprite.y + (dy / dist) * step)
          .setDepth(o.w.sprite.y);
        o.w.dir = dirOf(dx, dy);
        o.w.play("walk");
      } else if (!(o.w.sprite.anims.currentAnim?.key ?? "").endsWith(":wave") || !o.w.sprite.anims.isPlaying)
        o.w.play("idle", this.opts.reduced);
      o.w.tile = { x: Math.floor(o.w.sprite.x / TS), y: Math.floor((o.w.sprite.y - 1) / TS) };
      o.plate.setPosition(o.w.sprite.x, o.w.sprite.y - 33);
    }

    this.updateKitty(dt);
    for (const c of this.critters) {
      c.t += dt;
      if (this.opts.reduced) continue;
      const ang = c.t * (c.water ? 0.25 : 0.5) + c.home.x;
      c.s.setPosition(
        c.home.x + Math.cos(ang) * c.r * 0.6,
        c.home.y + Math.sin(ang * 1.3) * c.r * (c.water ? 0.25 : 0.3),
      );
      c.s.setFlipX(Math.sin(ang) > 0);
    }
  }

  onTile() {
    const t = this.player.tile;
    const k = `${t.x},${t.y}`;
    // Only real steps count toward worn paths; quick-travel doesn't wear the grass.
    this.walks.set(k, (this.walks.get(k) ?? 0) + 1);
    this.arrived();
  }

  /** Standing on a new tile, by walking or by quick-travel. */
  arrived() {
    const t = this.player.tile;
    this.sendMove();
    this.updatePrompt();
    // Onboarding step 4: reach the Well — walking or by map, either counts (walking is never a tax).
    if (
      !this.reachedWell &&
      village.get().state?.viewer.onboardingStep === 4 &&
      Math.abs(t.x - 31) <= 2 &&
      t.y >= 21 &&
      t.y <= 25
    ) {
      this.reachedWell = true;
      this.events.emit("reached-well");
      window.dispatchEvent(new Event("village:reached-well"));
    }
  }
  reachedWell = false;

  updateKitty(dt: number) {
    const code = this.state?.viewer.kitty?.code;
    if (!code) return;
    if (!this.kitty) {
      const key = kittyTexture(this, code);
      const at = { x: this.player.tile.x, y: this.player.tile.y + 1 };
      const f = feet(at);
      this.kitty = {
        sprite: this.add.sprite(f.x, f.y + 1, key).setOrigin(0.5, 1),
        tile: at,
        from: at,
        to: null,
        t: 0,
        dir: "up",
        key,
      };
    }
    const k = this.kitty;
    if (k.to) {
      k.t += dt * (this.keys.SHIFT.isDown ? RUN : WALK);
      const a = feet(k.from);
      const b = feet(k.to);
      const m = Math.min(1, k.t);
      k.sprite.setPosition(a.x + (b.x - a.x) * m, a.y + (b.y - a.y) * m + 1).setDepth(k.sprite.y);
      if (k.t >= 1) {
        k.tile = k.to;
        k.from = k.to;
        k.to = null;
        k.t = 0;
      }
    }
    if (!k.to) {
      // follow one step behind
      const goal = this.trail.length >= 2 ? this.trail[this.trail.length - 1] : null;
      const far = Math.abs(k.tile.x - this.player.tile.x) + Math.abs(k.tile.y - this.player.tile.y);
      if (goal && far > 1 && !(goal.x === k.tile.x && goal.y === k.tile.y)) {
        const path = astar((x, y) => this.isBlocked(x, y), MAP_W, MAP_H, k.tile, goal, 400);
        if (path?.length) {
          k.to = path[0];
          k.dir = dirOf(k.to.x - k.tile.x, k.to.y - k.tile.y);
        }
      }
      if (far > 8) {
        k.tile = { ...this.player.tile };
        k.from = { ...k.tile };
      }
    }
    const idle = this.time.now - this.idleSince > 25_000;
    const anim = k.to ? "walk" : idle ? "sleep" : "sit";
    const v = k.dir === "left" ? "right" : k.dir;
    k.sprite.setFlipX(k.dir === "left");
    const key = `${k.key}|${anim === "sleep" ? "down" : v}:${anim}`;
    if (k.sprite.anims.currentAnim?.key !== key) k.sprite.play(key);
  }
}

// ── Inside The Swapped Mug ───────────────────────────────────────────────────

type Seat = { memberId: string; you: boolean; name: string; accepted: boolean; look: VillagerLook };

export class TavernScene extends Phaser.Scene {
  opts!: Options & { viewerLook?: VillagerLook };
  player!: Walker;
  inter: { tiles: Pt[]; verb: string; target: string; action: Interact; rect: Phaser.Geom.Rectangle }[] = [];
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  bodyFont = "sans-serif";
  pixelFont = "monospace";

  constructor() {
    super("tavern");
  }

  init(data: Options & { viewerLook?: VillagerLook }) {
    this.opts = data;
  }

  async create() {
    const css = getComputedStyle(document.body);
    this.pixelFont = css.getPropertyValue("--font-pixelify").trim() || "monospace";
    this.bodyFont = css.getPropertyValue("--font-inter").trim() || "sans-serif";
    this.cameras.main.setBackgroundColor("#2b1b33");
    this.add
      .image(0, 0, addPx(this, "tavern:bg", tavernInterior()))
      .setOrigin(0, 0)
      .setDepth(-10);
    // fire
    const f0 = addPx(this, "fire:0", flame(0));
    addPx(this, "fire:1", flame(1));
    const fire = this.add
      .image(16 + 14, 16 + 22, f0)
      .setOrigin(0, 0)
      .setDepth(-5);
    if (!this.opts.reduced)
      this.time.addEvent({
        delay: 220,
        loop: true,
        callback: () => fire.setTexture(fire.texture.key === "fire:0" ? "fire:1" : "fire:0"),
      });
    // the Barkeep, always labelled as an AI
    const bk = new Walker(this, BARKEEP_LOOK, BARKEEP);
    bk.dir = "down";
    bk.play("idle", this.opts.reduced);
    bk.sprite.setDepth(-4);
    this.plate(bk.sprite.x, bk.sprite.y - 33, "Barkeep · AI");
    this.inter.push({
      tiles: [
        { x: 15, y: 6 },
        { x: 14, y: 6 },
        { x: 16, y: 6 },
      ],
      verb: "Talk to",
      target: "the Barkeep",
      action: { kind: "barkeep" },
      rect: bk.sprite.getBounds(),
    });
    this.inter.push({
      tiles: [
        { x: 6, y: 4 },
        { x: 5, y: 4 },
        { x: 7, y: 4 },
      ],
      verb: "Read",
      target: "the chalkboard",
      action: { kind: "chalkboard" },
      rect: new Phaser.Geom.Rectangle(CHALK.x * TS, CHALK.y * TS, CHALK.w * TS, CHALK.h * TS),
    });
    this.inter.push({
      tiles: [
        { x: EXIT.x, y: EXIT.y - 1 },
        { x: EXIT.x + 1, y: EXIT.y - 1 },
      ],
      verb: "Leave",
      target: "the tavern",
      action: { kind: "exit-tavern" },
      rect: new Phaser.Geom.Rectangle(EXIT.x * TS, EXIT.y * TS, 32, 16),
    });

    // tables: one per proposed swap cycle
    const tk = addPx(this, "tavern:table", table());
    const ck = addPx(this, "tavern:chair", chair());
    let tables: { id: string; size: number; seats: Seat[] }[] = [];
    try {
      const r = await fetch("/api/v1/village/tavern", { cache: "no-store" });
      if (r.ok) tables = ((await r.json()) as { tables: typeof tables }).tables;
    } catch {
      /* the room still works without tables */
    }
    if (!sceneAlive(this)) return;
    if (!tables.length)
      this.plate(10 * TS, 9 * TS, "No swap cycles yet. Tell the Barkeep what you want to learn.", false);
    tables.forEach((t, i) => {
      const plot = TABLE_PLOTS[i];
      const x0 = plot.x * TS;
      const y0 = plot.y * TS;
      const seats = [
        [x0 - 8, y0 + 14],
        [x0 + 36, y0 + 14],
        [x0 + 14, y0 - 6],
        [x0 + 14, y0 + 34],
        [x0 - 8, y0 + 30],
      ].slice(0, t.size);
      t.seats.forEach((s, j) => {
        const [sx, sy] = seats[j] ?? seats[0];
        this.add
          .image(sx, sy, ck)
          .setOrigin(0.5, 0.5)
          .setDepth(sy - 1);
        if (s.accepted && !s.you) {
          const w = new Walker(this, s.look, { x: 0, y: 0 });
          w.sprite.setPosition(sx, sy + 6).setDepth(sy + 6);
          w.dir = "down";
          w.play("sit");
        }
      });
      this.add
        .image(x0, y0, tk)
        .setOrigin(0, 0)
        .setDepth(y0 + 32);
      this.plate(
        x0 + 16,
        y0 - 12,
        `A swap for ${t.size === 2 ? "two" : t.size === 3 ? "three" : t.size === 4 ? "four" : "five"} · ${t.seats.filter((s) => s.accepted).length}/${t.size}`,
      );
      const around = [
        { x: plot.x - 1, y: plot.y },
        { x: plot.x + 2, y: plot.y },
        { x: plot.x, y: plot.y + 2 },
        { x: plot.x + 1, y: plot.y + 2 },
        { x: plot.x, y: plot.y - 1 },
        { x: plot.x + 1, y: plot.y - 1 },
      ];
      this.inter.push({
        tiles: around,
        verb: "Sit at",
        target: `the swap for ${t.size}`,
        action: { kind: "table", cycleId: t.id },
        rect: new Phaser.Geom.Rectangle(x0, y0, 32, 32),
      });
    });

    this.player = new Walker(this, this.opts.viewerLook ?? lookFromSeed("you"), { x: EXIT.x, y: EXIT.y - 1 });
    this.player.dir = "up";
    const cam = this.cameras.main;
    cam.setBounds(0, 0, TAVERN_W * TS, TAVERN_H * TS);
    cam.setZoom(this.opts.zoom);
    cam.setRoundPixels(true);
    cam.startFollow(this.player.sprite, true, this.opts.reduced ? 1 : 0.18, this.opts.reduced ? 1 : 0.18);

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys("W,A,S,D,E,SHIFT") as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on("keydown-E", () => !village.inputBlocked() && this.interact());
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (village.inputBlocked()) return;
      const hit = this.inter.find((i) => i.rect.contains(p.worldX, p.worldY));
      if (hit) return this.walkTo(hit.tiles[0], () => this.run(hit.action));
      const t = { x: Math.floor(p.worldX / TS), y: Math.floor(p.worldY / TS) };
      const goal = tavernBlocked(t.x, t.y) ? nearestFree(tavernBlocked, TAVERN_W, TAVERN_H, t) : t;
      if (goal) this.walkTo(goal, null);
    });
    this.unsub = village.onCommand((c) => {
      if (!sceneAlive(this)) return;
      if (c.c === "interact") this.interact();
      if (c.c === "exit-tavern") this.leave();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsub());
    this.events.once(Phaser.Scenes.Events.SLEEP, () => this.unsub());
  }

  unsub: () => void = () => {};

  plate(x: number, y: number, text: string, pixel = true) {
    return this.add
      .text(x, y, text, {
        fontFamily: pixel ? this.pixelFont : this.bodyFont,
        fontSize: "7px",
        color: "#2b1b33",
        backgroundColor: "#fbf6ecdd",
        padding: { x: 2, y: 1 },
        resolution: this.opts.zoom * 2,
        wordWrap: { width: 160 },
      })
      .setOrigin(0.5, 1)
      .setDepth(8500);
  }

  walkTo(goal: Pt, then: (() => void) | null) {
    const path = astar(tavernBlocked, TAVERN_W, TAVERN_H, this.player.to ?? this.player.tile, goal);
    if (!path) return;
    this.player.path = path;
    this.player.onArrive = then;
    if (!path.length) then?.();
  }

  nearby() {
    const t = this.player.to ?? this.player.tile;
    return this.inter.find((i) => i.tiles.some((x) => x.x === t.x && x.y === t.y)) ?? null;
  }

  interact() {
    const n = this.nearby();
    if (n) this.run(n.action);
  }

  run(a: Interact) {
    if (a.kind === "barkeep") village.set({ dialog: { kind: "barkeep" } });
    if (a.kind === "chalkboard") village.set({ dialog: { kind: "chalkboard" } });
    if (a.kind === "table") this.opts.navigate(`/tavern/${a.cycleId}`);
    if (a.kind === "exit-tavern") this.leave();
  }

  leave() {
    village.set({ fade: true, prompt: null });
    this.time.delayedCall(200, () => {
      this.scene.stop();
      const v = this.scene.get("village") as VillageScene;
      this.scene.wake("village");
      v.teleport({ x: 23, y: 32 });
      v.player.dir = "down";
      village.set({ fade: false, scene: "village" });
    });
  }

  lastKey = "";
  update(_t: number, deltaMs: number) {
    if (!this.player) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    const p = this.player;
    if (p.to) {
      p.t += dt * (this.keys.SHIFT.isDown ? RUN : WALK);
      const a = feet(p.from);
      const b = feet(p.to);
      const k = Math.min(1, p.t);
      p.sprite.setPosition(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k).setDepth(p.sprite.y);
      if (p.t >= 1) {
        p.tile = p.to;
        p.from = p.to;
        p.to = null;
        p.t = 0;
        const n = this.nearby();
        const key = n ? `${n.verb}${n.target}` : "";
        if (key !== this.lastKey) {
          this.lastKey = key;
          village.set({
            prompt: n ? { key, verb: n.verb, target: n.target, action: n.action } : null,
            announce: n ? `${n.target} ahead, press E` : "",
          });
        }
      }
    }
    if (!p.to) {
      let next: Pt | null = null;
      if (!village.inputBlocked()) {
        const c = this.cursors;
        const k = this.keys;
        const d =
          c.left.isDown || k.A.isDown
            ? { x: -1, y: 0 }
            : c.right.isDown || k.D.isDown
              ? { x: 1, y: 0 }
              : c.up.isDown || k.W.isDown
                ? { x: 0, y: -1 }
                : c.down.isDown || k.S.isDown
                  ? { x: 0, y: 1 }
                  : null;
        if (d) {
          p.path = [];
          p.dir = dirOf(d.x, d.y);
          const t = { x: p.tile.x + d.x, y: p.tile.y + d.y };
          if (!tavernBlocked(t.x, t.y)) next = t;
          if (d.y > 0 && p.tile.y === TAVERN_H - 2 && (p.tile.x === EXIT.x || p.tile.x === EXIT.x + 1))
            this.leave();
        }
      }
      if (!next && p.path.length) next = p.path.shift()!;
      if (next) {
        p.dir = dirOf(next.x - p.tile.x, next.y - p.tile.y);
        p.to = next;
        p.play("walk");
      } else {
        p.play("idle", this.opts.reduced);
        if (p.onArrive) {
          const f = p.onArrive;
          p.onArrive = null;
          f();
        }
      }
    }
  }
}

export function startVillage(parent: HTMLElement, opts: Options) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: "#a8cf8e",
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    fps: opts.lowEnd ? { target: 30, limit: 30 } : { target: 60 },
    input: { gamepad: true, keyboard: { target: window } },
    disableContextMenu: true,
    banner: false,
    scene: [],
  });
  game.scene.add("village", VillageScene, true, opts);
  game.scene.add("tavern", TavernScene, false, opts);
  return game;
}

export type { Place };
