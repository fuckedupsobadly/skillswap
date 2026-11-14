import { describe, expect, it } from "vitest";
import {
  anytime,
  expand,
  intersect,
  sharedFreeTime,
  slotStarts,
  totalMinutes,
} from "@/modules/booking/slots";
import { edgeScore, levelFit, timeOverlap, trustFactor } from "@/modules/matching/score";
import { canonicalJson } from "@/modules/platform/canonical";
import { formatMinutes } from "@/modules/platform/format";
import { bayesianRating, trustLevel } from "@/modules/trust/reputation";

describe("availability and slots", () => {
  const monday = new Date("2026-11-16T00:00:00Z"); // a Monday

  it("expands a weekly rule in the member's own timezone", () => {
    // 18:00–20:00 Monday in Almaty (UTC+5) is 13:00–15:00 UTC.
    const ivs = expand(
      [{ weekday: 1, startMin: 18 * 60, endMin: 20 * 60, timezone: "Asia/Almaty" }],
      monday,
      new Date(monday.getTime() + 86_400_000),
    );
    expect(ivs).toEqual([
      { start: Date.parse("2026-11-16T13:00:00Z"), end: Date.parse("2026-11-16T15:00:00Z") },
    ]);
  });

  it("intersects two members' free time across timezones", () => {
    const a = [{ weekday: 1, startMin: 18 * 60, endMin: 22 * 60, timezone: "Asia/Almaty" }]; // 13–17 UTC
    const b = [{ weekday: 1, startMin: 14 * 60, endMin: 16 * 60, timezone: "Europe/London" }]; // 14–16 UTC
    const shared = sharedFreeTime(a, b, monday, 1);
    expect(totalMinutes(shared)).toBe(120);
  });

  it("offers a slot now, then on the half hour, only where the whole session fits", () => {
    const now = new Date("2026-11-16T10:07:00Z");
    const ivs = intersect(expand(anytime("UTC"), now, new Date("2026-11-16T12:00:00Z")), [
      { start: now.getTime(), end: Date.parse("2026-11-16T12:00:00Z") },
    ]);
    const slots = slotStarts(ivs, 60, now).map((d) => d.toISOString().slice(11, 16));
    expect(slots).toEqual(["10:10", "10:30", "11:00"]);
  });
});

describe("match scoring", () => {
  it("is a product of factors in (0, 1]", () => {
    expect(edgeScore({ similarity: 1, levelFit: 1, timeOverlap: 1, trust: 1, activity: 1 })).toBe(1);
    expect(levelFit(4, 1)).toBe(1);
    expect(levelFit(2, 2)).toBeLessThan(1);
    expect(timeOverlap(30, 60)).toBe(0);
    expect(timeOverlap(180, 60)).toBe(1);
    expect(trustFactor(0)).toBeCloseTo(0.7);
  });
});

describe("trust", () => {
  it("weights ratings by distinct counterparts", () => {
    const oneFriend = Array.from({ length: 10 }, () => ({ authorId: "friend", rating: 5 }));
    const tenPeople = Array.from({ length: 10 }, (_, i) => ({ authorId: `p${i}`, rating: 5 }));
    expect(bayesianRating(oneFriend)!).toBeLessThan(bayesianRating(tenPeople)!);
    expect(bayesianRating([])).toBeNull();
  });

  it("levels follow the table", () => {
    expect(trustLevel({ settledSessions: 3, rating: 4, hasRecovery: false, upheldReports: 0 })).toBe(0);
    expect(trustLevel({ settledSessions: 3, rating: 4, hasRecovery: true, upheldReports: 0 })).toBe(1);
    expect(trustLevel({ settledSessions: 12, rating: 4.6, hasRecovery: true, upheldReports: 0 })).toBe(2);
    expect(trustLevel({ settledSessions: 12, rating: 4.6, hasRecovery: true, upheldReports: 1 })).toBe(1);
    expect(trustLevel({ settledSessions: 31, rating: 4.8, hasRecovery: true, upheldReports: 0 })).toBe(3);
  });
});

describe("format and canonical JSON", () => {
  it("writes hours one way", () => {
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(30)).toBe("30 min");
    expect(formatMinutes(90)).toBe("1 h 30 min");
    expect(formatMinutes(-30)).toBe("−30 min");
  });
  it("is key-order independent", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 1 }] })).toBe(canonicalJson({ a: [{ c: 1, d: 2 }], b: 1 }));
  });
});
