/** XP sources and limits from the spec. Starting values, to tune with real data. */
export const XP = {
  teachPer30: 10,
  learnPer30: 8,
  groupMultiplier: 1.5,
  asyncReview: 10,
  cycleComplete: 15,
  newCounterpart: 10,
  newCategoryTaught: 25,
  writeReview: 3,
  receiveFiveStar: 5,
  disputePanel: 15,
  giftPer30: 2,
  giftWeekCap: 20,
  profileComplete: 20,
  pet: 1,
  petWeekCap: 7,
  dailyCap: 300,
  pairWeekCap: 60,
} as const;

export type XpSource =
  | "teach"
  | "learn"
  | "async_review"
  | "cycle"
  | "new_counterpart"
  | "new_category"
  | "write_review"
  | "five_star"
  | "dispute_panel"
  | "gift"
  | "profile"
  | "pet"
  | "reversal";

export const SOURCE_LABEL: Record<XpSource, string> = {
  teach: "Taught a session",
  learn: "Learned in a session",
  async_review: "Delivered a review",
  cycle: "Completed a swap cycle",
  new_counterpart: "First session with someone new",
  new_category: "First time teaching this category",
  write_review: "Wrote a review",
  five_star: "Received a five-star review",
  dispute_panel: "Served on a dispute panel",
  gift: "Gifted hours to the community pool",
  profile: "Completed your profile",
  pet: "Petted your kitty",
  reversal: "Reversed after a dispute",
};

/** Session XP for one side: 10 (teacher) or 8 (learner) per started half hour. */
export const sessionXp = (role: "teacher" | "learner", lengthMin: number, group = false) =>
  Math.round(
    (role === "teacher" ? XP.teachPer30 : XP.learnPer30) *
      Math.ceil(lengthMin / 30) *
      (group && role === "teacher" ? XP.groupMultiplier : 1),
  );
