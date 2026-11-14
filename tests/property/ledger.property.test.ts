import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type AccountKind,
  applyMovement,
  buildEntry,
  type LedgerEntry,
  LedgerError,
  MEMBER_FLOOR_MIN,
  type Movement,
  replay,
  STARTER_GRANT_MIN,
  splitHold,
  sumBalances,
  verifyChain,
} from "@/modules/ledger/core";

/**
 * Random operation sequences against the pure ledger core, modelling exactly what the services do:
 * grants from the issuer, holds into escrow, captures/releases out of escrow, gifts, and penalties.
 */
const MEMBERS = ["m1", "m2", "m3", "m4"];
const ISSUER = "issuer";
const ESCROW = "escrow";
const COMMUNITY = "community";
const kinds: Record<string, AccountKind> = {
  ...Object.fromEntries(MEMBERS.map((m) => [m, "member" as const])),
  [ISSUER]: "system",
  [ESCROW]: "system",
  [COMMUNITY]: "community",
};

type Op =
  | { t: "grant"; to: number }
  | { t: "hold"; learner: number; teacher: number; amount: number }
  | { t: "settle"; idx: number; fraction: number }
  | { t: "gift"; from: number; to: number; amount: number }
  | { t: "donate"; from: number; amount: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ t: fc.constant("grant" as const), to: fc.nat(3) }),
  fc.record({
    t: fc.constant("hold" as const),
    learner: fc.nat(3),
    teacher: fc.nat(3),
    amount: fc.constantFrom(30, 60, 90),
  }),
  fc.record({ t: fc.constant("settle" as const), idx: fc.nat(20), fraction: fc.constantFrom(0, 0.5, 1) }),
  fc.record({
    t: fc.constant("gift" as const),
    from: fc.nat(3),
    to: fc.nat(3),
    amount: fc.integer({ min: 1, max: 200 }),
  }),
  fc.record({ t: fc.constant("donate" as const), from: fc.nat(3), amount: fc.integer({ min: 1, max: 200 }) }),
);

async function run(ops: Op[]) {
  const balances: Record<string, number> = {};
  const entries: LedgerEntry[] = [];
  const holds: { learner: string; teacher: string; amount: number; open: boolean; captured: number }[] = [];
  let n = 0;
  const post = async (m: Movement) => {
    try {
      const next = applyMovement(balances, kinds, m, { escrowAccount: ESCROW });
      balances[m.debit] = next.debit;
      balances[m.credit] = next.credit;
      const prev = entries.at(-1) ?? null;
      entries.push(await buildEntry(prev, m, `e${++n}`, new Date(1_700_000_000_000 + n)));
      return true;
    } catch (e) {
      if (e instanceof LedgerError) return false;
      throw e;
    }
  };
  for (const op of ops) {
    if (op.t === "grant") {
      await post({
        kind: "grant",
        debit: ISSUER,
        credit: MEMBERS[op.to],
        amountMin: STARTER_GRANT_MIN,
        signerKey: "system",
      });
    } else if (op.t === "hold") {
      if (op.learner === op.teacher) continue;
      const ok = await post({
        kind: "hold",
        debit: MEMBERS[op.learner],
        credit: ESCROW,
        amountMin: op.amount,
        signerKey: "k",
      });
      if (ok)
        holds.push({
          learner: MEMBERS[op.learner],
          teacher: MEMBERS[op.teacher],
          amount: op.amount,
          open: true,
          captured: 0,
        });
    } else if (op.t === "settle") {
      const h = holds[op.idx % Math.max(1, holds.length)];
      if (!h?.open) continue;
      const { capture, release } = splitHold(h.amount, Math.round(h.amount * op.fraction));
      if (capture)
        await post({ kind: "capture", debit: ESCROW, credit: h.teacher, amountMin: capture, signerKey: "k" });
      if (release)
        await post({ kind: "release", debit: ESCROW, credit: h.learner, amountMin: release, signerKey: "k" });
      h.open = false;
      h.captured = capture;
    } else if (op.t === "gift") {
      if (op.from === op.to) continue;
      await post({
        kind: "gift",
        debit: MEMBERS[op.from],
        credit: MEMBERS[op.to],
        amountMin: op.amount,
        signerKey: "k",
      });
    } else {
      await post({
        kind: "gift",
        debit: MEMBERS[op.from],
        credit: COMMUNITY,
        amountMin: op.amount,
        signerKey: "k",
      });
    }
  }
  return { balances, entries, holds };
}

describe("ledger invariants", () => {
  it("all balances sum to zero, replay reproduces balances, the chain verifies, floors hold", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { maxLength: 60 }), async (ops) => {
        const { balances, entries, holds } = await run(ops);
        expect(sumBalances(balances)).toBe(0);
        const replayed = replay(entries);
        for (const [acct, bal] of Object.entries(balances)) expect(replayed[acct] ?? 0).toBe(bal);
        const chain = await verifyChain(entries);
        expect(chain.ok).toBe(true);
        for (const m of MEMBERS) expect(balances[m] ?? 0).toBeGreaterThanOrEqual(MEMBER_FLOOR_MIN);
        expect(balances[COMMUNITY] ?? 0).toBeGreaterThanOrEqual(0);
        // Escrow holds exactly the open holds.
        const open = holds.filter((h) => h.open).reduce((a, h) => a + h.amount, 0);
        expect(balances[ESCROW] ?? 0).toBe(open);
        for (const h of holds) expect(h.captured).toBeLessThanOrEqual(h.amount);
        // The issuer is negative by exactly the hours granted.
        const granted = entries.filter((e) => e.kind === "grant").reduce((a, e) => a + e.amountMin, 0);
        expect(balances[ISSUER] ?? 0).toBe(0 - granted);
      }),
      { numRuns: 1500 },
    );
  });

  it("any single-field tamper breaks the chain at that entry", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(opArb, { minLength: 5, maxLength: 30 }),
        fc.nat(),
        fc.constantFrom("amountMin", "creditAccount", "memo", "createdAt") as fc.Arbitrary<keyof LedgerEntry>,
        async (ops, pick, field) => {
          const { entries } = await run([{ t: "grant", to: 0 }, ...ops]);
          const i = pick % entries.length;
          const copy = entries.map((e) => ({ ...e }));
          const target = copy[i] as Record<string, unknown>;
          target[field] = field === "amountMin" ? (target[field] as number) + 1 : `${String(target[field])}x`;
          const res = await verifyChain(copy);
          expect(res.ok).toBe(false);
          if (!res.ok) expect(res.brokenAt).toBe(entries[i].seq);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("a capture can never exceed its hold", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 600 }), fc.integer({ min: 0, max: 1200 }), (hold, capture) => {
        if (capture > hold) expect(() => splitHold(hold, capture)).toThrow(LedgerError);
        else expect(splitHold(hold, capture)).toEqual({ capture, release: hold - capture });
      }),
    );
  });
});

describe("floor credit (swap cycles)", () => {
  it("lets a hold dip below the floor by exactly the credit, and no further", () => {
    const k: Record<string, AccountKind> = { m: "member", e: "system" };
    const at = { m: MEMBER_FLOOR_MIN, e: 0 };
    const hold = (amountMin: number, credit: number) =>
      applyMovement(
        at,
        k,
        { kind: "hold", debit: "m", credit: "e", amountMin, signerKey: "k" },
        { floorCredit: { m: credit } },
      );
    expect(() => hold(60, 0)).toThrow(LedgerError);
    expect(hold(60, 60).debit).toBe(MEMBER_FLOOR_MIN - 60);
    expect(() => hold(61, 60)).toThrow(LedgerError);
  });
});
