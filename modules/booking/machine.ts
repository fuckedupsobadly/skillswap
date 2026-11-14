/**
 * Session escrow — one state machine for every booking (pure).
 *
 *   requested ──accept──▶ accepted ──start──▶ live ──confirm──▶ confirming ──confirm / 48 h──▶ settled
 *       │                    │                 │                    │
 *    decline/expire       cancel/expire     no-show              dispute
 *       ▼                    ▼                 ▼                    ▼
 *   declined/expired      cancelled         no_show             disputed
 *
 * The top row is the only path that pays the teacher; every exit releases the hold, applies a penalty,
 * or goes to a steward vote. Effects are instructions for the ledger; this module never touches it.
 */
import { exitPolicy } from "./policy";

export type BookingStatus =
  | "requested"
  | "accepted"
  | "live"
  | "confirming"
  | "settled"
  | "declined"
  | "expired"
  | "cancelled"
  | "no_show"
  | "disputed";

export type Role = "teacher" | "learner";

export type BookingEvent =
  | { type: "accept"; by: Role }
  | { type: "decline"; by: Role }
  | { type: "cancel"; by: Role; minutesToStart: number }
  | { type: "expire" }
  | { type: "start"; by: Role; minutesToStart: number }
  | { type: "confirm"; by: Role; otherConfirmed: boolean }
  | { type: "auto_settle"; hoursSinceFirstConfirm: number }
  | { type: "report_no_show"; by: Role; minutesSinceStart: number }
  | { type: "dispute"; by: Role };

/** Fractions are of the learner's hold (capture) or of the booked length (penalty). */
export type Effect =
  | { type: "release" }
  | { type: "capture"; fraction: number }
  | { type: "penalty"; payer: Role; fraction: number };

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export const TERMINAL: readonly BookingStatus[] = ["settled", "declined", "expired", "cancelled", "no_show"];
export const OPEN: readonly BookingStatus[] = ["requested", "accepted", "live", "confirming"];

/** A session can be started from 15 minutes before its slot. */
export const START_WINDOW_MIN = 15;
/** One side confirmed and the other is silent this long → settle automatically. */
export const AUTO_SETTLE_HOURS = 48;
/** The other side can be reported absent this long after the start time. */
export const NO_SHOW_GRACE_MIN = 15;

const deny = (msg: string): never => {
  throw new TransitionError(msg);
};

export function transition(
  status: BookingStatus,
  ev: BookingEvent,
): { next: BookingStatus; effects: Effect[] } {
  switch (ev.type) {
    case "accept":
      if (status !== "requested") deny(`cannot accept a ${status} booking`);
      if (ev.by !== "teacher") deny("only the teacher accepts");
      return { next: "accepted", effects: [] };

    case "decline":
      if (status !== "requested") deny(`cannot decline a ${status} booking`);
      if (ev.by !== "teacher") deny("only the teacher declines");
      return { next: "declined", effects: [{ type: "release" }] };

    case "expire":
      if (status !== "requested" && status !== "accepted") deny(`cannot expire a ${status} booking`);
      return { next: "expired", effects: [{ type: "release" }] };

    case "cancel":
      if (status !== "requested" && status !== "accepted") deny(`cannot cancel a ${status} booking`);
      // An unaccepted request costs nothing to withdraw; after acceptance the late-cancel policy applies.
      if (status === "requested") return { next: "cancelled", effects: [{ type: "release" }] };
      return {
        next: "cancelled",
        effects: exitPolicy({ exit: "cancel", by: ev.by, minutesToStart: ev.minutesToStart }),
      };

    case "start":
      if (status !== "accepted") deny(`cannot start a ${status} booking`);
      if (ev.minutesToStart > START_WINDOW_MIN)
        deny(`opens ${START_WINDOW_MIN} minutes before the start time`);
      return { next: "live", effects: [] };

    case "confirm":
      if (status === "live") {
        if (ev.otherConfirmed) deny("inconsistent: other side confirmed while still live");
        return { next: "confirming", effects: [] };
      }
      if (status === "confirming") {
        if (!ev.otherConfirmed) deny("already confirmed — waiting for the other side");
        return { next: "settled", effects: [{ type: "capture", fraction: 1 }] };
      }
      return deny(`cannot confirm a ${status} booking`);

    case "auto_settle":
      if (status !== "confirming") deny(`cannot auto-settle a ${status} booking`);
      if (ev.hoursSinceFirstConfirm < AUTO_SETTLE_HOURS)
        deny(`auto-settle runs after ${AUTO_SETTLE_HOURS} h of silence`);
      return { next: "settled", effects: [{ type: "capture", fraction: 1 }] };

    case "report_no_show": {
      if (status !== "accepted" && status !== "live") deny(`cannot report a no-show on a ${status} booking`);
      if (ev.minutesSinceStart < NO_SHOW_GRACE_MIN)
        deny(`wait ${NO_SHOW_GRACE_MIN} minutes after the start time`);
      const absent: Role = ev.by === "teacher" ? "learner" : "teacher";
      return { next: "no_show", effects: exitPolicy({ exit: "no_show", by: absent, minutesToStart: 0 }) };
    }

    case "dispute":
      if (status !== "live" && status !== "confirming") deny(`cannot dispute a ${status} booking`);
      // Hold stays in escrow until three stewards vote: settle, refund or split.
      return { next: "disputed", effects: [] };
  }
}

/** Which events a participant can trigger right now — the UI shows exactly these, nothing more. */
export function availableActions(
  status: BookingStatus,
  role: Role,
  ctx: { minutesToStart: number; minutesSinceStart: number; selfConfirmed: boolean },
): BookingEvent["type"][] {
  const out: BookingEvent["type"][] = [];
  if (status === "requested" && role === "teacher") out.push("accept", "decline");
  if (status === "requested" || status === "accepted") out.push("cancel");
  if (status === "accepted" && ctx.minutesToStart <= START_WINDOW_MIN) out.push("start");
  if (status === "live" || (status === "confirming" && !ctx.selfConfirmed)) out.push("confirm");
  if ((status === "accepted" || status === "live") && ctx.minutesSinceStart >= NO_SHOW_GRACE_MIN) {
    out.push("report_no_show");
  }
  if (status === "live" || status === "confirming") out.push("dispute");
  return out;
}
