import { describe, expect, it } from "vitest";
import {
  listStumbles,
  pagesWith,
  rateReview,
  removeStumble,
  sambungStarts,
  todaysPlan,
  addStumble,
  ayahsWith,
  countStatus,
  emptyHifdh,
  sanitizeHifdh,
  setStatus,
  statusOf,
  stumbleCount,
} from "./hifdh";

describe("hifdh status", () => {
  it("starts with nothing memorised", () => {
    const h = emptyHifdh();
    expect(h.status).toHaveLength(6236);
    expect(countStatus(h)).toEqual([6236, 0, 0, 0]);
  });

  it("marks a range, ends included, in either order", () => {
    const h = setStatus(setStatus(emptyHifdh(), 8, 12, 2), 12, 11, 3);
    expect([7, 8, 10, 11, 12, 13].map((id) => statusOf(h, id))).toEqual([
      0, 2, 2, 3, 3, 0,
    ]);
    expect(h.status).toHaveLength(6236);
    expect(countStatus(h, 1, 20)).toEqual([15, 0, 3, 2]);
    expect(ayahsWith(h, [2, 3])).toEqual([8, 9, 10, 11, 12]);
  });

  it("clamps a range to the mushaf", () => {
    const h = setStatus(emptyHifdh(), 6230, 9999, 2);
    expect(h.status).toHaveLength(6236);
    expect(countStatus(h)[2]).toBe(7);
  });
});

describe("stumbles", () => {
  it("counts each peek at a word", () => {
    let h = addStumble(emptyHifdh(), 255, 3, 10);
    h = addStumble(h, 255, 3, 20);
    expect(stumbleCount(h, 255, 3)).toBe(2);
    expect(stumbleCount(h, 255, 4)).toBe(0);
    expect(h.stumbles["255:3"].at).toBe(20);
  });
});

describe("sanitizeHifdh", () => {
  it("rejects other shapes", () => {
    expect(sanitizeHifdh(null)).toBeUndefined();
    expect(sanitizeHifdh({ status: "0129" })).toBeUndefined();
  });

  it("repairs the length and drops bad stumbles", () => {
    const h = sanitizeHifdh({
      status: "0123",
      stumbles: { "5:1": { n: 2, at: 9 }, bad: { n: 1, at: 1 }, "6:0": { n: 0, at: 1 } },
    });
    expect(h?.status).toHaveLength(6236);
    expect(h && statusOf(h, 4)).toBe(3);
    expect(h?.stumbles).toEqual({ "5:1": { n: 2, at: 9 } });
  });
});

// Ten ayahs a page, two pages a surah.
const verses = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  page: Math.floor(i / 10) + 1,
  s: Math.floor(i / 20) + 1,
}));

describe("review", () => {
  it("finds the pages that hold memorised ayahs", () => {
    const h = setStatus(emptyHifdh(), 8, 12, 2);
    expect(pagesWith(h, verses, [2, 3])).toEqual([
      { page: 1, from: 1, to: 10 },
      { page: 2, from: 11, to: 20 },
    ]);
    expect(pagesWith(h, verses, [1])).toEqual([]);
  });

  it("climbs the ladder on smooth, repeats on hard, restarts on forgot", () => {
    const page = [{ page: 1, from: 1, to: 10 }];
    let h = setStatus(emptyHifdh(), 1, 10, 2);
    h = rateReview(h, page, "smooth", "2026-11-15");
    expect(h.reviews[1]).toEqual({ step: 0, due: "2026-11-16" });
    h = rateReview(h, page, "smooth", "2026-11-16");
    expect(h.reviews[1]).toEqual({ step: 1, due: "2026-11-19" });
    h = rateReview(h, page, "hard", "2026-11-19");
    expect(h.reviews[1]).toEqual({ step: 1, due: "2026-11-22" });
    h = rateReview(h, page, "forgot", "2026-11-22");
    expect(h.reviews[1]).toEqual({ step: 0, due: "2026-11-23" });
    expect(countStatus(h, 1, 10)).toEqual([0, 0, 0, 10]);
    h = rateReview(h, page, "smooth", "2026-11-23");
    expect(countStatus(h, 1, 10)).toEqual([0, 0, 10, 0]);
  });

  it("leaves ayahs that are not memorised alone", () => {
    const h = rateReview(
      setStatus(emptyHifdh(), 1, 5, 2),
      [{ page: 1, from: 1, to: 10 }],
      "forgot",
      "2026-11-15",
    );
    expect(countStatus(h, 1, 10)).toEqual([5, 0, 0, 5]);
  });
});

describe("todaysPlan", () => {
  it("splits what is due into recent and old, and caps the old pages", () => {
    let h = setStatus(emptyHifdh(), 1, 50, 2);
    h = setStatus(h, 51, 55, 1);
    // Page 1 reviewed yesterday (recent, due today); page 2 not due yet.
    h = rateReview(h, [{ page: 1, from: 1, to: 10 }], "smooth", "2026-11-14");
    h = rateReview(h, [{ page: 2, from: 11, to: 20 }], "smooth", "2026-11-15");
    // Page 5 is far up the ladder and overdue.
    h = { ...h, reviews: { ...h.reviews, 5: { step: 4, due: "2026-11-01" } } };
    const plan = todaysPlan(h, verses, "2026-11-15", 2);
    expect(plan.recent.map((p) => p.page)).toEqual([1]);
    expect(plan.old.map((p) => p.page)).toEqual([5, 3]);
    expect(plan.oldDue).toBe(3);
    expect(plan.learning.map((p) => p.page)).toEqual([6]);
  });
});

describe("stumble list", () => {
  it("lists the most repeated first and removes one", () => {
    let h = addStumble(emptyHifdh(), 5, 1, 10);
    h = addStumble(h, 9, 0, 20);
    h = addStumble(h, 9, 0, 30);
    expect(listStumbles(h).map((x) => `${x.id}:${x.w}x${x.n}`)).toEqual([
      "9:0x2",
      "5:1x1",
    ]);
    expect(listStumbles(removeStumble(h, 9, 0))).toHaveLength(1);
  });
});

describe("sambungStarts", () => {
  it("needs the next ayah of the same surah memorised too", () => {
    const h = setStatus(emptyHifdh(), 18, 22, 2);
    // 20 is the last ayah of surah 1: 21 follows in another surah.
    expect(sambungStarts(h, verses)).toEqual([18, 19, 21]);
  });
});
