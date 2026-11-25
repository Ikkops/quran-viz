import { beforeEach, describe, expect, it } from "vitest";
import {
  REVIEW_LOG_KEY,
  appendReviews,
  logReviews,
  recallStats,
  sanitizeReviewLog,
} from "./reviewLog";

const DAY = 86_400_000;
beforeEach(() => localStorage.clear());

describe("review history", () => {
  it("logs one entry per page rated and counts recall over 30 days", () => {
    const now = 100 * DAY;
    let log = logReviews([], [1, 2], 3, now - 40 * DAY); // too old to count
    log = logReviews(log, [3, 4, 5], 1, now - 5 * DAY);
    log = logReviews(log, [6], 2, now - DAY);
    expect(log).toHaveLength(6);
    expect(recallStats(log, now)).toEqual({ reviews: 4, recalled: 1 });
    // Ratings made after "now" still count.
    expect(recallStats(logReviews(log, [7], 3, now + 1), now).reviews).toBe(5);
  });

  it("keeps only well-formed entries and stores what is appended", () => {
    expect(
      sanitizeReviewLog([[1, 3, 5], [700, 3, 5], [1, 4, 5], "x", [2, 1, 9]]),
    ).toEqual([
      [1, 3, 5],
      [2, 1, 9],
    ]);
    appendReviews([10, 11], 2, 42);
    expect(JSON.parse(localStorage.getItem(REVIEW_LOG_KEY) ?? "[]")).toEqual([
      [10, 2, 42],
      [11, 2, 42],
    ]);
  });
});
