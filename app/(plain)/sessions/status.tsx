import type { BookingStatus } from "@/modules/booking/machine";
import { Pill } from "@/ui/bits";

const LABEL: Record<BookingStatus, [string, "neutral" | "success" | "danger" | "accent"]> = {
  requested: ["Requested", "neutral"],
  accepted: ["Booked", "accent"],
  live: ["Live", "accent"],
  confirming: ["Confirming", "neutral"],
  settled: ["Settled", "success"],
  declined: ["Declined", "neutral"],
  expired: ["Expired", "neutral"],
  cancelled: ["Cancelled", "neutral"],
  no_show: ["No-show", "danger"],
  disputed: ["Disputed", "danger"],
};

export const StatusPill = ({ status }: { status: BookingStatus }) => (
  <Pill tone={LABEL[status][1]}>{LABEL[status][0]}</Pill>
);

/** One plain line per state, for the Lantern Room strip and the sessions list. */
export const STATUS_TEXT: Record<BookingStatus, string> = {
  requested: "Waiting for the teacher to accept",
  accepted: "Booked · the lantern lights when you start",
  live: "In a lesson",
  confirming: "Lesson over · both sides confirm",
  settled: "Settled · hours moved",
  declined: "Declined · hours returned",
  expired: "Expired · hours returned",
  cancelled: "Cancelled",
  no_show: "No-show",
  disputed: "Disputed · with the stewards",
};
