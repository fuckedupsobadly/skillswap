import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything that can run a query: the database or an open transaction. */
export type Q = DB | Tx;

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

type Opened = { db: DB; driver: "pg" | "pglite"; close: () => Promise<void> };

/**
 * One process-wide connection, shared across Next.js module instances through globalThis.
 *
 * Production: Postgres on Neon via DATABASE_URL (migrations run in CI before deploy).
 * Local: embedded PGlite — real Postgres compiled to WASM — in ./.pglite, migrated and seeded on first use,
 * so `npm run dev` works with no database to install.
 */
const g = globalThis as unknown as { __skillswap?: Promise<Opened> };

export async function getDb(): Promise<DB> {
  g.__skillswap ??= open().catch((e) => {
    g.__skillswap = undefined;
    throw e;
  });
  return (await g.__skillswap).db;
}

export async function open(opts: { dataDir?: string; seed?: boolean } = {}): Promise<Opened> {
  if (process.env.DATABASE_URL && !opts.dataDir) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    const db = drizzle(pool, { schema }) as unknown as DB;
    await ensureGame(db);
    return { db, driver: "pg", close: () => pool.end() };
  }
  const opened = await openPglite(opts.dataDir ?? process.env.PGLITE_DIR ?? ".pglite");
  if (opts.seed ?? true) {
    const { ensureSeeded } = await import("./seed-data");
    await ensureSeeded(opened.db);
    await ensureGame(opened.db);
  }
  return opened;
}

/** `dataDir: "memory://"` gives a throwaway in-memory database (tests). */
export async function openPglite(dataDir: string): Promise<Opened> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir, { extensions: { vector, pg_trgm } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db: db as unknown as DB, driver: "pglite", close: () => client.close() };
}

/** The gamification catalogue is data in code; upsert it, give sample members kitties, backfill XP. */
async function ensureGame(db: DB) {
  const game = await import("@/modules/game/service");
  await game.ensureGameCatalog(db);
  await game.ensureSampleKitties(db);
  const village = await import("@/modules/village/service");
  await village.ensureSampleVillagers(db);
}

/** Raw `execute` results differ slightly by driver; both expose `.rows`. */
export function rows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}
