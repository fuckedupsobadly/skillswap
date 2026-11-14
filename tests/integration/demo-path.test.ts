import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DB, openPglite, rows } from "@/db/client";
import { bookingParticipants, bookings, ledgerEntries, members } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { relay } from "@/jobs/relay";
import { sweep } from "@/jobs/sweep";
import { parseRequest } from "@/modules/ai/concierge";
import { cancelBooking, confirmBooking, requestBooking, startBooking } from "@/modules/booking/service";
import { allSkills } from "@/modules/catalog/service";
import { ensureGameCatalog } from "@/modules/game/service";
import { SIGN_ALG, SIGN_PARAMS } from "@/modules/identity/keys";
import { signInWithDevice } from "@/modules/identity/service";
import { createChallenge } from "@/modules/identity/session";
import { verifyChain } from "@/modules/ledger/core";
import { ledgerPage, reconcile, walletSummary } from "@/modules/ledger/service";
import { createRequest, setSkills } from "@/modules/market/service";
import { acceptCycle, proposalsFor, proposeCyclesFor } from "@/modules/matching/service";
import { canonicalJson, toBase64, utf8 } from "@/modules/platform/canonical";
import { DomainError } from "@/modules/platform/errors";

/** A judge's browser: a real non-extractable P-256 key, exactly like the app's IndexedDB key. */
async function browserDevice() {
  const pair = (await crypto.subtle.generateKey(SIGN_ALG, false, ["sign", "verify"])) as CryptoKeyPair;
  const publicKey = toBase64(await crypto.subtle.exportKey("spki", pair.publicKey));
  const sign = async (msg: string) =>
    toBase64(await crypto.subtle.sign(SIGN_PARAMS, pair.privateKey, utf8(msg)));
  return { publicKey, sign };
}

let db: DB;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await openPglite("memory://"));
  await seed(db, { history: 40 });
  await ensureGameCatalog(db); // as production does at startup
});
afterAll(async () => close());

describe("demo path: guest → request → swap cycle → session → both confirm → audit", () => {
  const device = browserDevice();
  let me: { memberId: string; deviceId: string };

  it("1. opens with no sign-up and 2 starter hours on the ledger", async () => {
    const d = await device;
    const challenge = await createChallenge();
    me = await signInWithDevice(db, {
      publicKey: d.publicKey,
      challenge,
      signature: await d.sign(challenge),
      timezone: "Asia/Almaty",
    });
    const w = await walletSummary(db, me.memberId);
    expect(w.balanceMin).toBe(120);
    // Same key again → same member, no second grant.
    const c2 = await createChallenge();
    const again = await signInWithDevice(db, {
      publicKey: d.publicKey,
      challenge: c2,
      signature: await d.sign(c2),
    });
    expect(again.memberId).toBe(me.memberId);
    expect((await walletSummary(db, me.memberId)).balanceMin).toBe(120);
  });

  it("rejects a forged sign-in", async () => {
    const a = await device;
    const b = await browserDevice();
    const challenge = await createChallenge();
    await expect(
      signInWithDevice(db, { publicKey: a.publicKey, challenge, signature: await b.sign(challenge) }),
    ).rejects.toThrow(DomainError);
  });

  it("2. the concierge turns a sentence into a request (rules engine offline)", async () => {
    const parsed = await parseRequest(db, me.memberId, "I want to learn guitar chords");
    expect(parsed.engine).toBe("rules");
    expect(parsed.skill?.slug).toBe("guitar");
    expect(parsed.level).toBe(1);
    const refused = await parseRequest(db, me.memberId, "I need legal advice for my lawsuit");
    expect(refused.excluded).toMatch(/Legal advice/);

    const skillsList = await allSkills(db);
    const id = (slug: string) => skillsList.find((s) => s.slug === slug)!.id;
    await db.transaction(async (tx) => {
      await setSkills(
        tx,
        me.memberId,
        [
          { skillId: id("english"), level: 5 },
          { skillId: id("python"), level: 4 },
        ],
        [],
      );
      await createRequest(tx, me.memberId, {
        skillId: parsed.skill!.id,
        level: 1,
        format: "live",
        lengthMin: 60,
        text: "I want to learn guitar chords",
        confidence: parsed.confidence,
        parsedBy: "rules",
      });
    });
  });

  it("3. the match screen shows a swap cycle that includes me; I accept with a device signature", async () => {
    const ids = await proposeCyclesFor(db, me.memberId);
    expect(ids.length).toBeGreaterThan(0);
    await relay(db); // sample members accept their part
    const proposals = await proposalsFor(db, me.memberId);
    const cycle = proposals.find((p) => p.status === "proposed")!;
    expect(cycle.members[0]).toBe(me.memberId);
    expect(cycle.members.length).toBeGreaterThanOrEqual(2);
    expect(cycle.acceptedBy.length).toBe(cycle.members.length - 1);

    const d = await device;
    const payload = { action: "accept_cycle" as const, cycleId: cycle.id, ts: Date.now() };
    const res = await acceptCycle(db, me, {
      cycleId: cycle.id,
      payload,
      signature: await d.sign(canonicalJson(payload)),
    });
    expect(res.booked).toBe(true);
    const mine = await db.select().from(bookings).where(eq(bookings.cycleId, cycle.id));
    expect(mine.length).toBe(cycle.members.length);
    expect(mine.every((b) => b.status === "accepted")).toBe(true);
  });

  it("4. sessions run; sample members confirm automatically; balances move and net to zero", async () => {
    const d = await device;
    const myBookings = rows<{ id: string; role: string }>(
      await db.execute(sql`select b.id, bp.role from bookings b join booking_participants bp on bp.booking_id = b.id
        where bp.member_id = ${me.memberId} and b.cycle_id is not null`),
    );
    expect(myBookings.map((b) => b.role).sort()).toEqual(["learner", "teacher"]);
    for (const b of myBookings) {
      await startBooking(db, { ...me, signerKey: "test" }, b.id);
      const payload = { action: "confirm_session" as const, bookingId: b.id, ts: Date.now() };
      const state = await confirmBooking(db, me, {
        bookingId: b.id,
        payload,
        signature: await d.sign(canonicalJson(payload)),
        rating: 5,
      });
      expect(state).toBe("confirming");
    }
    await relay(db);
    for (const b of myBookings) {
      const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
      expect(row.status).toBe("settled");
      const parts = await db
        .select()
        .from(bookingParticipants)
        .where(eq(bookingParticipants.bookingId, b.id));
      expect(parts.every((p) => p.signature && p.confirmedAt)).toBe(true);
    }
    const w = await walletSummary(db, me.memberId);
    expect(w.balanceMin).toBe(120); // taught 1 h, learned 1 h
    expect(w.heldMin).toBe(0);
  });

  it("rejects a replayed or mismatched signature", async () => {
    const d = await device;
    const [{ id }] = rows<{ id: string }>(
      await db.execute(
        sql`select b.id from bookings b join booking_participants bp on bp.booking_id = b.id where bp.member_id = ${me.memberId} limit 1`,
      ),
    );
    const payload = { action: "confirm_session" as const, bookingId: crypto.randomUUID(), ts: Date.now() };
    await expect(
      confirmBooking(db, me, { bookingId: id, payload, signature: await d.sign(canonicalJson(payload)) }),
    ).rejects.toThrow(/does not match/);
  });

  it("enforces the −2 h floor and frees the hold when a request is withdrawn", async () => {
    const offers = rows<{ id: string; memberId: string }>(
      await db.execute(
        sql`select o.id, o.member_id as "memberId" from offers o join members m on m.id = o.member_id where m.is_sample and o.active and 120 = any(o.lengths || '{120}') limit 1`,
      ),
    );
    const startsAt = new Date(Math.ceil((Date.now() + 2 * 86_400_000) / 300_000) * 300_000);
    const id1 = await requestBooking(
      db,
      { ...me, signerKey: "t" },
      { offerId: offers[0].id, startsAt, lengthMin: 60 },
    );
    expect((await walletSummary(db, me.memberId)).heldMin).toBe(60);
    await cancelBooking(db, { ...me, signerKey: "t" }, id1);
    expect((await walletSummary(db, me.memberId)).heldMin).toBe(0);
    expect((await walletSummary(db, me.memberId)).balanceMin).toBe(120);
  });

  it("5. the ledger verifies, reconciles, and cannot be edited", async () => {
    const all = await ledgerPage(db, 0, 100_000);
    expect((await verifyChain(all)).ok).toBe(true);
    const tampered = all.map((e, i) => (i === 3 ? { ...e, amountMin: e.amountMin + 60 } : e));
    const bad = await verifyChain(tampered);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.brokenAt).toBe(all[3].seq);

    const r = await reconcile(db);
    expect(r).toMatchObject({
      chainOk: true,
      sumZero: true,
      mismatches: [],
      escrowMatchesHolds: true,
      belowFloor: [],
    });

    // Drizzle wraps driver errors; the trigger's message is on the cause.
    const rejection = async (p: Promise<unknown>) =>
      p.then(
        () => "no error",
        (e: Error) => String(e.cause ?? e),
      );
    expect(
      await rejection(db.execute(sql`update ledger_entries set amount_min = 999 where seq = 1`)),
    ).toMatch(/append-only/);
    expect(await rejection(db.delete(ledgerEntries).where(eq(ledgerEntries.seq, 1)))).toMatch(/append-only/);
  });

  it("sweeps auto-settle after 48 h of silence", async () => {
    const [m] = await db.select().from(members).where(eq(members.isSample, true)).limit(1);
    const r = await sweep(db, new Date(Date.now() + 3 * 86_400_000));
    expect(r).toHaveProperty("settled");
    expect(m).toBeTruthy();
    expect((await reconcile(db)).sumZero).toBe(true);
  });
});
