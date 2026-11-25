import { describe, expect, it } from "vitest";
import {
  type Hifdh,
  listStumbles,
  nextMemory,
  pagesWith,
  progressBy,
  rateReview,
  removeStumble,
  sambungStarts,
  todaysPlan,
  addStumble,
  ayahsWith,
  countStatus,
  emptyHifdh,
  sanitizeHifdh,
  setRetention,
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

  it("repairs the length and drops bad stumbles, keeping removal markers", () => {
    const h = sanitizeHifdh({
      status: "0123",
      stumbles: { "5:1": { n: 2, at: 9 }, bad: { n: 1, at: 1 }, "6:0": { n: 0, at: 1 } },
    });
    expect(h?.status).toHaveLength(6236);
    expect(h && statusOf(h, 4)).toBe(3);
    // A zero count is a removed stumble, kept so sync doesn't bring it back.
    expect(h?.stumbles).toEqual({ "5:1": { n: 2, at: 9 }, "6:0": { n: 0, at: 1 } });
    expect(h && listStumbles(h)).toEqual([{ id: 5, w: 1, n: 2, at: 9 }]);
  });

  it("stamps status changes, retention and ratings for sync", () => {
    let h = setStatus(emptyHifdh(), 1, 3, 2, 100);
    expect(h.statusAt).toEqual({ 1: 100, 2: 100, 3: 100 });
    // Ayahs already at that status keep their time.
    h = setStatus(h, 2, 4, 2, 200);
    expect(h.statusAt).toEqual({ 1: 100, 2: 100, 3: 100, 4: 200 });
    h = rateReview(h, [{ page: 1, from: 1, to: 4 }], "forgot", "2026-11-25", 300);
    expect(h.reviews[1].at).toBe(300);
    expect(h.statusAt).toEqual({ 1: 300, 2: 300, 3: 300, 4: 300 });
    expect(setRetention(h, 0.95, 400)).toMatchObject({
      retention: 0.95,
      retentionAt: 400,
    });
    const back = sanitizeHifdh(JSON.parse(JSON.stringify(setRetention(h, 0.95, 400))));
    expect(back).toMatchObject({ retentionAt: 400, statusAt: h.statusAt });
    expect(back?.reviews[1].at).toBe(300);
  });

  it("reads ladder reviews as FSRS memory", () => {
    const h = sanitizeHifdh({
      status: "2",
      reviews: { 1: { due: "2026-11-20", step: 2 }, 2: { due: "x", step: 1 } },
      retention: 0.95,
    });
    expect(h?.reviews).toEqual({
      1: { due: "2026-11-20", last: "2026-11-13", s: 7, d: 5 },
    });
    expect(h?.retention).toBe(0.95);
    expect(sanitizeHifdh({ status: "2", retention: 0.5 })?.retention).toBeUndefined();
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

  it("matches fsrs-rs's memory state test (default parameters)", () => {
    // fsrs-rs 6.6.2 `test_memory_state`: Again, then Good five times.
    let m: { s: number; d: number } | null = null;
    for (const [g, days] of [
      [1, 0],
      [3, 0],
      [3, 1],
      [3, 3],
      [3, 8],
      [3, 21],
    ])
      m = nextMemory(m, days, g);
    expect(m!.s).toBeCloseTo(53.62691, 3);
    expect(m!.d).toBeCloseTo(6.3574867, 4);
  });

  it("moves reviews further on smooth, less on hard, back on forgot", () => {
    const page = [{ page: 1, from: 1, to: 10 }];
    const gap = (h: Hifdh) =>
      (Date.parse(h.reviews[1].due) - Date.parse(h.reviews[1].last)) / 86_400_000;
    let h = setStatus(emptyHifdh(), 1, 10, 2);
    h = rateReview(h, page, "smooth", "2026-11-15");
    expect(h.reviews[1]).toMatchObject({ last: "2026-11-15", due: "2026-11-17" });
    const first = gap(h);
    h = rateReview(h, page, "smooth", "2026-11-17");
    const smooth = gap(h);
    expect(smooth).toBeGreaterThan(first);
    const hard = gap(rateReview(h, page, "hard", h.reviews[1].due));
    const good = gap(rateReview(h, page, "smooth", h.reviews[1].due));
    expect(hard).toBeLessThan(good);
    h = rateReview(h, page, "forgot", h.reviews[1].due);
    expect(gap(h)).toBeLessThan(smooth);
    expect(countStatus(h, 1, 10)).toEqual([0, 0, 0, 10]);
    h = rateReview(h, page, "smooth", h.reviews[1].due);
    expect(countStatus(h, 1, 10)).toEqual([0, 0, 10, 0]);
  });

  it("never schedules past half a year, and aims later for lower retention", () => {
    const page = [{ page: 1, from: 1, to: 10 }];
    const strong: Hifdh = {
      ...setStatus(emptyHifdh(), 1, 10, 2),
      reviews: { 1: { due: "2026-11-15", last: "2026-06-01", s: 400, d: 2 } },
    };
    expect(rateReview(strong, page, "smooth", "2026-11-15").reviews[1].due).toBe(
      "2027-05-14",
    );
    const mid: Hifdh = {
      ...strong,
      reviews: { 1: { due: "2026-11-15", last: "2026-11-05", s: 10, d: 5 } },
    };
    const due = (r: number) =>
      rateReview({ ...mid, retention: r }, page, "smooth", "2026-11-15").reviews[1].due;
    expect(due(0.85) > due(0.9) && due(0.9) > due(0.97)).toBe(true);
  });

  it("spreads pages rated together over the fuzz range", () => {
    const pages = [1, 2, 3, 4, 5, 6].map((p) => ({
      page: p,
      from: p * 10 - 9,
      to: p * 10,
    }));
    let h = setStatus(emptyHifdh(), 1, 60, 2);
    h = {
      ...h,
      reviews: Object.fromEntries(
        pages.map((p) => [
          p.page,
          { due: "2026-11-15", last: "2026-11-05", s: 10, d: 5 },
        ]),
      ),
    };
    const dues = new Set(
      Object.values(rateReview(h, pages, "smooth", "2026-11-15").reviews).map(
        (r) => r.due,
      ),
    );
    expect(dues.size).toBeGreaterThan(3);
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
    // Pages 4 and 5 were last seen a month ago and are overdue; page 5's
    // memory is weaker, so it comes first.
    h = {
      ...h,
      reviews: {
        ...h.reviews,
        1: { ...h.reviews[1], due: "2026-11-15" },
        4: { due: "2026-11-10", last: "2026-10-10", s: 40, d: 5 },
        5: { due: "2026-11-12", last: "2026-10-12", s: 20, d: 5 },
      },
    };
    const plan = todaysPlan(h, verses, "2026-11-15", 2);
    expect(plan.recent.map((p) => p.page)).toEqual([1]);
    expect(plan.old.map((p) => p.page)).toEqual([5, 4]);
    expect(plan.oldDue).toBe(3);
    expect(plan.learning.map((p) => p.page)).toEqual([6]);
  });
});

describe("progressBy", () => {
  it("counts memorised, weak and memorising ayahs per surah, with its range", () => {
    let h = setStatus(emptyHifdh(), 1, 15, 2);
    h = setStatus(h, 14, 22, 3);
    h = setStatus(h, 41, 45, 1);
    const by = progressBy(h, verses, (v) => v.s);
    expect(by.get(1)).toEqual({
      total: 20,
      done: 20,
      weak: 7,
      learning: 0,
      from: 1,
      to: 20,
    });
    expect(by.get(2)).toEqual({
      total: 20,
      done: 2,
      weak: 2,
      learning: 0,
      from: 21,
      to: 40,
    });
    expect(by.get(3)).toEqual({
      total: 20,
      done: 0,
      weak: 0,
      learning: 5,
      from: 41,
      to: 60,
    });
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
