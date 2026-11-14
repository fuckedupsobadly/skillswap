import { decode, stageForLevel } from "@/modules/game/genome";
import { type Needs, needsAt } from "@/modules/game/needs";
import { ANIMS, type AnimName } from "@/modules/game/rig/anim";
import type { Progress } from "@/modules/game/service";
import { type Behavior, choose } from "./brain";
import { Compositor, objectSprite } from "./compositor";
import { floorY, PerchMap, type Platform, path } from "./perch";
import { fetchProgress, type KittyStatus, kittyStore } from "./store";

/**
 * The page kitty. One full-viewport canvas with pointer-events: none; the kitty walks along the tops of
 * elements marked data-perch and along the bottom of the viewport, and never blocks anything the member
 * is trying to use (input is read from window events and only claimed for a deliberate press-and-hold).
 */
export type Api = {
  pet(): Promise<unknown>;
  slowBlink(): Promise<unknown>;
  feed(kind: "kibble" | "treat"): Promise<{ ok: boolean; error?: string }>;
  play(): Promise<unknown>;
};

type Step =
  | { k: "anim"; anim: AnimName; dur?: number; status?: KittyStatus }
  | { k: "walk"; plat: number; x: number; speed?: number; anim?: AnimName }
  | { k: "face"; dir: 1 | -1 }
  | { k: "do"; fn: () => void };

type Air = { x0: number; y0: number; x1: number; y1: number; t: number; T: number; h: number; plat: number };

const WALK = 46;
const RUN = 230;
const STALK = 26;
const GRAVITY = 2000;
const now = () => performance.now() / 1000;

export class KittyEngine {
  private ctx: CanvasRenderingContext2D;
  private perches: PerchMap;
  private comp: Compositor;
  private S = 3;
  private dpr = 1;
  private raf = 0;
  private timer = 0;
  private running = false;
  private lastT = 0;

  // Body
  private x = 120;
  private y = 0;
  private plat = 0;
  private offset = 0; // x relative to the platform's left edge, so the kitty rides along when you scroll
  private facing: 1 | -1 = 1;
  private mode: "ground" | "air" | "fall" | "held" = "ground";
  private air: Air | null = null;
  private vy = 0;

  // Animation
  private anim: AnimName = "idle";
  private frame = 0;
  private frameT = 0;
  private tick = 0;

  // Mind
  private steps: Step[] = [];
  private stepT = 0;
  private behavior: Behavior | "react" | "petting" | "held" | null = null;
  private needs: Needs;
  private needsAt = Date.now();
  private personality;
  private corner: boolean;
  private reduced: boolean;
  private forcedSleep = false;
  private hidden = false;

  // Input
  private px = -1;
  private py = -1;
  private pSpeed = 0;
  private pMovedAt = 0;
  private pLastT = 0;
  private stillSince = 0;
  private petT = 0;
  private petTotal = 0;
  private lastPetCall = 0;
  private lastBlinkCall = 0;
  private press: { x: number; y: number; t: number } | null = null;
  private suppressClick = false;

  // Objects on the page
  private toy: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    plat: number;
    until: number;
    held: boolean;
  } | null = null;
  private bowl: { x: number; full: boolean; until: number } | null = null;
  private treat: { until: number } | null = null;

  private seen = new Set<string>();
  private progress: Progress;
  private channel: BroadcastChannel | null = null;
  private tabId = Math.random().toString(36).slice(2);
  private joinDone = false;
  private visitDone = false;

  constructor(
    private canvas: HTMLCanvasElement,
    progress: Progress,
    private api: Api,
  ) {
    this.progress = progress;
    const k = progress.kitty!;
    this.comp = new Compositor({ code: k.code, stage: k.stage, equipped: k.equipped });
    this.personality = decode(k.code, k.personality).personality;
    this.needs = progress.needs ?? { hunger: 0.8, energy: 0.8, play: 0.7, affection: 0.7 };
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.corner = this.reduced || !progress.settings.roam;
    this.ctx = canvas.getContext("2d")!;
    this.perches = new PerchMap(() => this.wake());
    for (const e of progress.recent) this.seen.add(e.id);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  start() {
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerdown", this.onDown, { passive: true });
    window.addEventListener("pointerup", this.onUp, { passive: true });
    window.addEventListener("click", this.onClick, true);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("skillswap:kitty-poke", this.poll);
    if ("BroadcastChannel" in window) {
      this.channel = new BroadcastChannel("skillswap-kitty");
      this.channel.onmessage = (e) => {
        if (e.data?.awake && e.data.awake !== this.tabId) this.setForcedSleep(true);
      };
    }
    this.onFocus();
    this.arrive();
    this.pollTimer = window.setInterval(() => !document.hidden && this.poll(), 15_000);
    this.unsub = kittyStore.subscribe(this.onStore);
    this.running = true;
    this.lastT = now();
    this.loop();
  }

  private pollTimer = 0;
  private unsub: () => void = () => {};
  private lastRequest = 0;

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    clearInterval(this.pollTimer);
    this.unsub();
    this.perches.destroy();
    this.channel?.close();
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("click", this.onClick, true);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("skillswap:kitty-poke", this.poll);
  }

  private resize = () => {
    this.S = window.innerWidth < 640 ? 2 : 3;
    this.dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
    this.ctx.imageSmoothingEnabled = false;
    if (this.plat === 0) this.y = floorY();
    if (this.corner) this.toCorner();
    this.wake();
  };

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      clearTimeout(this.timer);
    } else {
      this.lastT = now();
      this.wake();
    }
  };

  private onFocus = () => {
    this.channel?.postMessage({ awake: this.tabId });
    this.setForcedSleep(false);
  };

  /** Only one awake kitty across tabs: the focused one. Others nap where they are. */
  private setForcedSleep(v: boolean) {
    if (this.forcedSleep === v) return;
    this.forcedSleep = v;
    if (v) this.plan("react", [{ k: "anim", anim: "sleep", dur: 1e9, status: "napping" }]);
    else if (this.behavior === "react")
      this.plan("react", [
        { k: "anim", anim: "stretch" },
        { k: "anim", anim: "idle", dur: 2 },
      ]);
  }

  private wake = () => {
    if (!this.running || document.hidden) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = 0;
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  // ── Loop ────────────────────────────────────────────────────────────────

  private loop = () => {
    if (!this.running || document.hidden) return;
    const t = now();
    const dt = Math.min(0.05, t - this.lastT);
    this.lastT = t;
    this.hidden = Boolean(document.querySelector("[data-kitty-asleep]")) || !this.progress.settings.showKitty;
    if (!this.hidden) {
      this.updateNeeds(dt);
      this.updateBody(dt);
      this.updateMind(dt);
      this.updateAnim(dt);
      this.updateObjects(dt);
    }
    this.render();
    // Full rate only while something moves; a sleeping, still kitty runs at 10 fps.
    const calm =
      this.mode === "ground" && (this.anim === "sleep" || this.anim === "loaf") && !this.toy && !this.press;
    if (calm || this.hidden) this.timer = window.setTimeout(() => this.loop(), 100);
    else this.raf = requestAnimationFrame(this.loop);
  };

  // ── Needs ───────────────────────────────────────────────────────────────

  private updateNeeds(dt: number) {
    const moving = this.anim === "run" || this.anim === "pounce" || this.anim === "jumpAir";
    const resting = this.anim === "sleep" || this.anim === "loaf";
    this.needs.energy = Math.max(
      0.05,
      Math.min(
        1,
        this.needs.energy + dt * (resting ? 0.006 : moving ? -0.01 : this.anim === "walk" ? -0.002 : 0),
      ),
    );
    if (Date.now() - this.needsAt > 60_000 && this.progress.needs) {
      const decayed = needsAt(this.progress.needs, new Date(this.needsAt), new Date());
      this.needs = { ...decayed, energy: this.needs.energy };
    }
  }

  // ── Body ────────────────────────────────────────────────────────────────

  private platform(): Platform | null {
    return this.perches.byId(this.plat);
  }

  private updateBody(dt: number) {
    if (this.mode === "held") return;
    if (this.mode === "air" && this.air) {
      const a = this.air;
      a.t = Math.min(1, a.t + dt / a.T);
      this.x = a.x0 + (a.x1 - a.x0) * a.t;
      this.y = a.y0 + (a.y1 - a.y0) * a.t - a.h * 4 * a.t * (1 - a.t);
      if (a.t >= 1) {
        const p = this.perches.byId(a.plat);
        if (p) this.land(p, a.x1);
        else this.startFall();
      }
      return;
    }
    if (this.mode === "fall") {
      const prev = this.y;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      const under = this.perches
        .read()
        .filter((p) => p.top >= prev - 1 && p.top <= this.y + 1 && this.x >= p.left && this.x <= p.right)
        .sort((a, b) => a.top - b.top)[0];
      if (under) this.land(under, this.x);
      return;
    }
    // On the ground: ride along with the platform when it scrolls; drop if it disappears.
    const p = this.platform();
    if (!p) {
      this.startFall();
      return;
    }
    this.y = p.top;
    this.x = Math.max(p.left, Math.min(p.right, p.left + this.offset));
  }

  private land(p: Platform, x: number) {
    this.mode = "ground";
    this.air = null;
    this.vy = 0;
    this.plat = p.id;
    this.x = Math.max(p.left, Math.min(p.right, x));
    this.y = p.top;
    this.offset = this.x - p.left;
    this.setAnim("jumpLand");
  }

  private startFall() {
    if (this.mode === "fall") return;
    this.mode = "fall";
    this.vy = 0;
    this.plat = -1;
    this.setAnim("jumpAir");
  }

  private jumpTo(p: Platform, x: number) {
    const x1 = Math.max(p.left, Math.min(p.right, x));
    const up = this.y - p.top;
    this.facing = x1 >= this.x ? 1 : -1;
    this.mode = "air";
    this.air = {
      x0: this.x,
      y0: this.y,
      x1,
      y1: p.top,
      t: 0,
      T: Math.min(0.85, 0.42 + Math.abs(x1 - this.x) / 1100 + Math.max(0, up) / 1400),
      h: up > 0 ? 40 + up * 0.25 : 24,
      plat: p.id,
    };
    this.setAnim("jumpAir");
  }

  private moveOn(p: Platform, to: number, speed: number, dt: number) {
    const target = Math.max(p.left, Math.min(p.right, to));
    const d = target - this.x;
    if (Math.abs(d) < 2) return true;
    this.facing = d > 0 ? 1 : -1;
    this.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    this.offset = this.x - p.left;
    return false;
  }

  private toCorner() {
    const vw = window.innerWidth;
    this.plat = 0;
    this.x = vw - 90;
    this.y = floorY();
    this.offset = this.x - 14;
    this.mode = "ground";
  }

  // ── Mind ────────────────────────────────────────────────────────────────

  private plan(b: Behavior | "react" | "petting" | "held", steps: Step[]) {
    this.behavior = b;
    this.steps = steps;
    this.stepT = 0;
  }

  /** Steps may still name a status, but what the dock shows is derived from what the kitty is doing. */
  private setStatus(_s: KittyStatus) {}

  private publishStatus() {
    const byAnim: Partial<Record<AnimName, KittyStatus>> = {
      sleep: "napping",
      knead: "napping",
      loaf: "loafing",
      groom: "grooming",
      walk: "exploring",
      jumpCrouch: "exploring",
      jumpAir: "exploring",
      jumpLand: "exploring",
      stalk: "hunting",
      pounce: "hunting",
      run: "zooming",
      eat: "eating",
      purr: "purring",
      stretch: "stretching",
      yawn: "stretching",
      hop: "playing",
      push: "playing",
    };
    let s: KittyStatus = byAnim[this.anim] ?? "sitting";
    if (this.hidden) s = "sleeping";
    else if (this.mode === "held") s = "playing";
    else if (this.toy && s !== "eating") s = "playing";
    else if (this.behavior === "waitBowl" && s === "sitting") s = "waiting";
    else if (this.behavior === "hunt" && (s === "sitting" || s === "exploring")) s = "hunting";
    if (kittyStore.get().status !== s) kittyStore.set({ status: s });
  }

  private setAnim(a: AnimName) {
    if (this.anim === a) return;
    this.anim = a;
    this.frame = 0;
    this.frameT = 0;
  }

  private updateMind(dt: number) {
    if (this.mode !== "ground") return;
    this.checkPetting(dt);
    const step = this.steps[0];
    if (!step) {
      this.decide();
      return;
    }
    this.stepT += dt;
    const p = this.platform();
    switch (step.k) {
      case "do":
        step.fn();
        this.next();
        break;
      case "face":
        this.facing = step.dir;
        this.next();
        break;
      case "anim": {
        if (step.status) this.setStatus(step.status);
        const def = ANIMS[step.anim];
        if (this.anim !== step.anim && this.anim !== "jumpLand") this.setAnim(step.anim);
        if (this.anim === "jumpLand") break;
        const done =
          step.dur !== undefined
            ? this.stepT >= step.dur
            : !def.loop && this.frame >= def.frames.length - 1 && this.frameT > 0.6 / def.fps;
        if (done) this.next();
        // Idle life: blinks and the odd tail flick while sitting.
        if (step.anim === "idle" && Math.random() < dt * 0.25)
          this.steps.splice(
            1,
            0,
            { k: "anim", anim: Math.random() < 0.75 ? "blink" : "tailFlick" },
            { k: "anim", anim: "idle", dur: 1 + Math.random() * 2 },
          );
        break;
      }
      case "walk": {
        if (!p) break;
        if (this.anim === "jumpLand") break;
        if (step.plat === this.plat) {
          this.setAnim(step.anim ?? (step.speed && step.speed > 120 ? "run" : "walk"));
          if (this.moveOn(p, step.x, step.speed ?? WALK, dt)) this.next();
        } else {
          const route = path(this.perches.read(), this.plat, step.plat);
          const hop = route && this.perches.byId(route[0]);
          if (!hop) {
            this.next();
            break;
          }
          // Walk to the take-off point nearest the next platform, then jump.
          const landing = Math.max(hop.left + 8, Math.min(hop.right - 8, this.x));
          const takeoff = Math.max(
            p.left,
            Math.min(p.right, landing + (hop.left > p.right ? -6 : hop.right < p.left ? 6 : 0)),
          );
          this.setAnim(step.anim ?? "walk");
          if (this.moveOn(p, takeoff, step.speed ?? WALK * 1.6, dt)) this.jumpTo(hop, landing);
        }
        break;
      }
    }
  }

  private next() {
    this.steps.shift();
    this.stepT = 0;
  }

  private cursorPlatform(): Platform | null {
    if (this.px < 0) return null;
    return (
      this.perches
        .read()
        .filter((p) => p.top >= this.py - 8 && this.px >= p.left - 20 && this.px <= p.right + 20)
        .sort((a, b) => a.top - b.top)[0] ?? null
    );
  }

  private decide() {
    const t = Date.now();
    const plats = this.perches.read();
    const here = this.platform() ?? plats[0];
    if (this.forcedSleep)
      return this.plan("react", [{ k: "anim", anim: "sleep", dur: 30, status: "napping" }]);

    // A session about to start: walk over to its Join button and sit beside it.
    const join = !this.corner && !this.joinDone ? document.querySelector("[data-kitty-join]") : null;
    if (join) {
      this.joinDone = true;
      const r = join.getBoundingClientRect();
      const target = plats
        .filter((p) => p.id !== 0 && p.top <= r.top + 4 && p.left <= r.right && p.right >= r.left)
        .sort((a, b) => b.top - a.top)[0];
      if (target)
        return this.plan("explore", [
          { k: "walk", plat: target.id, x: r.right + 18 },
          { k: "anim", anim: "idle", dur: 6, status: "waiting" },
        ]);
    }

    // Visiting (rank Puma and up): wander over to the profile you're viewing and greet its kitty.
    const visit = !this.corner && !this.visitDone ? document.querySelector("[data-kitty-visit]") : null;
    if (visit) {
      this.visitDone = true;
      const target = plats.find((p) => p.el === visit);
      if (target)
        return this.plan("explore", [
          { k: "walk", plat: target.id, x: target.right - 30 },
          { k: "face", dir: -1 },
          { k: "anim", anim: "slowBlink", status: "sitting" },
          { k: "anim", anim: "purr", dur: 2 },
          { k: "anim", anim: "idle", dur: 6 },
        ]);
    }

    const cursorRecent = t - this.pMovedAt < 3000;
    const kittyMid = this.y - 15 * this.S;
    const b = choose({
      needs: this.needs,
      personality: this.personality,
      hour: new Date().getHours() + new Date().getMinutes() / 60,
      cursorRecent: cursorRecent && !this.corner,
      cursorNear: Math.hypot(this.px - this.x, this.py - kittyMid) < 160,
      cursorAbove: this.py >= 0 && this.py < this.y - 200,
      cursorIdle: this.px >= 0 && t - this.pMovedAt > 2500 && t - this.pMovedAt < 30000,
      perchesAvailable: plats.length > 1 && !this.corner,
      toyOnPlatform: Boolean(this.toy && this.toy.plat === this.plat),
      onFloor: this.plat === 0,
      reduced: this.corner,
      last: (this.behavior as Behavior) ?? null,
    });
    const r = (a: number, z: number) => a + Math.random() * (z - a);
    const nap = this.personality.sleepy;
    switch (b) {
      case "nap": {
        const warm = plats.find((p) => p.warm);
        const go: Step[] =
          warm && !this.corner && Math.random() < 0.65
            ? [{ k: "walk", plat: warm.id, x: (warm.left + warm.right) / 2 + r(-30, 30) }]
            : [];
        return this.plan("nap", [
          ...go,
          { k: "anim", anim: "knead", dur: r(1.2, 2.4), status: "napping" },
          { k: "anim", anim: "sleep", dur: r(20, 50) * (0.7 + nap), status: "napping" },
          { k: "anim", anim: "stretch", status: "stretching" },
          { k: "anim", anim: "yawn" },
        ]);
      }
      case "loaf":
        return this.plan("loaf", [{ k: "anim", anim: "loaf", dur: r(10, 24), status: "loafing" }]);
      case "groom":
        return this.plan("groom", [{ k: "anim", anim: "groom", dur: r(3.5, 7), status: "grooming" }]);
      case "wander":
        return this.plan("wander", [
          { k: "walk", plat: here.id, x: r(here.left, here.right) },
          { k: "anim", anim: "idle", dur: r(2, 5), status: "sitting" },
        ]);
      case "explore": {
        const options = plats.filter(
          (p) => p.id !== this.plat && !p.el?.contains(document.activeElement) && !this.holdsSelection(p),
        );
        const dest = options[Math.floor(Math.random() * options.length)];
        if (!dest) break;
        return this.plan("explore", [
          { k: "walk", plat: dest.id, x: r(dest.left, dest.right), anim: "walk" },
          { k: "anim", anim: "idle", dur: r(3, 7), status: "exploring" },
        ]);
      }
      case "hunt": {
        const cp = this.cursorPlatform();
        if (!cp) break;
        const dir = this.px >= this.x ? 1 : -1;
        return this.plan("hunt", [
          ...(cp.id !== this.plat ? [{ k: "walk", plat: cp.id, x: this.px - dir * 120 } as Step] : []),
          { k: "walk", plat: cp.id, x: this.px - dir * 60, speed: STALK, anim: "stalk" },
          { k: "do", fn: () => this.pounceAt(this.px) },
          { k: "anim", anim: "idle", dur: 1.4, status: "hunting" },
          { k: "anim", anim: "tailFlick" },
        ]);
      }
      case "seek": {
        const cp = this.cursorPlatform();
        if (!cp) break;
        return this.plan("seek", [
          { k: "walk", plat: cp.id, x: this.px + (this.px > this.x ? -26 : 26), anim: "walk" },
          { k: "face", dir: this.px >= this.x ? 1 : -1 },
          { k: "anim", anim: "purr", dur: 2.5, status: "purring" },
          { k: "anim", anim: "idle", dur: 3 },
        ]);
      }
      case "zoomies": {
        const legs = 2 + Math.floor(Math.random() * 2);
        const s: Step[] = [];
        for (let i = 0; i < legs; i++)
          s.push({
            k: "walk",
            plat: here.id,
            x: i % 2 ? here.left + 10 : here.right - 10,
            speed: RUN,
            anim: "run",
          });
        this.setStatus("zooming");
        return this.plan("zoomies", [
          ...s,
          { k: "anim", anim: "idle", dur: 1.5, status: "sitting" },
          { k: "anim", anim: "groom", dur: 2.5 },
        ]);
      }
      case "chatter":
        return this.plan("chatter", [
          { k: "face", dir: this.px >= this.x ? 1 : -1 },
          { k: "anim", anim: "meow", status: "sitting" },
          { k: "anim", anim: "idle", dur: 0.8 },
          { k: "anim", anim: "meow" },
          { k: "anim", anim: "idle", dur: 3 },
        ]);
      case "push": {
        if (!this.toy) break;
        const toy = this.toy;
        return this.plan("push", [
          { k: "walk", plat: this.plat, x: toy.x - 20 * this.facing },
          { k: "anim", anim: "push", status: "playing" },
          {
            k: "do",
            fn: () => {
              if (!this.toy) return;
              this.toy.vx = 140 * this.facing;
              this.toy.vy = -60;
              this.toy.plat = -1;
            },
          },
          { k: "anim", anim: "idle", dur: 2 },
        ]);
      }
      case "perchNearCursor": {
        const near = plats
          .filter(
            (p) =>
              p.id !== 0 &&
              p.top < this.py &&
              p.top > this.py - 260 &&
              this.px >= p.left &&
              this.px <= p.right,
          )
          .sort((a, b) => b.top - a.top)[0];
        if (!near) break;
        return this.plan("explore", [
          { k: "walk", plat: near.id, x: this.px },
          { k: "anim", anim: "loaf", dur: r(8, 15), status: "loafing" },
        ]);
      }
      case "waitBowl": {
        const bx = this.bowlX();
        return this.plan("waitBowl", [
          { k: "walk", plat: 0, x: bx + 34 },
          { k: "face", dir: -1 },
          { k: "anim", anim: "meow", status: "waiting" },
          { k: "anim", anim: "idle", dur: 5 },
        ]);
      }
      default:
        break;
    }
    this.plan("sit", [{ k: "anim", anim: "idle", dur: r(4, 10), status: "sitting" }]);
  }

  private holdsSelection(p: Platform) {
    const sel = window.getSelection();
    return Boolean(p.el && sel && !sel.isCollapsed && sel.anchorNode && p.el.contains(sel.anchorNode));
  }

  private pounceAt(x: number) {
    const p = this.platform();
    if (!p) return;
    this.setAnim("pounce");
    this.jumpTo(p, x);
    if (this.air) {
      this.air.h = 30;
      this.air.T = 0.42;
    }
  }

  private bowlX() {
    const dock = document.querySelector("[data-kitty-dock]")?.getBoundingClientRect();
    return (dock ? dock.right : 220) + 36;
  }

  /** Arrival: found asleep after a long absence; otherwise a tail-up trot toward you, then a sit. */
  private arrive() {
    let away = 0;
    try {
      const last = Number(localStorage.getItem("skillswap:kitty-seen") ?? 0);
      away = last ? Date.now() - last : 0;
      localStorage.setItem("skillswap:kitty-seen", String(Date.now()));
    } catch {
      /* private mode: no memory, still fine */
    }
    if (this.corner) {
      this.toCorner();
      return this.plan("react", [{ k: "anim", anim: "idle", dur: 6, status: "sitting" }]);
    }
    this.plat = 0;
    this.x = this.bowlX() + 70;
    this.y = floorY();
    this.offset = this.x - 14;
    if (away > 3_600_000) {
      return this.plan("react", [
        { k: "anim", anim: "sleep", dur: 2.5, status: "napping" },
        { k: "anim", anim: "stretch", status: "stretching" },
        { k: "anim", anim: "meow" },
        { k: "anim", anim: "idle", dur: 3 },
      ]);
    }
    const target = this.px >= 0 ? this.px : window.innerWidth * 0.4;
    this.plan("react", [
      { k: "walk", plat: 0, x: target, anim: "walk" },
      { k: "anim", anim: "idle", dur: 3, status: "sitting" },
    ]);
  }

  // ── Input ───────────────────────────────────────────────────────────────

  private hitBox() {
    const S = this.S;
    const v = ANIMS[this.anim].view;
    if (v === "front") return { x: this.x - 12 * S, y: this.y - 32 * S, w: 24 * S, h: 32 * S };
    if (v === "curl") return { x: this.x - 17 * S, y: this.y - 15 * S, w: 34 * S, h: 15 * S };
    return { x: this.x - 20 * S, y: this.y - 25 * S, w: 40 * S, h: 25 * S };
  }

  private inBox(x: number, y: number, pad = 0) {
    const b = this.hitBox();
    return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
  }

  private onMove = (e: PointerEvent) => {
    const t = performance.now();
    if (this.px >= 0) {
      const d = Math.hypot(e.clientX - this.px, e.clientY - this.py);
      this.pSpeed = this.pSpeed * 0.7 + (d / Math.max(1, t - this.pLastT)) * 0.3;
      if (d > 1.5) this.stillSince = t;
      if (d > 0.5) this.pMovedAt = Date.now();
    } else this.stillSince = t;
    this.px = e.clientX;
    this.py = e.clientY;
    this.pLastT = t;
    if (
      this.press &&
      Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 6 &&
      this.mode !== "held"
    )
      this.press = null;
    if (this.mode === "held") {
      this.x = e.clientX;
      this.y = e.clientY + 28 * this.S;
    }
    if (this.toy?.held) {
      this.toy.x = e.clientX;
      this.toy.y = e.clientY + 10;
    }
    // Step aside when a fast-moving cursor heads straight for the kitty (it's probably aiming at a button).
    if (
      this.mode === "ground" &&
      this.pSpeed > 1.2 &&
      this.inBox(e.clientX, e.clientY, 30) &&
      !this.corner &&
      this.behavior !== "nap"
    ) {
      const p = this.platform();
      if (p)
        this.plan("wander", [
          {
            k: "walk",
            plat: p.id,
            x: this.x + (e.clientX < this.x ? 70 : -70),
            speed: RUN * 0.6,
            anim: "run",
          },
        ]);
    }
    this.wake();
  };

  private onDown = (e: PointerEvent) => {
    if (this.hidden || e.button !== 0) return;
    if (this.toy && Math.hypot(e.clientX - this.toy.x, e.clientY - this.toy.y) < 24) {
      this.toy.held = true;
      this.suppressClick = true;
      return;
    }
    if (!this.inBox(e.clientX, e.clientY)) return;
    this.press = { x: e.clientX, y: e.clientY, t: performance.now() };
    // Pick up only on a deliberate press-and-hold, so quick clicks still reach whatever is underneath.
    window.setTimeout(() => {
      if (!this.press || this.mode !== "ground") return;
      this.press = null;
      this.mode = "held";
      this.suppressClick = true;
      document.documentElement.style.userSelect = "none";
      this.plan("held", []);
      this.setAnim("jumpAir");
      this.setStatus("playing");
    }, 220);
  };

  private onUp = () => {
    this.press = null;
    if (this.toy?.held) {
      this.toy.held = false;
      this.toy.vy = 0;
      this.toy.plat = -1;
    }
    if (this.mode === "held") {
      document.documentElement.style.userSelect = "";
      this.mode = "ground";
      this.startFall();
      // Lands on its feet, then grooms, a little offended.
      this.plan("react", [
        { k: "anim", anim: "groom", dur: 2.5, status: "grooming" },
        { k: "anim", anim: "tailFlick" },
      ]);
    }
  };

  private onClick = (e: MouseEvent) => {
    if (!this.suppressClick) return;
    this.suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  /** Petting: slow movement over the kitty. Past its tolerance it flicks its tail and walks off. */
  private checkPetting(dt: number) {
    const t = performance.now();
    const over = this.px >= 0 && this.inBox(this.px, this.py) && !this.press;
    const slow = this.pSpeed < 0.55 && performance.now() - this.pLastT < 400;
    if (over && slow) {
      this.petT += dt;
      if (this.petT > 0.35) {
        this.petTotal += dt;
        if (this.anim === "sleep") {
          // A sleeping kitty just purrs in its sleep.
        } else if (this.behavior !== "petting") {
          this.plan("petting", [{ k: "anim", anim: "purr", dur: 1e9, status: "purring" }]);
        }
        if (Date.now() - this.lastPetCall > 45_000) {
          this.lastPetCall = Date.now();
          this.needs.affection = Math.min(1, this.needs.affection + 0.25);
          void this.api.pet();
        }
        const tolerance = 3 + (1 - this.personality.sassy) * 7 + this.personality.affectionate * 3;
        if (this.petTotal > tolerance && this.behavior === "petting") {
          const p = this.platform();
          this.petTotal = 0;
          this.plan("wander", [
            { k: "anim", anim: "tailFlick", status: "sitting" },
            ...(p ? [{ k: "walk", plat: p.id, x: this.x + (Math.random() < 0.5 ? -160 : 160) } as Step] : []),
          ]);
        }
      }
    } else {
      this.petT = 0;
      if (!over) this.petTotal = Math.max(0, this.petTotal - dt * 0.5);
      if (this.behavior === "petting")
        this.plan("sit", [{ k: "anim", anim: "idle", dur: 2, status: "sitting" }]);
    }
    // Slow blink: hover calmly near the kitty while it sits, and it slow-blinks back — "I trust you".
    const near =
      this.px >= 0 && Math.hypot(this.px - this.x, this.py - (this.y - 14 * this.S)) < 190 && !over;
    if (
      near &&
      t - this.stillSince > 1600 &&
      (this.anim === "idle" || this.anim === "loaf") &&
      this.behavior !== "react"
    ) {
      this.stillSince = t + 6000; // don't immediately repeat
      this.plan("react", [
        { k: "face", dir: this.px >= this.x ? 1 : -1 },
        { k: "anim", anim: "slowBlink", status: "sitting" },
        { k: "anim", anim: "idle", dur: 3 },
      ]);
      if (Date.now() - this.lastBlinkCall > 20_000) {
        this.lastBlinkCall = Date.now();
        void this.api.slowBlink();
      }
    }
  }

  // ── Requests from the dock, and progress events ────────────────────────

  private onStore = () => {
    const req = kittyStore.get().request;
    if (!req || req.id === this.lastRequest) return;
    this.lastRequest = req.id;
    if (req.kind === "play") return this.startPlay();
    void this.startFeed(req.kind === "treat" ? "treat" : "kibble");
  };

  private async startFeed(kind: "kibble" | "treat") {
    const res = await this.api.feed(kind);
    if (!res.ok) return kittyStore.notice(res.error ?? "Couldn't feed right now.");
    this.needs.hunger = Math.min(1, this.needs.hunger + (kind === "treat" ? 0.5 : 0.3));
    const name = this.progress.kitty?.name ?? "Your kitty";
    if (kind === "treat") {
      this.treat = { until: now() + 1.6 };
      this.plan("react", [
        { k: "anim", anim: "hop", status: "eating" },
        { k: "anim", anim: "eat", dur: 1.4 },
        { k: "anim", anim: "groom", dur: 2.5 },
      ]);
      kittyStore.notice(`${name} got a treat`);
    } else {
      const bx = this.bowlX();
      this.bowl = { x: bx, full: true, until: now() + 30 };
      this.plan("react", [
        { k: "walk", plat: 0, x: bx + 30 },
        { k: "face", dir: -1 },
        { k: "anim", anim: "eat", dur: 3.5, status: "eating" },
        {
          k: "do",
          fn: () => {
            if (this.bowl) this.bowl.full = false;
          },
        },
        { k: "anim", anim: "groom", dur: 3 },
      ]);
    }
    void this.poll();
  }

  private startPlay() {
    const p = this.platform() ?? this.perches.read()[0];
    const x = Math.max(p.left + 20, Math.min(p.right - 20, this.x + (Math.random() < 0.5 ? -140 : 140)));
    this.toy = { x, y: p.top, vx: 0, vy: 0, plat: p.id, until: now() + 22, held: false };
    void this.api.play();
    this.needs.play = Math.min(1, this.needs.play + 0.45);
    this.playRound();
  }

  private playRound() {
    if (!this.toy) return;
    const toy = this.toy;
    const dir = toy.x >= this.x ? 1 : -1;
    this.plan("react", [
      { k: "walk", plat: this.plat, x: toy.x - dir * 70, speed: STALK * 1.3, anim: "stalk" },
      {
        k: "do",
        fn: () => {
          if (!this.toy) return;
          this.pounceAt(this.toy.x);
          // Bat it on landing.
          window.setTimeout(() => {
            if (!this.toy) return;
            this.toy.vx = (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 120);
            this.toy.vy = -120;
            this.toy.plat = -1;
          }, 380);
        },
      },
      { k: "anim", anim: "idle", dur: 0.8, status: "playing" },
      { k: "do", fn: () => (this.toy && now() < this.toy.until ? this.playRound() : this.endPlay()) },
    ]);
  }

  private endPlay() {
    this.toy = null;
    this.plan("react", [{ k: "anim", anim: "groom", dur: 3, status: "grooming" }]);
  }

  private updateObjects(dt: number) {
    const toy = this.toy;
    if (toy && !toy.held && toy.plat === -1) {
      toy.vy += GRAVITY * 0.6 * dt;
      const prev = toy.y;
      toy.x += toy.vx * dt;
      toy.y += toy.vy * dt;
      toy.vx *= 1 - 1.5 * dt;
      const under = this.perches
        .read()
        .filter((p) => p.top >= prev - 1 && p.top <= toy.y + 1 && toy.x >= p.left && toy.x <= p.right)
        .sort((a, b) => a.top - b.top)[0];
      if (under) {
        toy.y = under.top;
        toy.plat = under.id;
        toy.vy = 0;
      }
      toy.x = Math.max(16, Math.min(window.innerWidth - 16, toy.x));
    } else if (toy && !toy.held) {
      const p = this.perches.byId(toy.plat);
      if (p) toy.y = p.top;
      else toy.plat = -1;
      toy.x += toy.vx * dt;
      toy.vx *= 1 - 3 * dt;
    }
    if (this.bowl && now() > this.bowl.until) this.bowl = null;
    if (this.treat && now() > this.treat.until) this.treat = null;
  }

  /** Re-read progress; react to anything new (settled session, five stars, level up, unlocks). */
  poll = async () => {
    const p = await fetchProgress();
    if (!p?.kitty) return;
    const before = this.progress;
    this.progress = p;
    kittyStore.set({ progress: p });
    this.corner = this.reduced || !p.settings.roam;
    this.needs = { ...(p.needs ?? this.needs), energy: this.needs.energy };
    this.needsAt = Date.now();
    const k = p.kitty;
    const stage = stageForLevel(p.level);
    if (
      JSON.stringify(k.equipped) !== JSON.stringify(before.kitty?.equipped) ||
      stage !== before.kitty?.stage
    ) {
      this.comp = new Compositor({ code: k.code, stage, equipped: k.equipped });
    }
    const fresh = p.recent.filter((e) => !this.seen.has(e.id)).reverse();
    for (const e of p.recent) this.seen.add(e.id);
    if (!fresh.length) return;
    const name = k.name;
    const sessionXp = fresh.filter((e) => e.bookingId).reduce((a, e) => a + e.amount, 0);
    const settled = fresh.some((e) => e.source === "teach" || e.source === "learn");
    const notices = p.settings.notices;
    if (settled) {
      this.treat = { until: now() + 1.6 };
      this.plan("react", [
        { k: "anim", anim: "hop", status: "eating" },
        { k: "anim", anim: "eat", dur: 1.2 },
        { k: "anim", anim: "groom", dur: 3, status: "grooming" },
      ]);
      if (notices) kittyStore.notice(`+${sessionXp} XP · ${name} got a treat`);
    } else if (fresh.some((e) => e.source === "five_star")) {
      this.plan("react", [
        { k: "anim", anim: "slowBlink" },
        { k: "anim", anim: "purr", dur: 2.5, status: "purring" },
      ]);
    }
    if (p.level > before.level) {
      this.steps.push(
        { k: "anim", anim: "stretch", status: "stretching" },
        { k: "anim", anim: "idle", dur: 2 },
      );
      if (notices) {
        const grew =
          stage !== before.kitty?.stage
            ? ` · ${name} grew into ${stage === "young" ? "a young cat" : "an adult cat"}`
            : "";
        window.setTimeout(() => kittyStore.notice(`Level ${p.level}${grew}`), settled ? 4000 : 0);
      }
    }
    if (p.rank !== before.rank && notices)
      window.setTimeout(() => kittyStore.notice(`New rank: ${p.rankName}`), 8000);
  };

  // ── Animation & drawing ────────────────────────────────────────────────

  private updateAnim(dt: number) {
    const def = ANIMS[this.anim];
    this.frameT += dt;
    const per = 1 / def.fps;
    while (this.frameT >= per) {
      this.frameT -= per;
      this.tick++;
      if (this.frame < def.frames.length - 1) this.frame++;
      else if (def.loop) this.frame = 0;
      else if (this.anim === "jumpLand" || this.anim === "pounce") {
        this.setAnim("idle");
        break;
      }
    }
  }

  private render() {
    const { ctx, S, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.publishStatus();
    if (this.hidden) return;
    const px = (v: number) => Math.round(v * dpr);
    const drawAt = (
      img: CanvasImageSource & { width: number; height: number },
      x: number,
      yBottom: number,
    ) => {
      ctx.drawImage(
        img,
        px(x - (img.width * S) / 2),
        px(yBottom - img.height * S),
        px(img.width * S),
        px(img.height * S),
      );
    };
    if (this.bowl) {
      const b = objectSprite(this.bowl.full ? "bowl-full" : "bowl");
      if (b) drawAt(b, this.bowl.x, floorY() + S);
    }
    // The bed appears under a napping kitty.
    const bed = this.progress.kitty?.equipped.bed;
    if (bed && (this.anim === "sleep" || this.anim === "loaf") && this.mode === "ground") {
      const s = objectSprite(bed);
      if (s) drawAt(s, this.x + (this.anim === "sleep" ? 2 * S : 0), this.y + S);
    }
    const img = this.comp.frame(
      this.anim,
      this.frame,
      ANIMS[this.anim].view === "front" ? 1 : this.facing,
      this.tick,
    ) as HTMLCanvasElement;
    ctx.drawImage(img, px(this.x - 24 * S), px(this.y - 45 * S), px(48 * S), px(48 * S));
    if (this.toy) {
      const s = objectSprite(this.progress.kitty?.equipped.toy ?? "paper");
      if (s) drawAt(s, this.toy.x, this.toy.y + S);
    }
    if (this.treat) {
      const s = objectSprite("treat");
      if (s) drawAt(s, this.x + 7 * S * this.facing, this.y - 30 * S);
    }
  }
}
