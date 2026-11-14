import type { DB } from "@/db/client";
import { sweepBookings } from "@/modules/booking/service";
import { reconcile } from "@/modules/ledger/service";
import { expireProposals, nightlyMatching } from "@/modules/matching/service";

/** Frequent sweep: auto-settle after 48 h of silence, expire stale requests and proposals. */
export async function sweep(db: DB, now = new Date()) {
  const bookings = await sweepBookings(db, { now });
  const proposals = await expireProposals(db, now);
  return { ...bookings, expiredProposals: proposals };
}

/** Nightly: matching across the whole graph, then ledger reconciliation. Alerts on any mismatch. */
export async function nightly(db: DB, now = new Date()) {
  const matching = await nightlyMatching(db, now);
  const ledger = await reconcile(db);
  const healthy =
    ledger.chainOk &&
    ledger.sumZero &&
    ledger.mismatches.length === 0 &&
    ledger.escrowMatchesHolds &&
    ledger.belowFloor.length === 0;
  if (!healthy) console.error("[ledger] RECONCILIATION ALERT", JSON.stringify(ledger));
  return { matching, ledger: { ...ledger, healthy } };
}
