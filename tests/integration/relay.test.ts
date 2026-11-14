import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { type DB, openPglite } from "@/db/client";
import { outbox } from "@/db/schema";
import * as handlers from "@/jobs/handlers";
import { relay } from "@/jobs/relay";

let db: DB;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await openPglite("memory://")));
afterAll(async () => close());

// Regression: failing events at the head of the outbox used to starve every event behind them.
it("a failing event backs off and never blocks the events after it", async () => {
  await db
    .insert(outbox)
    .values([
      ...Array.from({ length: 60 }, () => ({ topic: "member.joined", payload: { memberId: "bad" } })),
      { topic: "member.joined", payload: { memberId: "good" } },
    ]);
  const spy = vi.spyOn(handlers, "dispatch").mockImplementation(async (_db, _t, p) => {
    if ((p as { memberId: string }).memberId === "bad") throw new Error("boom");
  });
  await relay(db);
  const rows = await db.select().from(outbox);
  expect(
    rows.find((r) => (r.payload as { memberId: string }).memberId === "good")?.deliveredAt,
  ).not.toBeNull();
  const bad = rows.filter((r) => (r.payload as { memberId: string }).memberId === "bad");
  expect(bad.every((r) => r.attempts === 1 && r.nextAttemptAt.getTime() > Date.now())).toBe(true);
  spy.mockRestore();
  await db.execute(sql`select 1`);
});
