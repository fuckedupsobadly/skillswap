import type { VercelConfig } from "@vercel/config/v1";

/**
 * Vercel project config. The cron runs the sweep (auto-settle, hold and proposal expiry) plus nightly
 * whole-graph matching and ledger reconciliation.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  // Migrate and seed Neon first (idempotent; skipped when DATABASE_URL is absent), then build.
  buildCommand: "npm run db:deploy && npm run build",
  // Daily, so it also works on the Hobby plan. Between runs, sweeps happen in the outbox relay (and every
  // 5 minutes in Inngest when connected).
  crons: [{ path: "/api/cron/sweep?nightly=1", schedule: "0 3 * * *" }],
};
