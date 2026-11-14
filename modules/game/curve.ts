/** Level curve: XP_total(n) = round(40 · (n − 1)^1.7), 1 ≤ n ≤ 50. Level 2 = 40, level 10 = 1,676, level 50 = 29,881. */
export const MAX_LEVEL = 50;

export const xpForLevel = (n: number) => Math.round(40 * Math.max(0, Math.min(MAX_LEVEL, n) - 1) ** 1.7);

export function levelForXp(xp: number): number {
  let n = 1;
  while (n < MAX_LEVEL && xpForLevel(n + 1) <= xp) n++;
  return n;
}

/** Where the member sits inside their current level, for the thin progress bar. */
export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  const next = level >= MAX_LEVEL ? start : xpForLevel(level + 1);
  return { level, start, next, fraction: next === start ? 1 : (xp - start) / (next - start) };
}
