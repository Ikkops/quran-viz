import { describe, expect, it } from "vitest";
import {
  activityView,
  addDays,
  addReading,
  currentStreak,
  dayKey,
  longestStreak,
  sanitizeReadingLog,
  shiftAnchor,
} from "./readingLog";

const MIN = 60;
// Fri 13 Nov 2026.
const TODAY = "2026-11-13";

describe("days", () => {
  it("keys a date by its local calendar day", () => {
    expect(dayKey(new Date(2026, 10, 13, 23, 59))).toBe("2026-11-13");
    expect(dayKey(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("the log", () => {
  it("adds time to a day without touching the others", () => {
    const log = addReading({ "2026-11-12": 60 }, TODAY, 30);
    expect(log).toEqual({ "2026-11-12": 60, [TODAY]: 30 });
    expect(addReading(log, TODAY, 45)[TODAY]).toBe(75);
    expect(addReading(log, TODAY, 0)).toBe(log);
  });
  it("drops malformed stored entries", () => {
    expect(
      sanitizeReadingLog({
        "2026-11-13": 120,
        "2026-13-40": 50,
        nonsense: 5,
        "2026-11-12": -4,
        "2026-11-11": "9",
        "2026-11-10": 999_999,
      }),
    ).toEqual({ "2026-11-13": 120, "2026-11-10": 86_400 });
    expect(sanitizeReadingLog([1, 2])).toBeUndefined();
  });
});

describe("streaks", () => {
  const log = {
    "2026-11-09": 6 * MIN,
    "2026-11-10": 2 * MIN, // under a 5-minute goal
    "2026-11-11": 5 * MIN,
    "2026-11-12": 9 * MIN,
  };
  it("counts back from yesterday while today is still open", () => {
    expect(currentStreak(log, TODAY, 5 * MIN)).toBe(2);
  });
  it("includes today once it meets the goal", () => {
    expect(currentStreak({ ...log, [TODAY]: 5 * MIN }, TODAY, 5 * MIN)).toBe(3);
  });
  it("is broken by a missed day", () => {
    expect(currentStreak(log, "2026-11-14", 5 * MIN)).toBe(0);
  });
  it("depends on the goal", () => {
    expect(currentStreak(log, TODAY, 1 * MIN)).toBe(4);
    expect(longestStreak(log, 1 * MIN)).toBe(4);
    expect(longestStreak(log, 5 * MIN)).toBe(2);
    expect(longestStreak({}, MIN)).toBe(0);
  });
});

describe("activityView", () => {
  const log = {
    "2025-12-31": 10 * MIN,
    "2026-10-30": 20 * MIN,
    "2026-11-08": 21 * MIN, // Sunday
    "2026-11-09": 17 * MIN,
    "2026-11-11": 2 * MIN,
    [TODAY]: 6 * MIN,
  };
  it("shows the week from Sunday, one bar a day", () => {
    const v = activityView(log, "week", TODAY, TODAY, 5 * MIN);
    expect([v.from, v.to]).toEqual(["2026-11-08", "2026-11-14"]);
    expect(v.buckets.map((b) => Math.round(b.seconds / MIN))).toEqual([
      21, 17, 0, 2, 0, 6, 0,
    ]);
    expect(v.seconds).toBe(46 * MIN);
    expect(v.daysRead).toBe(4);
    expect(v.daysMet).toBe(3);
    // Sunday to Friday.
    expect(v.daysElapsed).toBe(6);
    expect(v.buckets[6].future).toBe(true);
    expect(v.hasPrev).toBe(true);
    expect(v.hasNext).toBe(false);
  });
  it("pages back a week", () => {
    const anchor = shiftAnchor("week", TODAY, -1);
    const v = activityView(log, "week", anchor, TODAY, 5 * MIN);
    expect([v.from, v.to]).toEqual(["2026-11-01", "2026-11-07"]);
    expect(v.seconds).toBe(0);
    expect(v.daysElapsed).toBe(7);
    expect(v.hasNext).toBe(true);
  });
  it("shows a month by day", () => {
    const v = activityView(log, "month", TODAY, TODAY, 5 * MIN);
    expect(v.buckets).toHaveLength(30);
    expect(v.unit).toBe("day");
    expect(v.seconds).toBe(46 * MIN);
    expect(shiftAnchor("month", "2026-01-31", -1)).toBe("2025-12-01");
  });
  it("shows a year by month", () => {
    const v = activityView(log, "year", TODAY, TODAY, 5 * MIN);
    expect(v.unit).toBe("month");
    expect(v.buckets).toHaveLength(12);
    expect(v.buckets[9].seconds).toBe(20 * MIN);
    expect(v.buckets[10].daysRead).toBe(4);
    expect(v.buckets[11].future).toBe(true);
    expect(v.hasPrev).toBe(true);
  });
  it("shows all time by month from the first day read", () => {
    const v = activityView(log, "all", TODAY, TODAY, 5 * MIN);
    expect(v.unit).toBe("month");
    expect(v.from).toBe("2025-12-31");
    expect(v.buckets).toHaveLength(12);
    expect(v.seconds).toBe(76 * MIN);
    expect(v.hasPrev || v.hasNext).toBe(false);
  });
  it("switches all time to years once it spans more than two", () => {
    const v = activityView({ ...log, "2023-05-01": MIN }, "all", TODAY, TODAY, MIN);
    expect(v.unit).toBe("year");
    expect(v.buckets.map((b) => b.from.slice(0, 4))).toEqual([
      "2023",
      "2024",
      "2025",
      "2026",
    ]);
  });
  it("is an empty period for a new learner", () => {
    const v = activityView({}, "week", TODAY, TODAY, MIN);
    expect(v.seconds).toBe(0);
    expect(v.hasPrev).toBe(false);
  });
});
