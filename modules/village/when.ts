/** "Weekday evenings · Sat mornings" — availability rules in plain words (§8.1). */
export function describeAvailability(rules: { weekday: number; startMin: number; endMin: number }[]): string {
  if (!rules.length) return "Any time";
  if (rules.length === 7 && rules.every((r) => r.startMin === 0 && r.endMin === 1440)) return "Any time";
  const part = (s: number, e: number) =>
    s >= 17 * 60
      ? "evenings"
      : e <= 12 * 60
        ? "mornings"
        : s >= 12 * 60
          ? "afternoons"
          : e - s >= 8 * 60
            ? "all day"
            : "daytime";
  const groups = new Map<string, number[]>();
  for (const r of rules) {
    const k = part(r.startMin, r.endMin);
    groups.set(k, [...(groups.get(k) ?? []), r.weekday]);
  }
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const out: string[] = [];
  for (const [p, days] of groups) {
    const set = new Set(days);
    const weekdays = [1, 2, 3, 4, 5].every((d) => set.has(d)) && !set.has(0) && !set.has(6);
    const weekend = set.has(0) && set.has(6) && set.size === 2;
    const label =
      set.size === 7
        ? "Every day"
        : weekdays
          ? "Weekday"
          : weekend
            ? "Weekend"
            : [...set]
                .sort()
                .map((d) => DAY[d])
                .join(", ");
    out.push(`${label} ${p}`);
  }
  return out.join(" · ");
}
