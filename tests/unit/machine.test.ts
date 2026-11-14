import { describe, expect, it } from "vitest";
import { availableActions, TransitionError, transition } from "@/modules/booking/machine";
import { exitPolicy } from "@/modules/booking/policy";

describe("session escrow state machine", () => {
  it("only the top row pays the teacher", () => {
    let s = transition("requested", { type: "accept", by: "teacher" });
    expect(s).toEqual({ next: "accepted", effects: [] });
    s = transition("accepted", { type: "start", by: "learner", minutesToStart: 5 });
    expect(s.next).toBe("live");
    s = transition("live", { type: "confirm", by: "learner", otherConfirmed: false });
    expect(s).toEqual({ next: "confirming", effects: [] });
    s = transition("confirming", { type: "confirm", by: "teacher", otherConfirmed: true });
    expect(s).toEqual({ next: "settled", effects: [{ type: "capture", fraction: 1 }] });
  });

  it("both sides must confirm: confirming twice from the same side is rejected", () => {
    expect(() => transition("confirming", { type: "confirm", by: "learner", otherConfirmed: false })).toThrow(
      TransitionError,
    );
  });

  it("auto-settles only after 48 h of silence", () => {
    expect(() => transition("confirming", { type: "auto_settle", hoursSinceFirstConfirm: 47 })).toThrow();
    expect(transition("confirming", { type: "auto_settle", hoursSinceFirstConfirm: 48 }).next).toBe(
      "settled",
    );
  });

  it("every exit releases, penalises, or waits for stewards", () => {
    expect(transition("requested", { type: "decline", by: "teacher" }).effects).toEqual([
      { type: "release" },
    ]);
    expect(transition("requested", { type: "expire" }).effects).toEqual([{ type: "release" }]);
    expect(transition("requested", { type: "cancel", by: "learner", minutesToStart: 5 }).effects).toEqual([
      { type: "release" },
    ]);
    expect(transition("live", { type: "dispute", by: "learner" })).toEqual({ next: "disputed", effects: [] });
    expect(
      transition("accepted", { type: "report_no_show", by: "learner", minutesSinceStart: 20 }).next,
    ).toBe("no_show");
  });

  it("rejects impossible transitions", () => {
    expect(() => transition("settled", { type: "cancel", by: "learner", minutesToStart: 999 })).toThrow();
    expect(() => transition("requested", { type: "accept", by: "learner" })).toThrow();
    expect(() => transition("accepted", { type: "start", by: "teacher", minutesToStart: 60 })).toThrow();
    expect(() =>
      transition("accepted", { type: "report_no_show", by: "teacher", minutesSinceStart: 5 }),
    ).toThrow();
  });

  it("lists only the actions that are possible now", () => {
    const ctx = { minutesToStart: 60, minutesSinceStart: -60, selfConfirmed: false };
    expect(availableActions("requested", "teacher", ctx)).toEqual(["accept", "decline", "cancel"]);
    expect(availableActions("accepted", "learner", { ...ctx, minutesToStart: 10 })).toEqual([
      "cancel",
      "start",
    ]);
    expect(availableActions("confirming", "learner", { ...ctx, selfConfirmed: true })).toEqual(["dispute"]);
  });
});

describe("exit policy", () => {
  it("cancelling 12 h or more ahead is free for either side", () => {
    expect(exitPolicy({ exit: "cancel", by: "learner", minutesToStart: 12 * 60 })).toEqual([
      { type: "release" },
    ]);
    expect(exitPolicy({ exit: "cancel", by: "teacher", minutesToStart: 24 * 60 })).toEqual([
      { type: "release" },
    ]);
  });

  it("late cancels cost the canceller and pay the other participant", () => {
    expect(exitPolicy({ exit: "cancel", by: "learner", minutesToStart: 60 })).toEqual([
      { type: "capture", fraction: 0.5 },
    ]);
    expect(exitPolicy({ exit: "cancel", by: "teacher", minutesToStart: 60 })).toContainEqual({
      type: "penalty",
      payer: "teacher",
      fraction: 0.25,
    });
  });

  it("no-shows cost more than late cancels", () => {
    expect(exitPolicy({ exit: "no_show", by: "learner", minutesToStart: 0 })).toEqual([
      { type: "capture", fraction: 1 },
    ]);
    expect(exitPolicy({ exit: "no_show", by: "teacher", minutesToStart: 0 })).toContainEqual({
      type: "penalty",
      payer: "teacher",
      fraction: 0.5,
    });
  });
});
