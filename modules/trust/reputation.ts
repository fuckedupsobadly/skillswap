/**
 * Trust and reputation (pure).
 *
 * | Level        | Reached by                                              | Unlocks                                  |
 * | 0 — New      | joining                                                 | online sessions, up to 2 open bookings   |
 * | 1 — Active   | 3 confirmed sessions + a recovery method                | group, async, more open bookings         |
 * | 2 — Trusted  | 10 confirmed sessions, rating ≥ 4.5, no upheld reports  | in person, helping hands                 |
 * | 3 — Steward  | 30 sessions and a clean record                          | dispute panels                           |
 */
export type TrustInput = {
  settledSessions: number;
  rating: number | null;
  hasRecovery: boolean;
  upheldReports: number;
};

export function trustLevel(t: TrustInput): 0 | 1 | 2 | 3 {
  const clean = t.upheldReports === 0;
  const rated = t.rating ?? 0;
  if (t.settledSessions >= 30 && clean && t.hasRecovery && rated >= 4.5) return 3;
  if (t.settledSessions >= 10 && rated >= 4.5 && clean && t.hasRecovery) return 2;
  if (t.settledSessions >= 3 && t.hasRecovery) return 1;
  return 0;
}

export const OPEN_BOOKING_LIMIT = [2, 5, 8, 12] as const;
export const openBookingLimit = (level: number) => OPEN_BOOKING_LIMIT[Math.max(0, Math.min(3, level))];

export const TRUST_NAMES = ["New", "Active", "Trusted", "Steward"] as const;

/**
 * Bayesian average weighted by distinct counterparts: first average each counterpart's ratings, then blend the
 * per-counterpart means with a prior. Ten 5-star reviews from one friend count as one voice, not ten.
 */
export const RATING_PRIOR = 4.0;
export const RATING_PRIOR_WEIGHT = 3;

export function bayesianRating(reviews: readonly { authorId: string; rating: number }[]): number | null {
  if (reviews.length === 0) return null;
  const byAuthor = new Map<string, { sum: number; n: number }>();
  for (const r of reviews) {
    const cur = byAuthor.get(r.authorId) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    byAuthor.set(r.authorId, cur);
  }
  let total = 0;
  for (const { sum, n } of byAuthor.values()) total += sum / n;
  const k = byAuthor.size;
  return (RATING_PRIOR * RATING_PRIOR_WEIGHT + total) / (RATING_PRIOR_WEIGHT + k);
}

/** Collusion check: at most this many minutes earned from the same counterpart in any 7-day window. */
export const WEEKLY_PAIR_CAP_MIN = 300;
