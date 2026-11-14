import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DB, openPglite, rows } from "@/db/client";
import { bookings, kitties, memberProgress, swapCycles, xpEvents } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { relay } from "@/jobs/relay";
import { acceptBooking, confirmBooking, requestBooking, startBooking } from "@/modules/booking/service";
import { allSkills } from "@/modules/catalog/service";
import {
  adoptKitty,
  awardSettledBooking,
  candidates,
  ensureGameCatalog,
  ensureSampleKitties,
  feed,
  grant,
  pet,
  progressFor,
  revokeBooking,
  saveWardrobe,
} from "@/modules/game/service";
import { SIGN_ALG, SIGN_PARAMS } from "@/modules/identity/keys";
import { botSign, signInWithDevice } from "@/modules/identity/service";
import { createChallenge } from "@/modules/identity/session";
import { setSkills } from "@/modules/market/service";
import { acceptCycle, proposalsFor, proposeCyclesFor } from "@/modules/matching/service";
import { canonicalJson, toBase64, utf8 } from "@/modules/platform/canonical";

let db: DB;
let close: () => Promise<void>;

async function guest() {
  const pair = (await crypto.subtle.generateKey(SIGN_ALG, false, ["sign", "verify"])) as CryptoKeyPair;
  const publicKey = toBase64(await crypto.subtle.exportKey("spki", pair.publicKey));
  const sign = async (m: string) => toBase64(await crypto.subtle.sign(SIGN_PARAMS, pair.privateKey, utf8(m)));
  const challenge = await createChallenge();
  const me = await signInWithDevice(db, {
    publicKey,
    challenge,
    signature: await sign(challenge),
    timezone: "Asia/Almaty",
  });
  return { ...me, sign };
}

beforeAll(async () => {
  ({ db, close } = await openPglite("memory://"));
  await seed(db, { history: 30 });
  await ensureGameCatalog(db);
  await ensureSampleKitties(db);
});
afterAll(async () => close());

describe("gamification", () => {
  it("gives every sample member a unique kitty and backfills XP from their history", async () => {
    const ks = await db.select().from(kitties);
    expect(ks.length).toBe(36);
    expect(new Set(ks.map((k) => k.genomeCode)).size).toBe(ks.length);
    const [{ xp }] = rows<{ xp: number }>(
      await db.execute(sql`select coalesce(sum(xp_total),0)::int as xp from member_progress`),
    );
    expect(xp).toBeGreaterThan(0);
  });

  it("offers three distinct kittens, adopts one, and only once", async () => {
    const me = await guest();
    const list = await candidates(db, me.memberId);
    expect(list).toHaveLength(3);
    expect(new Set(list.map((c) => c.code)).size).toBe(3);
    expect(await candidates(db, me.memberId)).toEqual(list); // deterministic for this member
    const code = await adoptKitty(db, me.memberId, 1, "  Miso ");
    expect(code).toBe(list[1].code);
    const [k] = await db.select().from(kitties).where(eq(kitties.memberId, me.memberId));
    expect(k.name).toBe("Miso");
    await expect(adoptKitty(db, me.memberId, 0, "Again")).rejects.toThrow(/already/);
    await expect(adoptKitty(db, (await guest()).memberId, 0, "")).rejects.toThrow(/1 to 16/);
  });

  it("a settled session earns XP for both sides, a treat each, badges and items — exactly once", async () => {
    const me = await guest();
    await adoptKitty(db, me.memberId, 0, "Pip");
    const [offer] = rows<{ id: string; memberId: string }>(
      await db.execute(
        sql`select o.id, o.member_id as "memberId" from offers o join members m on m.id = o.member_id where m.is_sample and o.active limit 1`,
      ),
    );
    const startsAt = new Date(Math.ceil(Date.now() / 300_000) * 300_000);
    const id = await requestBooking(
      db,
      { ...me, signerKey: "t" },
      { offerId: offer.id, startsAt, lengthMin: 60 },
    );
    const teacherDevice = (
      await botSign(db, offer.memberId, { action: "confirm_session", bookingId: id, ts: Date.now() })
    ).deviceId;
    await acceptBooking(db, { memberId: offer.memberId, deviceId: teacherDevice, signerKey: "bot" }, id);
    await startBooking(db, { ...me, signerKey: "t" }, id);
    const payload = { action: "confirm_session" as const, bookingId: id, ts: Date.now() };
    await confirmBooking(db, me, {
      bookingId: id,
      payload,
      signature: await me.sign(canonicalJson(payload)),
      rating: 5,
      review: "Great",
    });
    await relay(db); // sample teacher confirms → settled → gamification handler runs

    expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0].status).toBe("settled");
    const p = await progressFor(db, me.memberId);
    // learn 16 + first counterpart 10 + wrote a review 3 + received the sample teacher's five stars 5 = 34
    expect(p.xp).toBe(34);
    expect(p.treats).toBe(1);
    expect(p.achievements.map((a) => a.id)).toContain("first-paw");
    expect(p.items).toContain("yarn");
    expect(p.items).toContain("leaf-hat"); // a session settled in autumn (today is November)

    const teacher = await progressFor(db, offer.memberId);
    expect(teacher.recent.some((e) => e.bookingId === id && e.source === "teach" && e.amount > 0)).toBe(true);

    // Idempotent: replaying the event changes nothing.
    await awardSettledBooking(db, id);
    expect((await progressFor(db, me.memberId)).xp).toBe(34);
  });

  it("applies the daily and per-counterpart caps", async () => {
    const me = await guest();
    const other = (await guest()).memberId;
    const at = new Date();
    const out = await db.transaction(async (tx) => {
      const a = await grant(tx, me.memberId, {
        key: "t1",
        source: "teach",
        amount: 50,
        occurredAt: at,
        counterpartId: other,
      });
      const b = await grant(tx, me.memberId, {
        key: "t2",
        source: "teach",
        amount: 50,
        occurredAt: at,
        counterpartId: other,
      });
      const c = await grant(tx, me.memberId, { key: "t3", source: "teach", amount: 280, occurredAt: at });
      const d = await grant(tx, me.memberId, { key: "t3", source: "teach", amount: 280, occurredAt: at });
      return [a?.amount, b?.amount, c?.amount, d];
    });
    expect(out).toEqual([50, 10, 240, null]); // 60/week from one person; 300/day total; keys are once-only
  });

  it("completing a swap cycle gives everyone the cycle bonus and the Full Circle badge", async () => {
    const me = await guest();
    await adoptKitty(db, me.memberId, 2, "Fig");
    const skillsList = await allSkills(db);
    const sid = (slug: string) => skillsList.find((s) => s.slug === slug)!.id;
    await db.transaction((tx) =>
      setSkills(
        tx,
        me.memberId,
        [
          { skillId: sid("english"), level: 5 },
          { skillId: sid("python"), level: 5 },
        ],
        [{ skillId: sid("guitar"), level: 1 }],
      ),
    );
    await proposeCyclesFor(db, me.memberId);
    await relay(db);
    const cycle = (await proposalsFor(db, me.memberId)).find((c) => c.status === "proposed")!;
    const payload = { action: "accept_cycle" as const, cycleId: cycle.id, ts: Date.now() };
    await acceptCycle(db, me, {
      cycleId: cycle.id,
      payload,
      signature: await me.sign(canonicalJson(payload)),
    });
    const mine = await db.select().from(bookings).where(eq(bookings.cycleId, cycle.id));
    for (const b of mine) {
      const parts = rows<{ memberId: string }>(
        await db.execute(
          sql`select member_id as "memberId" from booking_participants where booking_id = ${b.id}`,
        ),
      );
      if (!parts.some((p) => p.memberId === me.memberId)) continue;
      await startBooking(db, { ...me, signerKey: "t" }, b.id);
      const pl = { action: "confirm_session" as const, bookingId: b.id, ts: Date.now() };
      await confirmBooking(db, me, {
        bookingId: b.id,
        payload: pl,
        signature: await me.sign(canonicalJson(pl)),
      });
    }
    // Sessions between two sample members in the cycle: both are bots, confirm them through the same code.
    for (const b of mine) {
      const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
      if (row.status !== "accepted") continue;
      const parts = rows<{ memberId: string }>(
        await db.execute(
          sql`select member_id as "memberId" from booking_participants where booking_id = ${b.id}`,
        ),
      );
      const devs = await Promise.all(
        parts.map((p) =>
          botSign(db, p.memberId, { action: "confirm_session", bookingId: b.id, ts: Date.now() }),
        ),
      );
      await startBooking(
        db,
        { memberId: parts[0].memberId, deviceId: devs[0].deviceId, signerKey: "bot" },
        b.id,
      );
      for (const [i, p] of parts.entries()) {
        const pl = { action: "confirm_session" as const, bookingId: b.id, ts: Date.now() };
        const s = await botSign(db, p.memberId, pl);
        await confirmBooking(
          db,
          { memberId: p.memberId, deviceId: devs[i].deviceId },
          { bookingId: b.id, payload: pl, signature: s.signature },
        );
      }
    }
    await relay(db);
    const [c] = await db.select().from(swapCycles).where(eq(swapCycles.id, cycle.id));
    const p = await progressFor(db, me.memberId);
    expect(p.achievements.map((a) => a.id)).toEqual(
      expect.arrayContaining(["first-paw", "first-lesson-given", "full-circle"]),
    );
    expect(p.items).toEqual(expect.arrayContaining(["yarn", "bell", "chain-charm"]));
    const cycleXp = await db
      .select()
      .from(xpEvents)
      .where(sql`${xpEvents.sourceEventId} = ${`cycle:${c.id}`}`);
    expect(cycleXp.length).toBe(c.members.length);
  });

  it("reversing a session lowers XP but never the rank", async () => {
    const [pick] = rows<{ memberId: string; bookingId: string }>(
      await db.execute(sql`select x.member_id as "memberId", x.booking_id as "bookingId" from xp_events x
        where x.source = 'teach' and x.amount > 0 limit 1`),
    );
    await db.update(memberProgress).set({ rank: "tabby" }).where(eq(memberProgress.memberId, pick.memberId));
    const before = await progressFor(db, pick.memberId);
    await revokeBooking(db, pick.bookingId);
    const after = await progressFor(db, pick.memberId);
    expect(after.xp).toBeLessThan(before.xp);
    expect(after.rank).toBe("tabby");
    await revokeBooking(db, pick.bookingId); // idempotent
    expect((await progressFor(db, pick.memberId)).xp).toBe(after.xp);
  });

  it("the wardrobe only equips owned items in open slots; care actions work", async () => {
    const me = await guest();
    await adoptKitty(db, me.memberId, 0, "Nori");
    await expect(saveWardrobe(db, me.memberId, { head: "crown" })).rejects.toThrow(/isn't unlocked/);
    await expect(saveWardrobe(db, me.memberId, { head: "scarf" })).rejects.toThrow(/doesn't go/);
    await expect(feed(db, me.memberId, "treat")).rejects.toThrow(/No treats/);
    const n = await feed(db, me.memberId, "kibble");
    expect(n.hunger).toBeGreaterThan(0.8);
    const first = await pet(db, me.memberId);
    const second = await pet(db, me.memberId);
    expect(first.change).not.toBeNull();
    expect(second.change).toBeNull(); // one XP a day for petting
  });

  it("the XP log is append-only", async () => {
    const reject = (p: Promise<unknown>) =>
      p.then(
        () => "no error",
        (e: Error) => String(e.cause ?? e),
      );
    expect(await reject(db.execute(sql`update xp_events set amount = 999`))).toMatch(/append-only/);
    expect(await reject(db.execute(sql`delete from xp_events`))).toMatch(/append-only/);
  });
});
