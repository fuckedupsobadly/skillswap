import { DomainError } from "./errors";

export type Limit = { max: number; windowS: number };

/**
 * Rate limits per action and member. Upstash Redis when configured (shared across instances); otherwise an
 * in-memory sliding window per instance, which is fine for local development and a single-region demo.
 */
const memory = new Map<string, number[]>();

async function upstash(key: string, limit: Limit) {
  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");
  const g = globalThis as unknown as { __rl?: Map<string, InstanceType<typeof Ratelimit>> };
  g.__rl ??= new Map();
  const id = `${limit.max}/${limit.windowS}`;
  let rl = g.__rl.get(id);
  if (!rl) {
    rl = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit.max, `${limit.windowS} s`),
      prefix: "ss",
    });
    g.__rl.set(id, rl);
  }
  return (await rl.limit(key)).success;
}

export async function rateLimit(key: string, limit: Limit) {
  let ok: boolean;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    ok = await upstash(key, limit);
  } else {
    const now = Date.now();
    const hits = (memory.get(key) ?? []).filter((t) => now - t < limit.windowS * 1000);
    ok = hits.length < limit.max;
    if (ok) hits.push(now);
    memory.set(key, hits);
  }
  if (!ok) throw new DomainError("rate_limited", "Too many attempts. Wait a moment and try again.");
}
