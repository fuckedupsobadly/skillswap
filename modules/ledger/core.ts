import { canonicalJson, sha256Hex } from "@/modules/platform/canonical";

/**
 * Hour ledger — pure core. No I/O: the database adapter (service.ts) and the browser audit page both use these
 * functions, and property tests drive them with thousands of random operation sequences.
 *
 * Double-entry: an entry moves `amountMin` from `debit` to `credit`. The debit account goes down, the credit
 * account goes up, so the sum of all balances is always exactly zero. Starter grants come from a system issuing
 * account, which goes negative by exactly the hours granted.
 */

export const GENESIS_HASH = "0".repeat(64);
/** Members may go down to −2 h so they can learn before they teach. */
export const MEMBER_FLOOR_MIN = -120;
export const STARTER_GRANT_MIN = 120;

export type AccountKind = "member" | "pool" | "community" | "system";
export type EntryKind =
  | "grant"
  | "hold"
  | "release"
  | "capture"
  | "gift"
  | "pool_contribution"
  | "refund"
  | "no_show_penalty"
  | "correction";

export type Movement = {
  kind: EntryKind;
  debit: string;
  credit: string;
  amountMin: number;
  bookingId?: string | null;
  memo?: string;
  signerKey: string;
};

/** Exactly the fields that are hashed. Anyone can recompute `hash` from these. */
export type LedgerEntry = {
  seq: number;
  id: string;
  kind: EntryKind;
  debitAccount: string;
  creditAccount: string;
  amountMin: number;
  bookingId: string | null;
  memo: string;
  signerKey: string;
  createdAt: string; // ISO-8601, millisecond precision
  prevHash: string;
  hash: string;
};

export class LedgerError extends Error {
  constructor(
    public readonly code:
      | "invalid_amount"
      | "same_account"
      | "below_floor"
      | "negative_balance"
      | "hold_exceeded",
    message: string,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

/** Lowest balance each account kind may reach. System accounts (issuer) are unbounded; escrow is checked separately. */
export function floorFor(kind: AccountKind): number {
  if (kind === "member") return MEMBER_FLOOR_MIN;
  if (kind === "system") return Number.NEGATIVE_INFINITY;
  return 0; // pools and the community pool can never be overdrawn
}

/**
 * Apply one movement to a balance map. Returns the new balances of the two touched accounts.
 * Throws LedgerError if the movement is malformed or would push the debited account below its floor.
 */
export function applyMovement(
  balances: Readonly<Record<string, number>>,
  kinds: Readonly<Record<string, AccountKind>>,
  m: Movement,
  opts: { escrowAccount?: string; floorCredit?: Readonly<Record<string, number>> } = {},
): { debit: number; credit: number } {
  if (!Number.isInteger(m.amountMin) || m.amountMin <= 0) {
    throw new LedgerError(
      "invalid_amount",
      `amount must be a positive whole number of minutes (got ${m.amountMin})`,
    );
  }
  if (m.debit === m.credit) throw new LedgerError("same_account", "debit and credit accounts must differ");
  const debitKind = kinds[m.debit];
  if (!debitKind || !kinds[m.credit]) throw new LedgerError("invalid_amount", "unknown account");
  const debit = (balances[m.debit] ?? 0) - m.amountMin;
  const credit = (balances[m.credit] ?? 0) + m.amountMin;
  if (m.debit === opts.escrowAccount && debit < 0) {
    throw new LedgerError("negative_balance", "escrow cannot release more than it holds");
  }
  // The floor binds on every movement; penalties are capped by the caller so they never trip it.
  // Floor credit: inside a swap cycle a member also teaches, so their hold may dip below the floor by
  // exactly the minutes they are about to earn in the same cycle. That's what makes a cycle net-zero.
  const floor = floorFor(debitKind) - Math.max(0, opts.floorCredit?.[m.debit] ?? 0);
  if (debit < floor) {
    throw new LedgerError("below_floor", `balance would fall to ${debit} min, below the floor of ${floor}`);
  }
  return { debit, credit };
}

/** Split a hold into the part paid to the teacher and the part returned to the learner. */
export function splitHold(holdMin: number, captureMin: number): { capture: number; release: number } {
  if (!Number.isInteger(captureMin) || captureMin < 0)
    throw new LedgerError("invalid_amount", "capture must be ≥ 0");
  if (captureMin > holdMin) throw new LedgerError("hold_exceeded", "a capture can never exceed its hold");
  return { capture: captureMin, release: holdMin - captureMin };
}

export function hashInput(e: Omit<LedgerEntry, "hash" | "prevHash">): string {
  return canonicalJson({
    seq: e.seq,
    id: e.id,
    kind: e.kind,
    debit: e.debitAccount,
    credit: e.creditAccount,
    amount: e.amountMin,
    booking: e.bookingId,
    memo: e.memo,
    signer: e.signerKey,
    at: e.createdAt,
  });
}

/** hash = SHA-256(prev_hash + canonical JSON of the entry) */
export async function computeHash(
  prevHash: string,
  e: Omit<LedgerEntry, "hash" | "prevHash">,
): Promise<string> {
  return sha256Hex(prevHash + hashInput(e));
}

export async function buildEntry(
  prev: { seq: number; hash: string } | null,
  m: Movement,
  id: string,
  createdAt: Date,
): Promise<LedgerEntry> {
  const body = {
    seq: (prev?.seq ?? 0) + 1,
    id,
    kind: m.kind,
    debitAccount: m.debit,
    creditAccount: m.credit,
    amountMin: m.amountMin,
    bookingId: m.bookingId ?? null,
    memo: m.memo ?? "",
    signerKey: m.signerKey,
    createdAt: createdAt.toISOString(),
  };
  const prevHash = prev?.hash ?? GENESIS_HASH;
  return { ...body, prevHash, hash: await computeHash(prevHash, body) };
}

export type ChainResult =
  | { ok: true; count: number; head: string }
  | { ok: false; count: number; brokenAt: number; reason: string };

/**
 * Verify a contiguous run of entries. Pass `from` to continue verification page by page (the audit page does this).
 */
export async function verifyChain(
  entries: readonly LedgerEntry[],
  from: { seq: number; hash: string } = { seq: 0, hash: GENESIS_HASH },
): Promise<ChainResult> {
  let prev = from;
  let count = 0;
  for (const e of entries) {
    if (e.seq !== prev.seq + 1)
      return { ok: false, count, brokenAt: e.seq, reason: `gap: expected #${prev.seq + 1}` };
    if (e.prevHash !== prev.hash)
      return { ok: false, count, brokenAt: e.seq, reason: "prev_hash does not link" };
    const { hash: _h, prevHash: _p, ...body } = e;
    const expected = await computeHash(prev.hash, body);
    if (expected !== e.hash)
      return { ok: false, count, brokenAt: e.seq, reason: "contents do not match hash" };
    prev = { seq: e.seq, hash: e.hash };
    count++;
  }
  return { ok: true, count, head: prev.hash };
}

/** Replaying every entry from zero must reproduce the cached balances exactly. */
export function replay(
  entries: readonly Pick<LedgerEntry, "debitAccount" | "creditAccount" | "amountMin">[],
) {
  const balances: Record<string, number> = {};
  for (const e of entries) {
    balances[e.debitAccount] = (balances[e.debitAccount] ?? 0) - e.amountMin;
    balances[e.creditAccount] = (balances[e.creditAccount] ?? 0) + e.amountMin;
  }
  return balances;
}

export const sumBalances = (b: Readonly<Record<string, number>>) =>
  Object.values(b).reduce((a, v) => a + v, 0);
