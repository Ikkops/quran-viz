import { describe, expect, it } from "vitest";
import { sanitizeBookmarks, setBookmarkNote, toggleBookmark } from "./bookmarks";

describe("bookmarks", () => {
  it("toggles and annotates", () => {
    let list = toggleBookmark([], 262, 1);
    expect(list).toEqual([{ id: 262, note: "", at: 1 }]);
    list = setBookmarkNote(list, 262, "Ayat al-Kursi");
    expect(list[0].note).toBe("Ayat al-Kursi");
    expect(toggleBookmark(list, 262)).toEqual([]);
  });

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
