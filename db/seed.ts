import { open } from "./client";
import { ensureSeeded } from "./seed-data";

/** Seed an empty database (idempotent). Stop `npm run dev` first when using local PGlite. */
async function main() {
  const { db, close } = await open({ seed: false });
  const t = Date.now();
  const seeded = await ensureSeeded(db);
  console.log(
    seeded ? `seeded in ${Date.now() - t} ms` : "already seeded — use npm run db:reset to start over",
  );
  await close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
