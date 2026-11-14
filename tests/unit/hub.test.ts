import { describe, expect, it } from "vitest";
import { lookFromSeed } from "@/modules/village/art/people";
import { Hub, MAX_WALKERS } from "@/modules/village/hub";

const player = (id: string, x: number, y: number, hidden = false) => ({
  memberId: id,
  handle: id,
  name: id,
  look: lookFromSeed(id),
  kitty: null,
  x,
  y,
  dir: "down" as const,
  anim: "idle" as const,
  hidden,
});
const sub = (id: string) => {
  const events: { t: string }[] = [];
  return { s: { memberId: id, send: (e: { t: string }) => events.push(e) }, events };
};

describe("presence hub", () => {
  it("only nearby players see each other move; moving away sends a leave", async () => {
    const h = new Hub();
    const a = sub("a");
    const b = sub("b");
    const c = sub("c");
    h.join(player("a", 10, 10), a.s);
    h.join(player("b", 12, 10), b.s);
    h.join(player("c", 60, 40), c.s);
    expect(b.events[0]).toMatchObject({ t: "snapshot" });
    expect((b.events[0] as unknown as { players: unknown[] }).players).toHaveLength(1); // sees a, not c
    h.move("a", 11, 10, "right", "walk");
    expect(b.events.some((e) => e.t === "move")).toBe(true);
    expect(c.events.some((e) => e.t === "move")).toBe(false);
    await new Promise((r) => setTimeout(r, 130));
    h.move("a", 40, 30, "right", "walk");
    expect(b.events.at(-1)).toMatchObject({ t: "leave", id: "a" });
  });
  it("caps position updates at 8 a second", () => {
    const h = new Hub();
    h.join(player("a", 1, 1), sub("a").s);
    expect(h.move("a", 2, 1, "right", "walk")).toBe(true);
    expect(h.move("a", 3, 1, "right", "walk")).toBe(false);
  });
  it("hide-me players are never broadcast", () => {
    const h = new Hub();
    const b = sub("b");
    h.join(player("b", 5, 5), b.s);
    h.join(player("a", 6, 5, true), sub("a").s);
    h.say("a", "hello");
    expect(b.events.some((e) => e.t === "join" || e.t === "say")).toBe(false);
  });
  it("opens a new village instance before one gets crowded", () => {
    const h = new Hub();
    for (let i = 0; i < MAX_WALKERS; i++) h.join(player(`p${i}`, 1, 1), sub(`p${i}`).s);
    const inst = h.join(player("late", 1, 1), sub("late").s);
    expect(inst).toBe("village-2");
  });
  it("speech is clipped to 140 characters", () => {
    const h = new Hub();
    const b = sub("b");
    h.join(player("b", 5, 5), b.s);
    h.join(player("a", 6, 5), sub("a").s);
    h.say("a", "x".repeat(300));
    expect((b.events.find((e) => e.t === "say") as unknown as { text: string }).text).toHaveLength(140);
  });
});
