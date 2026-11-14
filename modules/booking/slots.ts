import { TZDate } from "@date-fns/tz";

/** Weekly availability rule in the member's own timezone. weekday 0 = Sunday; minutes from local midnight. */
export type AvailabilityRule = { weekday: number; startMin: number; endMin: number; timezone: string };
/** Half-open UTC interval in epoch milliseconds. */
export type Interval = { start: number; end: number };

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** A member who hasn't set availability is treated as free any time, so nobody is unmatchable by default. */
export const anytime = (timezone: string): AvailabilityRule[] =>
  Array.from({ length: 7 }, (_, weekday) => ({ weekday, startMin: 0, endMin: 1440, timezone }));

export function expand(rules: readonly AvailabilityRule[], from: Date, to: Date): Interval[] {
  const out: Interval[] = [];
  for (const rule of rules) {
    // Walk local calendar days in the rule's timezone, one day of margin on both sides for offsets.
    for (let t = from.getTime() - DAY; t < to.getTime() + DAY; t += DAY) {
      const local = new TZDate(t, rule.timezone);
      if (local.getDay() !== rule.weekday) continue;
      const y = local.getFullYear();
      const m = local.getMonth();
      const d = local.getDate();
      const start = new TZDate(y, m, d, 0, rule.startMin, rule.timezone).getTime();
      const end = new TZDate(y, m, d, 0, rule.endMin, rule.timezone).getTime();
      const s = Math.max(start, from.getTime());
      const e = Math.min(end, to.getTime());
      if (e > s) out.push({ start: s, end: e });
    }
  }
  return merge(out);
}

export function merge(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

export function intersect(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const s = Math.max(a[i].start, b[j].start);
    const e = Math.min(a[i].end, b[j].end);
    if (e > s) out.push({ start: s, end: e });
    if (a[i].end < b[j].end) i++;
    else j++;
  }
  return out;
}

export const totalMinutes = (ivs: readonly Interval[]) =>
  ivs.reduce((acc, iv) => acc + (iv.end - iv.start) / MIN, 0);

/**
 * Bookable start times: the first is "now" rounded up to 5 minutes, then every :00 and :30.
 * A slot is valid only if the whole session fits inside one shared free interval.
 */
export function slotStarts(ivs: readonly Interval[], lengthMin: number, notBefore: Date, limit = 48): Date[] {
  const out: Date[] = [];
  const first = Math.ceil(notBefore.getTime() / (5 * MIN)) * 5 * MIN;
  for (const iv of ivs) {
    let t = Math.max(iv.start, first);
    if (t !== first) t = Math.ceil(t / (5 * MIN)) * 5 * MIN;
    while (t + lengthMin * MIN <= iv.end && out.length < limit) {
      out.push(new Date(t));
      const next = Math.ceil((t + 1) / (30 * MIN)) * 30 * MIN;
      t = next;
    }
    if (out.length >= limit) break;
  }
  return out;
}

export function sharedFreeTime(
  a: readonly AvailabilityRule[],
  b: readonly AvailabilityRule[],
  from: Date,
  days = 7,
): Interval[] {
  const to = new Date(from.getTime() + days * DAY);
  return intersect(expand(a, from, to), expand(b, from, to));
}

/** "Tue 14:30" in the given timezone. */
export function formatSlot(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(d);
}

export function formatDateTime(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(d);
}
