import { desc, eq, inArray, or } from "drizzle-orm";
import type { Q } from "@/db/client";
import { accounts, bookingParticipants, bookings, ledgerEntries, members, skills } from "@/db/schema";
import { memberAccount } from "@/modules/ledger/service";

/**
 * The teller's history (§8.6): one list, newest first, each row written as a sentence —
 * "+1 h · taught Excel to Leo · Tue". Raw ledger kinds stay on the entry page; this is the human reading.
 */
export type BankRow = {
  id: string;
  seq: number;
  amountMin: number; // signed, from the viewer's side
  line: string;
  day: string;
  pending: boolean;
};

const first = (name: string) => name.split(/\s+/)[0] ?? name;

export async function bankHistory(q: Q, memberId: string, timezone: string, limit = 100): Promise<BankRow[]> {
  const me = await memberAccount(q, memberId);
  const entries = await q
    .select()
    .from(ledgerEntries)
    .where(or(eq(ledgerEntries.debitAccount, me), eq(ledgerEntries.creditAccount, me)))
    .orderBy(desc(ledgerEntries.seq))
    .limit(limit);

  const bookingIds = [...new Set(entries.map((e) => e.bookingId).filter((x): x is string => !!x))];
  const info = new Map<
    string,
    { skill: string; teacherId: string; teacher: string; learners: string[]; status: string }
  >();
  if (bookingIds.length) {
    const bs = await q
      .select({
        id: bookings.id,
        status: bookings.status,
        teacherId: bookings.teacherId,
        teacher: members.displayName,
        skill: skills.name,
      })
      .from(bookings)
      .innerJoin(members, eq(members.id, bookings.teacherId))
      .innerJoin(skills, eq(skills.id, bookings.skillId))
      .where(inArray(bookings.id, bookingIds));
    const ls = await q
      .select({
        bookingId: bookingParticipants.bookingId,
        name: members.displayName,
        role: bookingParticipants.role,
      })
      .from(bookingParticipants)
      .innerJoin(members, eq(members.id, bookingParticipants.memberId))
      .where(inArray(bookingParticipants.bookingId, bookingIds));
    for (const b of bs)
      info.set(b.id, {
        skill: b.skill,
        teacherId: b.teacherId,
        teacher: b.teacher,
        status: b.status,
        learners: ls.filter((l) => l.bookingId === b.id && l.role === "learner").map((l) => first(l.name)),
      });
  }

  // Gifts name the other side, which is an account; resolve member accounts to first names.
  const other = [
    ...new Set(
      entries
        .filter((e) => e.kind === "gift")
        .map((e) => (e.debitAccount === me ? e.creditAccount : e.debitAccount)),
    ),
  ];
  const names = new Map<string, string>();
  if (other.length) {
    const rows = await q
      .select({
        id: accounts.id,
        label: accounts.label,
        ownerType: accounts.ownerType,
        name: members.displayName,
      })
      .from(accounts)
      .leftJoin(members, eq(members.id, accounts.ownerId))
      .where(inArray(accounts.id, other));
    for (const r of rows)
      names.set(r.id, r.ownerType === "member" && r.name ? first(r.name) : "the community pool");
  }

  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: timezone }).format(d);
  const fmtDay = (d: Date) => {
    const age = Date.now() - d.getTime();
    if (age < 6 * 24 * 3600_000) return day(d);
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: timezone }).format(d);
  };

  return entries.map((e) => {
    const incoming = e.creditAccount === me;
    const amountMin = incoming ? e.amountMin : -e.amountMin;
    const b = e.bookingId ? info.get(e.bookingId) : undefined;
    const iTeach = b?.teacherId === memberId;
    const who = b ? (iTeach ? b.learners.join(", ") || "a learner" : first(b.teacher)) : "";
    let line = e.memo;
    let pending = false;
    switch (e.kind) {
      case "grant":
        line = "starter hours from the village";
        break;
      case "hold":
        pending = !!b && ["requested", "accepted", "live", "confirming", "disputed"].includes(b.status);
        line = b
          ? b.status === "settled"
            ? `learned ${b.skill} from ${who}`
            : `held for ${b.skill} with ${who}`
          : "held";
        break;
      case "release":
        line = b ? `returned · ${b.skill} with ${who}` : "returned";
        break;
      case "capture":
        line = b ? `taught ${b.skill} to ${who}` : "taught a session";
        break;
      case "gift":
        line = incoming
          ? `gift from ${names.get(e.debitAccount) ?? "a member"}`
          : `gift to ${names.get(e.creditAccount) ?? "a member"}`;
        break;
      case "pool_contribution":
        line = incoming ? "from the community pool" : "to the community pool";
        break;
      case "refund":
        line = b ? `refund · ${b.skill}` : "refund";
        break;
      case "no_show_penalty":
        line = b ? `${incoming ? "no-show from" : "no-show for"} ${b.skill}` : "no-show";
        break;
      case "correction":
        line = `correction · ${e.memo}`;
        break;
    }
    return { id: e.id, seq: e.seq, amountMin, line, day: fmtDay(e.createdAt), pending };
  });
}
