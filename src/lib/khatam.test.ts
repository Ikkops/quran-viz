import { describe, expect, it } from "vitest";
import { khatamPlan, sanitizeKhatam } from "./khatam";

// 2026-11-01 .. 2026-11-30: 30 days, from page 4 → 600 pages to go, 20 a day.
const target = { start: "2026-11-01", end: "2026-11-30", from: 4 };

describe("khatamPlan", () => {
  it("on the day it is created: the whole span ahead, on track", () => {
    expect(khatamPlan(target, 4, "2026-11-01")).toEqual({
      pagesLeft: 600,
      daysLeft: 30,
      perDay: 20,
      today: 20,
      expected: 4,
      status: { kind: "onTrack" },
      progress: 0,
    });
  });

  it("is behind when yesterday's share was not read", () => {
    const p = khatamPlan(target, 30, "2026-11-03"); // should be at 4 + 2*20 = 44
    expect(p.expected).toBe(44);
    expect(p.status).toEqual({ kind: "behind", pages: 14 });
    expect(p.daysLeft).toBe(28);
    expect(p.perDay).toBe(Math.ceil(574 / 28));
  });

  it("on the last day everything left is today's share", () => {
    const p = khatamPlan(target, 590, "2026-11-30");
    expect(p.daysLeft).toBe(1);
    expect(p.perDay).toBe(14);
    expect(p.status).toEqual({ kind: "onTrack" });
  });

  it("is overdue past the end date", () => {
    const p = khatamPlan(target, 500, "2026-12-02");
    expect(p.status).toEqual({ kind: "overdue" });
    expect(p.daysLeft).toBe(0);
    expect(p.perDay).toBe(104);
  });

  it("is done at the last page, even late", () => {
    for (const day of ["2026-11-10", "2026-12-10"]) {
      const p = khatamPlan(target, 604, day);
      expect(p.status).toEqual({ kind: "done" });
      expect(p.pagesLeft).toBe(0);
      expect(p.progress).toBe(1);
    }
  });

  it("never shows negative progress after moving back before the start", () => {
    expect(khatamPlan({ ...target, from: 100 }, 20, "2026-11-01").progress).toBe(0);
  });

  it("handles an end date equal to the start", () => {
    const p = khatamPlan(
      { start: "2026-11-05", end: "2026-11-05", from: 1 },
      1,
      "2026-11-05",
    );
    expect(p).toMatchObject({
      daysLeft: 1,
      perDay: 603,
      expected: 1,
      status: { kind: "onTrack" },
    });
  });

  it("counts down today's pages and stops at zero once they are read", () => {
    // 30 days from page 1: the line stands at page 22 tonight (ceil(1 + 603/30)).
    const t = { start: "2026-01-01", end: "2026-01-30", from: 1 };
    expect(khatamPlan(t, 1, "2026-01-01").today).toBe(21);
    expect(khatamPlan(t, 22, "2026-01-01").today).toBe(0);
    expect(khatamPlan(t, 40, "2026-01-01").today).toBe(0);
    // Overdue: everything left.
    expect(khatamPlan(t, 500, "2026-02-05").today).toBe(104);
  });
});

describe("sanitizeKhatam", () => {
  it("keeps a well-formed target and rejects broken ones", () => {
    expect(sanitizeKhatam(target)).toEqual(target);
    expect(sanitizeKhatam(null)).toBeUndefined();
    expect(sanitizeKhatam({ ...target, end: "2026-10-01" })).toBeUndefined();
    expect(sanitizeKhatam({ ...target, from: 605 })).toBeUndefined();
    expect(sanitizeKhatam({ ...target, start: "soon" })).toBeUndefined();
  });
});
