import { rm } from "node:fs/promises";
import { open } from "./client";
import { seed } from "./seed-data";

/**
 * Reset and reseed. Local PGlite: deletes ./.pglite. Postgres: requires --yes and drops the public schema.
 * Stop `npm run dev` first when using PGlite (one process owns the data directory).
 */
async function main() {
  if (process.env.DATABASE_URL) {
    if (!process.argv.includes("--yes"))
      throw new Error("Refusing to reset a Postgres database without --yes");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      "drop schema public cascade; create schema public; drop schema if exists drizzle cascade;",
    );
    await pool.end();
    const { execSync } = await import("node:child_process");
    execSync("npx tsx db/migrate.ts", { stdio: "inherit" });
  } else {
    await rm(process.env.PGLITE_DIR ?? ".pglite", { recursive: true, force: true });
  }
  const { db, close } = await open({ seed: false });
  const t = Date.now();
  const r = await seed(db, { log: true });
  console.log(`reset: ${r.members} sample members, ${r.sessions} sessions in ${Date.now() - t} ms`);
  await close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
