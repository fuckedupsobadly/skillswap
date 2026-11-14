import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { type DB, openPglite, rows } from "@/db/client";
import { bookings, outbox } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { relay } from "@/jobs/relay";
import { requestBooking } from "@/modules/booking/service";
import { ensureGameCatalog } from "@/modules/game/service";
import { SIGN_ALG, SIGN_PARAMS } from "@/modules/identity/keys";
import { signInWithDevice } from "@/modules/identity/service";
import { createChallenge } from "@/modules/identity/session";
import { toBase64, utf8 } from "@/modules/platform/canonical";

let db: DB;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await openPglite("memory://"));
  await seed(db, { history: 0 });
  await ensureGameCatalog(db);
});
afterAll(async () => close());

it("a sample teacher accepts a direct booking once the outbox is relayed", async () => {
  const pair = (await crypto.subtle.generateKey(SIGN_ALG, false, ["sign", "verify"])) as CryptoKeyPair;
  const publicKey = toBase64(await crypto.subtle.exportKey("spki", pair.publicKey));
  const challenge = await createChallenge();
  const signature = toBase64(await crypto.subtle.sign(SIGN_PARAMS, pair.privateKey, utf8(challenge)));
  const me = await signInWithDevice(db, { publicKey, challenge, signature, timezone: "Asia/Almaty" });

  const [offer] = rows<{ id: string }>(
    await db.execute(
      sql`select o.id from offers o join members m on m.id = o.member_id where m.is_sample and o.active limit 1`,
    ),
  );
  // "Now" slot, exactly as the booking page offers it.
  const startsAt = new Date(Math.ceil(Date.now() / 300_000) * 300_000);
  const id = await requestBooking(
    db,
    { ...me, signerKey: "t" },
    { offerId: offer.id, startsAt, lengthMin: 60 },
  );
  expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0].status).toBe("requested");

  await relay(db);

  const pending = await db.select().from(outbox).where(sql`delivered_at is null`);
  expect(pending.map((p) => [p.topic, p.lastError])).toEqual([]);
  expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0].status).toBe("accepted");
});
