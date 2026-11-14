import { MIGRATIONS_DIR, open } from "./client";

/** CI runs this against Neon before every deploy; locally it migrates ./.pglite. */
async function main() {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
    await pool.end();
  } else {
    const { close } = await open({ seed: false });
    await close();
  }
  console.log("migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
