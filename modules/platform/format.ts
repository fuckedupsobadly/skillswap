/** Microcopy rule: hours are always written the same way — "1 h", "30 min", "1 h 30 min". */
export function formatMinutes(min: number, opts: { sign?: boolean } = {}): string {
  const sign = min < 0 ? "−" : opts.sign && min > 0 ? "+" : "";
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const body = h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
  return `${sign}${body}`;
}

export const LEVELS = ["", "Beginner", "Elementary", "Intermediate", "Advanced", "Expert"] as const;
export const levelName = (level: number) => LEVELS[level] ?? "Any level";

export const FORMAT_LABEL = {
  live: "Live 1:1",
  group: "Group class",
  in_person: "In person",
  async: "Async review",
} as const;

/**
 * Hours as an amount (balance, held, cost): "3 h", "0.5 h", "1.5 h" — the village's currency is written in
 * hours even when a session's length is written in minutes ("Book 30 min · 0.5 h", §6.3, §8.4).
 */
export function formatHours(min: number, opts: { sign?: boolean } = {}): string {
  const sign = min < 0 ? "−" : opts.sign && min > 0 ? "+" : "";
  const h = Math.round((Math.abs(min) / 60) * 100) / 100;
  return `${sign}${h.toString()} h`;
}
