/**
 * Edge score: how good it is for A to teach B one specific skill.
 *   score = similarity × level fit × time overlap × trust × recent activity
 * Every factor is in (0, 1], so the score is too, and each factor is shown to members as the reason for a match.
 */
export type EdgeFactors = {
  similarity: number;
  levelFit: number;
  timeOverlap: number;
  trust: number;
  activity: number;
};

export function edgeScore(f: EdgeFactors): number {
  return f.similarity * f.levelFit * f.timeOverlap * f.trust * f.activity;
}

/** Teaching someone at or above your own level works poorly; a gap of one level or more is ideal. */
export function levelFit(teacherLevel: number, learnerLevel: number): number {
  const gap = teacherLevel - learnerLevel;
  if (gap >= 1) return 1;
  if (gap === 0) return 0.6;
  return 0.25;
}

/** Shared free minutes in the coming week; three possible sessions' worth counts as a perfect fit. */
export function timeOverlap(sharedMinutes: number, lengthMin: number): number {
  if (sharedMinutes < lengthMin) return 0;
  // One possible session → 0.6; three or more → 1.
  return Math.min(1, 0.4 + (0.6 * sharedMinutes) / (3 * lengthMin));
}

export function trustFactor(level: number): number {
  return 0.7 + 0.1 * Math.max(0, Math.min(3, level));
}

export function activityFactor(lastActiveAt: Date, now: Date): number {
  const days = (now.getTime() - lastActiveAt.getTime()) / 86_400_000;
  if (days <= 3) return 1;
  if (days <= 14) return 0.8;
  return 0.5;
}

/** Plain-language reasons, derived only from the real factors — never invented. */
export function explainFactors(
  f: EdgeFactors,
  ctx: { teacherLevel: number; learnerLevel: number; sharedMinutes: number },
) {
  const lines: string[] = [];
  const gap = ctx.teacherLevel - ctx.learnerLevel;
  lines.push(
    gap >= 1
      ? "Teaches above your level"
      : gap === 0
        ? "Teaches at your level, which is weaker for learning"
        : "Below your stated level",
  );
  const h = Math.floor(ctx.sharedMinutes / 60);
  lines.push(h >= 1 ? `${h} h of shared free time this week` : "Little shared free time this week");
  if (f.trust >= 0.9) lines.push("Trusted member");
  if (f.activity < 1) lines.push("Not active in the last few days");
  if (f.similarity < 0.8) lines.push("Closest skill to what you asked for, not an exact match");
  return lines;
}
