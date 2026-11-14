import { eq, sql } from "drizzle-orm";
import type { Q, Tx } from "@/db/client";
import { rows } from "@/db/client";
import { blocks, bookingParticipants, members, reports, reviews } from "@/db/schema";
import { DomainError } from "@/modules/platform/errors";
import { bayesianRating, trustLevel } from "./reputation";

/** Recompute a member's trust level from real counts. Called whenever one of their sessions settles. */
export async function recomputeTrust(tx: Tx, memberId: string) {
  const [m] = await tx.select().from(members).where(eq(members.id, memberId));
  if (!m) return;
  const stats = rows<{ settled: number; upheld: number }>(
    await tx.execute(sql`
      select
        (select count(*)::int from booking_participants bp join bookings b on b.id = bp.booking_id
          where bp.member_id = ${memberId} and b.status = 'settled') as settled,
        (select count(*)::int from reports where subject_id = ${memberId} and status = 'upheld') as upheld
    `),
  )[0];
  const revs = await tx
    .select({ authorId: reviews.authorId, rating: reviews.rating })
    .from(reviews)
    .where(eq(reviews.subjectId, memberId));
  const level = trustLevel({
    settledSessions: stats.settled,
    rating: bayesianRating(revs),
    // Sample members are server-managed; real members need a verified recovery method.
    hasRecovery: m.isSample || m.emailVerifiedAt !== null,
    upheldReports: stats.upheld,
  });
  if (level !== m.trustLevel)
    await tx.update(members).set({ trustLevel: level }).where(eq(members.id, memberId));
  return level;
}

export async function leaveReview(
  tx: Tx,
  r: { bookingId: string; authorId: string; subjectId: string; rating: number; text: string },
) {
  if (r.rating < 1 || r.rating > 5) throw new DomainError("invalid", "Rating must be 1–5.");
  const parts = await tx
    .select({ memberId: bookingParticipants.memberId })
    .from(bookingParticipants)
    .where(eq(bookingParticipants.bookingId, r.bookingId));
  const ids = parts.map((p) => p.memberId);
  if (!ids.includes(r.authorId) || !ids.includes(r.subjectId))
    throw new DomainError("forbidden", "Not your session.");
  await tx.insert(reviews).values(r).onConflictDoNothing();
}

export async function report(
  tx: Tx,
  r: { reporterId: string; subjectId: string; bookingId?: string; reason: string },
) {
  if (r.reporterId === r.subjectId) throw new DomainError("invalid", "You can't report yourself.");
  await tx.insert(reports).values({ ...r, bookingId: r.bookingId ?? null });
}

export async function block(tx: Tx, blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new DomainError("invalid", "You can't block yourself.");
  await tx.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing();
}

export async function isBlocked(q: Q, a: string, b: string) {
  const [hit] = await q
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(
      sql`(${blocks.blockerId} = ${a} and ${blocks.blockedId} = ${b}) or (${blocks.blockerId} = ${b} and ${blocks.blockedId} = ${a})`,
    )
    .limit(1);
  return Boolean(hit);
}
