import "server-only";
import { eq } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import type { z } from "zod";
import { type DB, getDb } from "@/db/client";
import { members } from "@/db/schema";
import { relay } from "@/jobs/relay";
import { LedgerError } from "@/modules/ledger/core";
import { DomainError } from "@/modules/platform/errors";
import { type Limit, rateLimit } from "@/modules/platform/rate-limit";
import { requireViewer, type Viewer } from "./viewer";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

/**
 * Every write follows one path:
 *   1. Zod validates the input.
 *   2. The session cookie resolves the member (sensitive actions also verify a device signature in the module).
 *   3. Rate limit for that action and member.
 *   4. The domain module runs inside one database transaction,
 *   5. which also writes its events to the outbox.
 *   6. After the response, the relay sends outbox events on to jobs and live updates.
 */
export async function run<S extends z.ZodType, T>(
  name: string,
  schema: S,
  input: unknown,
  limit: Limit,
  fn: (ctx: { db: DB; viewer: Viewer; input: z.infer<S> }) => Promise<T>,
): Promise<Result<T>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "invalid" };
    const viewer = await requireViewer();
    await rateLimit(`${name}:${viewer.memberId}`, limit);
    const db = await getDb();
    const data = await fn({ db, viewer, input: parsed.data });
    after(async () => {
      await db.update(members).set({ lastActiveAt: new Date() }).where(eq(members.id, viewer.memberId));
      await relay(db);
    });
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof DomainError) return { ok: false, error: e.message, code: e.code };
    if (e instanceof LedgerError) return { ok: false, error: e.message, code: e.code };
    console.error(`[action:${name}]`, e);
    return { ok: false, error: "Something went wrong. Nothing was changed.", code: "internal" };
  }
}

export const LIMITS = {
  read: { max: 60, windowS: 60 },
  write: { max: 30, windowS: 60 },
  booking: { max: 10, windowS: 60 },
  ai: { max: 12, windowS: 60 },
  signIn: { max: 8, windowS: 3600 },
} satisfies Record<string, Limit>;
