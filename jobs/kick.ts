import type { DB } from "@/db/client";
import { relay } from "./relay";

const g = globalThis as unknown as { __lastKick?: number };

/**
 * Flush the outbox after page renders too, not only after writes. Without this, an event committed just before
 * a crash or redeploy waits until someone else happens to write. Throttled per instance; the relay itself also
 * refuses to run twice at once and claims rows atomically, so this is safe to call often.
 */
export async function kickRelay(db: DB, minGapMs = 2000) {
  const now = Date.now();
  if (now - (g.__lastKick ?? 0) < minGapMs) return;
  g.__lastKick = now;
  try {
    await relay(db, { rounds: 3 });
  } catch (e) {
    console.error("[relay] kick failed", e);
  }
}
