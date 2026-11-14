import { and, asc, eq, gt, isNull, lt, lte, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { outbox } from "@/db/schema";
import type { Topic } from "@/modules/platform/outbox";
import { dispatch } from "./handlers";
import { inngest, inngestEnabled } from "./inngest-client";
import { sweep } from "./sweep";

const MAX_ATTEMPTS = 8;
const g = globalThis as unknown as { __relayRunning?: boolean; __lastSweep?: number };

/**
 * Outbox relay: send committed events on. With Inngest configured they go to Inngest (durable, retried);
 * otherwise they are dispatched in-process. Each row is claimed with a conditional update, so concurrent
 * relays don't double-send, and delivery is at-least-once.
 */
export async function relay(db: DB, opts: { rounds?: number } = {}) {
  if (g.__relayRunning) return 0;
  g.__relayRunning = true;
  let sent = 0;
  try {
    // Page forward with a cursor so a failing event is skipped for this pass, never re-read in a loop.
    let cursor = 0;
    for (let round = 0; round < (opts.rounds ?? 12); round++) {
      const pending = await db
        .select()
        .from(outbox)
        .where(
          and(
            isNull(outbox.deliveredAt),
            lt(outbox.attempts, MAX_ATTEMPTS),
            lte(outbox.nextAttemptAt, new Date()),
            gt(outbox.id, cursor),
          ),
        )
        .orderBy(asc(outbox.id))
        .limit(50);
      if (pending.length === 0) break;
      cursor = pending[pending.length - 1].id;
      for (const ev of pending) {
        const claimed = await db
          .update(outbox)
          .set({ attempts: sql`${outbox.attempts} + 1` })
          .where(and(eq(outbox.id, ev.id), eq(outbox.attempts, ev.attempts), isNull(outbox.deliveredAt)))
          .returning({ id: outbox.id });
        if (claimed.length === 0) continue;
        try {
          if (inngestEnabled())
            await inngest.send({ name: ev.topic, data: ev.payload, id: `outbox-${ev.id}` });
          else await dispatch(db, ev.topic as Topic, ev.payload);
          await db
            .update(outbox)
            .set({ deliveredAt: new Date(), lastError: null })
            .where(eq(outbox.id, ev.id));
          sent++;
        } catch (e) {
          console.error(`[relay] ${ev.topic} #${ev.id} failed (attempt ${ev.attempts + 1})`, e);
          // Back off exponentially: 2, 4, 8 … seconds, capped at an hour.
          const wait = Math.min(3600, 2 ** (ev.attempts + 1)) * 1000;
          await db
            .update(outbox)
            .set({ lastError: String(e).slice(0, 500), nextAttemptAt: new Date(Date.now() + wait) })
            .where(eq(outbox.id, ev.id));
        }
      }
    }
    // Without Inngest's cron, sweep opportunistically at most once a minute per instance.
    if (!inngestEnabled() && Date.now() - (g.__lastSweep ?? 0) > 60_000) {
      g.__lastSweep = Date.now();
      await sweep(db);
    }
  } finally {
    g.__relayRunning = false;
  }
  return sent;
}
