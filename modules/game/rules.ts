import { RANKS, type RankId, rankIndex } from "./ranks";

/** Unlock rules are data. The same engine evaluates items and achievements on every XP event. */
export type Rule =
  | { type: "level"; level: number }
  | { type: "rank"; rank: RankId }
  | { type: "achievement"; id: string }
  | { type: "category_hours"; category: string; minutes: number }
  | { type: "settled_sessions"; role?: "teacher" | "learner"; count: number }
  | { type: "cycles_completed"; count: number }
  | { type: "reviews_written"; count: number }
  | { type: "five_stars_received"; count: number }
  | { type: "categories_taught"; count: number }
  | { type: "learned_skills_in_category"; category: string; count: number }
  | { type: "gifted_to_community"; minutes: number }
  | { type: "clean_streak"; count: number }
  | { type: "group_classes_taught"; count: number }
  | { type: "dispute_panels"; count: number }
  | { type: "early_sessions"; count: number }
  | { type: "late_sessions"; count: number }
  | { type: "mentees_teaching"; count: number }
  | { type: "slow_blinks"; count: number }
  | { type: "skill_pages"; count: number }
  | { type: "season"; season: SeasonId }
  | { type: "any"; rules: Rule[] };

export type SeasonId = "winter" | "spring" | "summer" | "autumn";

/** Everything a rule can look at, computed from real, settled activity. */
export type Stats = {
  level: number;
  rank: RankId;
  trustLevel: number;
  settledAsTeacher: number;
  settledAsLearner: number;
  minutesTaught: number;
  minutesTaughtByCategory: Record<string, number>;
  categoriesTaught: number;
  cyclesCompleted: number;
  reviewsWritten: number;
  fiveStarsReceived: number;
  learnedSkillsByCategory: Record<string, number>;
  giftedToCommunityMin: number;
  cleanStreak: number;
  groupClassesTaught: number;
  disputePanels: number;
  earlySessions: number;
  lateSessions: number;
  menteesTeaching: number;
  slowBlinks: number;
  skillPagesVisited: number;
  seasonsActive: SeasonId[];
  achievements: Set<string>;
};

export function meets(rule: Rule, s: Stats): boolean {
  switch (rule.type) {
    case "level":
      return s.level >= rule.level;
    case "rank":
      return rankIndex(s.rank) >= rankIndex(rule.rank);
    case "achievement":
      return s.achievements.has(rule.id);
    case "category_hours":
      return (s.minutesTaughtByCategory[rule.category] ?? 0) >= rule.minutes;
    case "settled_sessions": {
      const n =
        rule.role === "teacher"
          ? s.settledAsTeacher
          : rule.role === "learner"
            ? s.settledAsLearner
            : s.settledAsTeacher + s.settledAsLearner;
      return n >= rule.count;
    }
    case "cycles_completed":
      return s.cyclesCompleted >= rule.count;
    case "reviews_written":
      return s.reviewsWritten >= rule.count;
    case "five_stars_received":
      return s.fiveStarsReceived >= rule.count;
    case "categories_taught":
      return s.categoriesTaught >= rule.count;
    case "learned_skills_in_category":
      return (s.learnedSkillsByCategory[rule.category] ?? 0) >= rule.count;
    case "gifted_to_community":
      return s.giftedToCommunityMin >= rule.minutes;
    case "clean_streak":
      return s.cleanStreak >= rule.count;
    case "group_classes_taught":
      return s.groupClassesTaught >= rule.count;
    case "dispute_panels":
      return s.disputePanels >= rule.count;
    case "early_sessions":
      return s.earlySessions >= rule.count;
    case "late_sessions":
      return s.lateSessions >= rule.count;
    case "mentees_teaching":
      return s.menteesTeaching >= rule.count;
    case "slow_blinks":
      return s.slowBlinks >= rule.count;
    case "skill_pages":
      return s.skillPagesVisited >= rule.count;
    case "season":
      return s.seasonsActive.includes(rule.season);
    case "any":
      return rule.rules.some((r) => meets(r, s));
  }
}

const CATEGORY_NAMES: Record<string, string> = {
  "design-creative": "Design",
  "cooking-food": "Cooking",
  music: "Music",
  academic: "Academic tutoring",
  "garden-outdoors": "Garden",
  "fitness-sports": "Fitness",
  "tech-coding": "Tech and coding",
  "home-diy": "Home and DIY",
  languages: "Languages",
};
const hours = (m: number) => (m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One plain line, shown under a locked item or badge. */
export function describeRule(rule: Rule, names: { achievement?: (id: string) => string } = {}): string {
  switch (rule.type) {
    case "level":
      return `Reach level ${rule.level}`;
    case "rank":
      return `Reach the ${RANKS[rankIndex(rule.rank)].name} rank`;
    case "achievement":
      return `Earn the ${names.achievement?.(rule.id) ?? rule.id} badge`;
    case "category_hours":
      return `Teach ${hours(rule.minutes)} of ${CATEGORY_NAMES[rule.category] ?? rule.category}`;
    case "settled_sessions":
      return rule.role === "teacher"
        ? `Teach ${plural(rule.count, "session")}`
        : rule.role === "learner"
          ? `Learn in ${plural(rule.count, "session")}`
          : `Finish ${plural(rule.count, "session")}`;
    case "cycles_completed":
      return `Complete ${plural(rule.count, "swap cycle")}`;
    case "reviews_written":
      return `Write ${plural(rule.count, "review")}`;
    case "five_stars_received":
      return `Receive ${plural(rule.count, "five-star review")}`;
    case "categories_taught":
      return `Teach in ${plural(rule.count, "category", "categories")}`;
    case "learned_skills_in_category":
      return `Learn ${plural(rule.count, "skill")} in ${CATEGORY_NAMES[rule.category] ?? rule.category}`;
    case "gifted_to_community":
      return `Gift ${hours(rule.minutes)} to the community pool`;
    case "clean_streak":
      return `${rule.count} sessions in a row with no late cancel or no-show`;
    case "group_classes_taught":
      return `Teach ${plural(rule.count, "group class", "group classes")}`;
    case "dispute_panels":
      return `Serve on ${plural(rule.count, "dispute panel")}`;
    case "early_sessions":
      return `Attend ${plural(rule.count, "session")} before 8 am`;
    case "late_sessions":
      return `Attend ${plural(rule.count, "session")} after 9 pm`;
    case "mentees_teaching":
      return "Someone you taught goes on to teach the same skill";
    case "slow_blinks":
      return `Get ${rule.count} slow blinks from your kitty`;
    case "skill_pages":
      return `Visit ${rule.count} different skill pages`;
    case "season":
      return `Finish a session in ${rule.season}`;
    case "any":
      return rule.rules.map((r) => describeRule(r, names)).join(", or ");
  }
}

/** Seasons return every year, so nobody misses a set forever. Northern-hemisphere months. */
export const SEASONS: { id: SeasonId; name: string; months: number[] }[] = [
  { id: "winter", name: "Winter", months: [12, 1, 2] },
  { id: "spring", name: "Spring", months: [3, 4, 5] },
  { id: "summer", name: "Summer", months: [6, 7, 8] },
  { id: "autumn", name: "Autumn", months: [9, 10, 11] },
];
export const seasonOf = (d: Date): SeasonId =>
  SEASONS.find((s) => s.months.includes(d.getUTCMonth() + 1))!.id;
