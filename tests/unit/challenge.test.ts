import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regression: in a production build with no APP_SECRET, the first sign-in step threw inside a server action,
 * which React redacts to "Minified React error #441". The action must return a readable failure instead,
 * and must still refuse to issue a challenge (never fall back to the dev secret in production).
 */
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: vi.fn() }));

describe("getChallenge without APP_SECRET in production", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns a readable error instead of throwing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", "");
    const { getChallenge } = await import("@/app/actions/identity");
    const res = await getChallenge();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/APP_SECRET/);
  });

  it("issues a challenge once a secret is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", "x".repeat(40));
    const { getChallenge } = await import("@/app/actions/identity");
    const res = await getChallenge();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toMatch(/^v1\.[0-9a-f]{32}\.\d+\.[0-9a-f]{64}$/);
  });
});
