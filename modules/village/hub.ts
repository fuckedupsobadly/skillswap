import type { VillagerLook } from "@/db/schema";

/**
 * Presence hub (§12). One instance holds up to ~60 walking members; positions are relayed at most 8 times a
 * second and only to players within ~20 tiles, so nobody downloads the whole village's movement.
 * This in-process hub serves a single server; with several instances, swap the transport for Ably channels
 * (one per village instance) behind the same three calls: join, move, say.
 */
export const MAX_WALKERS = 60;
export const RANGE = 20;
export const MOVE_HZ = 8;

export type Player = {
  memberId: string;
  handle: string;
  name: string;
  look: VillagerLook;
  kitty: string | null;
  x: number;
  y: number;
  dir: "down" | "up" | "left" | "right";
  anim: "idle" | "walk" | "wave" | "sit";
  hidden: boolean;
  instance: string;
  lastMoveAt: number;
};
export type HubEvent =
  | { t: "snapshot"; players: PublicPlayer[]; instance: string }
  | { t: "join"; p: PublicPlayer }
  | { t: "move"; id: string; x: number; y: number; dir: Player["dir"]; anim: Player["anim"] }
  | { t: "leave"; id: string }
  | { t: "say"; id: string; text: string }
  | { t: "wave"; id: string };
export type PublicPlayer = Omit<Player, "lastMoveAt" | "hidden" | "instance">;

type Sub = { memberId: string; send: (e: HubEvent) => void };

class Hub {
  players = new Map<string, Player>();
  subs = new Map<string, Set<Sub>>();

  private instanceFor(memberId: string) {
    const existing = this.players.get(memberId);
    if (existing) return existing.instance;
    const counts = new Map<string, number>();
    for (const p of this.players.values()) counts.set(p.instance, (counts.get(p.instance) ?? 0) + 1);
    // Open a new village before an instance gets crowded.
    for (let i = 1; ; i++) {
      const id = `village-${i}`;
      if ((counts.get(id) ?? 0) < MAX_WALKERS) return id;
    }
  }

  private near(a: Player, b: Player) {
    return a.instance === b.instance && Math.abs(a.x - b.x) <= RANGE && Math.abs(a.y - b.y) <= RANGE;
  }

  private pub(p: Player): PublicPlayer {
    const { lastMoveAt: _l, hidden: _h, instance: _i, ...rest } = p;
    return rest;
  }

  private broadcast(from: Player, e: HubEvent) {
    if (from.hidden) return;
    for (const [id, subs] of this.subs) {
      if (id === from.memberId) continue;
      const other = this.players.get(id);
      if (!other || !this.near(from, other)) continue;
      for (const s of subs) s.send(e);
    }
  }

  join(p: Omit<Player, "instance" | "lastMoveAt">, sub: Sub) {
    const player: Player = { ...p, instance: this.instanceFor(p.memberId), lastMoveAt: 0 };
    this.players.set(p.memberId, player);
    const set = this.subs.get(p.memberId) ?? new Set();
    set.add(sub);
    this.subs.set(p.memberId, set);
    const nearby = [...this.players.values()]
      .filter((o) => o.memberId !== p.memberId && !o.hidden && this.near(player, o))
      .map((o) => this.pub(o));
    sub.send({ t: "snapshot", players: nearby, instance: player.instance });
    this.broadcast(player, { t: "join", p: this.pub(player) });
    return player.instance;
  }

  leave(memberId: string, sub: Sub) {
    const set = this.subs.get(memberId);
    set?.delete(sub);
    if (set && set.size === 0) {
      this.subs.delete(memberId);
      const p = this.players.get(memberId);
      if (p) {
        this.broadcast(p, { t: "leave", id: memberId });
        this.players.delete(memberId);
      }
    }
  }

  move(memberId: string, x: number, y: number, dir: Player["dir"], anim: Player["anim"]) {
    const p = this.players.get(memberId);
    if (!p) return false;
    const now = Date.now();
    if (now - p.lastMoveAt < 1000 / MOVE_HZ) return false; // 8 Hz cap
    const wasNear = new Set(
      [...this.players.values()]
        .filter((o) => o.memberId !== memberId && this.near(p, o))
        .map((o) => o.memberId),
    );
    Object.assign(p, { x, y, dir, anim, lastMoveAt: now });
    // People who just came into range get a join; people who left range get a leave.
    for (const o of this.players.values()) {
      if (o.memberId === memberId || p.hidden) continue;
      const nowNear = this.near(p, o);
      const subs = this.subs.get(o.memberId);
      if (!subs) continue;
      if (nowNear && !wasNear.has(o.memberId)) for (const s of subs) s.send({ t: "join", p: this.pub(p) });
      if (!nowNear && wasNear.has(o.memberId)) for (const s of subs) s.send({ t: "leave", id: memberId });
    }
    this.broadcast(p, { t: "move", id: memberId, x, y, dir, anim });
    return true;
  }

  say(memberId: string, text: string) {
    const p = this.players.get(memberId);
    if (!p) return false;
    this.broadcast(p, { t: "say", id: memberId, text: text.slice(0, 140) });
    return true;
  }

  wave(memberId: string) {
    const p = this.players.get(memberId);
    if (p) this.broadcast(p, { t: "wave", id: memberId });
  }

  online() {
    return new Set(this.players.keys());
  }
}

const g = globalThis as unknown as { __villageHub?: Hub };
if (!g.__villageHub) g.__villageHub = new Hub();
export const hub = g.__villageHub;
export { Hub };
