import { describe, expect, it } from "vitest";
import {
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
