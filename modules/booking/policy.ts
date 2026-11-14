import type { Effect, Role } from "./machine";

/** "Reschedule and cancel rules: free until 12 hours before; later cancels cost the canceller." */
export const FREE_CANCEL_HOURS = 12;

export type ExitInput = {
  exit: "cancel" | "no_show";
  /** For a cancel: who cancelled. For a no-show: who was absent. Either way, the party who pays. */
  by: Role;
  minutesToStart: number;
};

/**
 * What an accepted booking costs when it ends without a session.
 *
 * Penalties are paid to the other participant, never to the platform, so a fine can't become a way to mint
 * or burn hours: it is always a transfer between the two people involved. The ledger caps a teacher penalty at
 * what keeps them above the −2 h floor.
 *
 *   learner cancels early   → full refund
 *   learner cancels late    → half the hold goes to the teacher, who kept the slot free
 *   learner doesn't show    → the whole hold goes to the teacher
 *   teacher cancels early   → full refund
 *   teacher cancels late    → full refund, and the teacher pays the learner a quarter of the length
 *   teacher doesn't show    → full refund, and the teacher pays the learner half the length
 */
export function exitPolicy({ exit, by, minutesToStart }: ExitInput): Effect[] {
  const late = exit === "no_show" || minutesToStart < FREE_CANCEL_HOURS * 60;
  if (!late) return [{ type: "release" }];

  if (by === "learner") {
    return exit === "no_show" ? [{ type: "capture", fraction: 1 }] : [{ type: "capture", fraction: 0.5 }];
  }
  return [
    { type: "release" },
    { type: "penalty", payer: "teacher", fraction: exit === "no_show" ? 0.5 : 0.25 },
  ];
}
