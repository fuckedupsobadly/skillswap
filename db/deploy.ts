import { MIGRATIONS_DIR } from "./client";

/**
 * Runs on every Vercel build, before `next build`: bring the production database (Neon, via DATABASE_URL) up to
 * date, seed it once, then upsert the game catalogue and backfill sample kitties and villagers. Every step is
 * idempotent — migrations are tracked in drizzle's journal table, seeding only happens when the catalogue is
 * empty, the backfill only touches what is missing — so re-deploys and preview builds are safe.
 *
 * Migrations use the direct (unpooled) connection when Neon provides one: DDL and the migrator's transaction
 * belong on a real session, not behind the pooler. With no DATABASE_URL (a fork, a local build) it does
 * nothing and the app falls back to embedded PGlite.
 */
async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.log("db:deploy — no DATABASE_URL, skipping (the app will use embedded PGlite)");
    return;
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const t0 = Date.now();
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
    console.log(`db:deploy — migrations applied in ${Date.now() - t0} ms`);
    const schema = await import("./schema");
    const db = drizzle(pool, { schema }) as unknown as import("./client").DB;
    const { ensureSeeded } = await import("./seed-data");
    const t1 = Date.now();
    const seeded = await ensureSeeded(db);
    console.log(seeded ? `db:deploy — seeded in ${Date.now() - t1} ms` : "db:deploy — already seeded");
    const { ensureGame } = await import("./client");
    const t2 = Date.now();
    await ensureGame(db);
    console.log(`db:deploy — game catalogue, sample kitties and villagers ready in ${Date.now() - t2} ms`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("db:deploy failed:", e);
  process.exit(1);
});
