import { describe, expect, it } from "vitest";
import { sanitizeBookmarks } from "./bookmarks";

describe("bookmarks", () => {
  it("sanitizes stored data", () => {
    expect(sanitizeBookmarks("x")).toBeUndefined();
    expect(
      sanitizeBookmarks([
        { id: 1, note: "a", at: 5 },
        { id: 1, note: "dup", at: 6 },
        { id: 99999 },
        { id: 2 },
        null,
      ]),
    ).toEqual([
      { id: 1, note: "a", at: 5 },
      { id: 2, note: "", at: 0 },
    ]);
  });
});
