import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Q, Tx } from "@/db/client";
import { rows } from "@/db/client";
import { accounts, holds, ledgerEntries } from "@/db/schema";
import { DomainError } from "@/modules/platform/errors";
import {
  type AccountKind,
  applyMovement,
  buildEntry,
  floorFor,
  type LedgerEntry,
  LedgerError,
  type Movement,
  replay,
  STARTER_GRANT_MIN,
  splitHold,
  sumBalances,
  verifyChain,
} from "./core";

/** Transaction-level advisory lock key: every ledger write is serialised behind it. */
const LEDGER_LOCK = 0x5ca1ab1e;

/** Well-known owners of the platform's own accounts. */
export const SYSTEM_OWNERS = {
  issuer: "00000000-0000-0000-0000-000000000001",
  escrow: "00000000-0000-0000-0000-000000000002",
  community: "00000000-0000-0000-0000-000000000003",
} as const;

export async function accountId(q: Q, ownerType: AccountKind, ownerId: string, label = ""): Promise<string> {
  const [found] = await q
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.ownerType, ownerType), eq(accounts.ownerId, ownerId)));
  if (found) return found.id;
  const [created] = await q
    .insert(accounts)
    .values({ ownerType, ownerId, label })
    .onConflictDoNothing()
    .returning({ id: accounts.id });
  if (created) return created.id;
  return accountId(q, ownerType, ownerId, label);
}

export const memberAccount = (q: Q, memberId: string) => accountId(q, "member", memberId);
export const issuerAccount = (q: Q) => accountId(q, "system", SYSTEM_OWNERS.issuer, "Issuer");
export const escrowAccount = (q: Q) => accountId(q, "system", SYSTEM_OWNERS.escrow, "Escrow");
export const communityAccount = (q: Q) =>
  accountId(q, "community", SYSTEM_OWNERS.community, "Community pool");

/**
 * The single write path for hours. Must be called inside a transaction:
 *   lock → read the head → hash each entry onto the chain → insert → update cached balances → check floors.
 * Any violation throws and the whole transaction (including the caller's booking change) rolls back.
 */
export async function post(
  tx: Tx,
  movements: Movement[],
  opts: { floorCredit?: Record<string, number> } = {},
): Promise<LedgerEntry[]> {
  if (movements.length === 0) return [];
  await tx.execute(sql`select pg_advisory_xact_lock(${LEDGER_LOCK})`);
  const [head] = await tx
    .select({ seq: ledgerEntries.seq, hash: ledgerEntries.hash })
    .from(ledgerEntries)
    .orderBy(desc(ledgerEntries.seq))
    .limit(1);

  const ids = [...new Set(movements.flatMap((m) => [m.debit, m.credit]))];
  const accts = await tx.select().from(accounts).where(inArray(accounts.id, ids)).for("update");
  const balances: Record<string, number> = {};
  const kinds: Record<string, AccountKind> = {};
  for (const a of accts) {
    balances[a.id] = a.cachedBalanceMin;
    kinds[a.id] = a.ownerType;
  }
  const escrow = await escrowAccount(tx);

  let prev = head ?? null;
  const now = new Date();
  const built: LedgerEntry[] = [];
  for (const m of movements) {
    try {
      const next = applyMovement(balances, kinds, m, {
        escrowAccount: escrow,
        floorCredit: opts.floorCredit,
      });
      balances[m.debit] = next.debit;
      balances[m.credit] = next.credit;
    } catch (e) {
      if (e instanceof LedgerError && e.code === "below_floor") {
        throw new DomainError(
          "insufficient_hours",
          "Not enough hours: this would take the balance below −2 h.",
        );
      }
      throw e;
    }
    const entry = await buildEntry(prev, m, crypto.randomUUID(), now);
    built.push(entry);
    prev = { seq: entry.seq, hash: entry.hash };
  }

  await tx.insert(ledgerEntries).values(
    built.map((e) => ({
      seq: e.seq,
      id: e.id,
      kind: e.kind,
      debitAccount: e.debitAccount,
      creditAccount: e.creditAccount,
      amountMin: e.amountMin,
      bookingId: e.bookingId,
      memo: e.memo,
      signerKey: e.signerKey,
      prevHash: e.prevHash,
      hash: e.hash,
      createdAt: new Date(e.createdAt),
    })),
  );
  for (const id of ids) {
    await tx.update(accounts).set({ cachedBalanceMin: balances[id] }).where(eq(accounts.id, id));
  }
  return built;
}

/** Headroom above the floor — used to cap penalties so they can never trip the floor. */
export async function headroom(q: Q, memberId: string): Promise<number> {
  const id = await memberAccount(q, memberId);
  const [a] = await q.select({ b: accounts.cachedBalanceMin }).from(accounts).where(eq(accounts.id, id));
  return (a?.b ?? 0) - floorFor("member");
}

export async function grantStarterHours(tx: Tx, memberId: string, memo = "Starter grant") {
  const [issuer, member] = await Promise.all([issuerAccount(tx), memberAccount(tx, memberId)]);
  return post(tx, [
    { kind: "grant", debit: issuer, credit: member, amountMin: STARTER_GRANT_MIN, memo, signerKey: "system" },
  ]);
}

// ── Holds: hours reserved in escrow, not yet paid to anyone ──────────────────

export async function placeHold(
  tx: Tx,
  h: {
    memberId: string;
    bookingId: string;
    amountMin: number;
    expiresAt: Date;
    signerKey: string;
    memo: string;
    /** Minutes this member will earn by teaching in the same swap cycle (see applyMovement). */
    floorCreditMin?: number;
  },
) {
  const [member, escrow] = await Promise.all([memberAccount(tx, h.memberId), escrowAccount(tx)]);
  await post(
    tx,
    [
      {
        kind: "hold",
        debit: member,
        credit: escrow,
        amountMin: h.amountMin,
        bookingId: h.bookingId,
        memo: h.memo,
        signerKey: h.signerKey,
      },
    ],
    { floorCredit: h.floorCreditMin ? { [member]: h.floorCreditMin } : undefined },
  );
  await tx
    .insert(holds)
    .values({ accountId: member, bookingId: h.bookingId, amountMin: h.amountMin, expiresAt: h.expiresAt });
}

async function openHold(tx: Tx, bookingId: string, memberId: string) {
  const member = await memberAccount(tx, memberId);
  const [hold] = await tx
    .select()
    .from(holds)
    .where(and(eq(holds.bookingId, bookingId), eq(holds.accountId, member)))
    .for("update");
  if (hold?.status !== "held") return null;
  return { hold, member };
}

/** Capture part (or all) of a learner's hold for the teacher; the rest goes back to the learner. */
export async function settleHold(
  tx: Tx,
  s: {
    bookingId: string;
    learnerId: string;
    teacherId: string;
    captureMin: number;
    signerKey: string;
    memo: string;
  },
) {
  const open = await openHold(tx, s.bookingId, s.learnerId);
  if (!open) return { captured: 0, released: 0 };
  const { capture, release } = splitHold(open.hold.amountMin, s.captureMin);
  const [escrow, teacher] = await Promise.all([escrowAccount(tx), memberAccount(tx, s.teacherId)]);
  const moves: Movement[] = [];
  if (capture > 0) {
    moves.push({
      kind: "capture",
      debit: escrow,
      credit: teacher,
      amountMin: capture,
      bookingId: s.bookingId,
      memo: s.memo,
      signerKey: s.signerKey,
    });
  }
  if (release > 0) {
    moves.push({
      kind: "release",
      debit: escrow,
      credit: open.member,
      amountMin: release,
      bookingId: s.bookingId,
      memo: s.memo,
      signerKey: s.signerKey,
    });
  }
  await post(tx, moves);
  await tx
    .update(holds)
    .set({ status: capture > 0 ? "captured" : "released" })
    .where(eq(holds.id, open.hold.id));
  return { captured: capture, released: release };
}

export const releaseHold = (
  tx: Tx,
  s: { bookingId: string; learnerId: string; teacherId: string; signerKey: string; memo: string },
) => settleHold(tx, { ...s, captureMin: 0 });

/** Penalty from one participant to the other, capped so it never pushes the payer below the floor. */
export async function penalty(
  tx: Tx,
  p: {
    fromMember: string;
    toMember: string;
    amountMin: number;
    bookingId: string;
    signerKey: string;
    memo: string;
  },
) {
  const amount = Math.min(p.amountMin, await headroom(tx, p.fromMember));
  if (amount <= 0) return 0;
  const [from, to] = await Promise.all([memberAccount(tx, p.fromMember), memberAccount(tx, p.toMember)]);
  await post(tx, [
    {
      kind: "no_show_penalty",
      debit: from,
      credit: to,
      amountMin: amount,
      bookingId: p.bookingId,
      memo: p.memo,
      signerKey: p.signerKey,
    },
  ]);
  return amount;
}

export async function gift(
  tx: Tx,
  g: {
    fromMember: string;
    to: { member: string } | "community";
    amountMin: number;
    signerKey: string;
    memo: string;
  },
) {
  const from = await memberAccount(tx, g.fromMember);
  const to = g.to === "community" ? await communityAccount(tx) : await memberAccount(tx, g.to.member);
  return post(tx, [
    { kind: "gift", debit: from, credit: to, amountMin: g.amountMin, memo: g.memo, signerKey: g.signerKey },
  ]);
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function walletSummary(q: Q, memberId: string) {
  const id = await memberAccount(q, memberId);
  const [acct] = await q.select().from(accounts).where(eq(accounts.id, id));
  const held = rows<{ total: number | null }>(
    await q.execute(
      sql`select coalesce(sum(amount_min),0)::int as total from holds where account_id = ${id} and status = 'held'`,
    ),
  )[0]?.total;
  return { accountId: id, balanceMin: acct?.cachedBalanceMin ?? 0, heldMin: Number(held ?? 0) };
}

export async function accountHistory(q: Q, accountIdValue: string, limit = 100) {
  return q
    .select()
    .from(ledgerEntries)
    .where(
      sql`${ledgerEntries.debitAccount} = ${accountIdValue} or ${ledgerEntries.creditAccount} = ${accountIdValue}`,
    )
    .orderBy(desc(ledgerEntries.seq))
    .limit(limit);
}

export type PublicEntry = LedgerEntry;

export function toPublic(e: typeof ledgerEntries.$inferSelect): PublicEntry {
  return {
    seq: e.seq,
    id: e.id,
    kind: e.kind,
    debitAccount: e.debitAccount,
    creditAccount: e.creditAccount,
    amountMin: e.amountMin,
    bookingId: e.bookingId,
    memo: e.memo,
    signerKey: e.signerKey,
    createdAt: e.createdAt.toISOString(),
    prevHash: e.prevHash,
    hash: e.hash,
  };
}

export async function ledgerPage(q: Q, after: number, limit: number) {
  const list = await q
    .select()
    .from(ledgerEntries)
    .where(gt(ledgerEntries.seq, after))
    .orderBy(asc(ledgerEntries.seq))
    .limit(limit);
  return list.map(toPublic);
}

export async function ledgerHead(q: Q) {
  const [h] = await q
    .select({ seq: ledgerEntries.seq, hash: ledgerEntries.hash, createdAt: ledgerEntries.createdAt })
    .from(ledgerEntries)
    .orderBy(desc(ledgerEntries.seq))
    .limit(1);
  return h
    ? { seq: h.seq, hash: h.hash, at: h.createdAt.toISOString() }
    : { seq: 0, hash: "0".repeat(64), at: null };
}

/**
 * Reconciliation (nightly job): replay every entry, compare with cached balances, verify the chain, and check
 * that balances sum to zero and that escrow equals the open holds.
 */
export async function reconcile(q: Q) {
  const all = (await q.select().from(ledgerEntries).orderBy(asc(ledgerEntries.seq))).map(toPublic);
  const chain = await verifyChain(all);
  const replayed = replay(all);
  const cached = await q
    .select({ id: accounts.id, b: accounts.cachedBalanceMin, kind: accounts.ownerType })
    .from(accounts);
  const mismatches = cached
    .filter((a) => (replayed[a.id] ?? 0) !== a.b)
    .map((a) => ({ account: a.id, cached: a.b, replayed: replayed[a.id] ?? 0 }));
  const escrow = await escrowAccount(q);
  const openHolds = rows<{ total: number }>(
    await q.execute(sql`select coalesce(sum(amount_min),0)::int as total from holds where status = 'held'`),
  )[0];
  // A member inside a swap cycle may sit below the floor by what they're about to earn as its teacher.
  const credit = new Map(
    rows<{ account: string; min: number }>(
      await q.execute(sql`select a.id as account, coalesce(sum(h.amount_min), 0)::int as min
        from holds h join bookings b on b.id = h.booking_id and b.cycle_id is not null
        join accounts a on a.owner_type = 'member' and a.owner_id = b.teacher_id
        where h.status = 'held' group by a.id`),
    ).map((r) => [r.account, r.min]),
  );
  const belowFloor = cached.filter((a) => a.b < floorFor(a.kind) - (credit.get(a.id) ?? 0)).map((a) => a.id);
  return {
    entries: all.length,
    chainOk: chain.ok,
    sumZero: sumBalances(replayed) === 0,
    mismatches,
    escrowMatchesHolds: (replayed[escrow] ?? 0) === Number(openHolds?.total ?? 0),
    belowFloor,
    head: chain.ok ? chain.head : null,
  };
}
