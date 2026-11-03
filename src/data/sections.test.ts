import { describe, expect, it } from "vitest";
import type { ThemesData } from "../types/quran";
import { asbabByFirstAyah, themeHeadingAt, themeIndexById } from "./sections";

const themes: ThemesData = [
  [2, 4, "A"],
  [5, 5, "B"],
];

describe("theme headings", () => {
  const idx = themeIndexById(themes, 8);
  it("maps ayah ids to their section", () => {
    expect([...idx]).toEqual([-1, -1, 0, 0, 0, 1, -1, -1, -1]);
  });
  it("shows a heading at a section start and when entering mid-section", () => {
    expect(themeHeadingAt(themes, idx, 2, 1)).toBe("A");
    expect(themeHeadingAt(themes, idx, 3, 2)).toBeNull();
    expect(themeHeadingAt(themes, idx, 3, null)).toBe("A"); // first row shown
    expect(themeHeadingAt(themes, idx, 5, 4)).toBe("B");
    expect(themeHeadingAt(themes, idx, 6, 5)).toBeNull(); // uncovered ayah
  });
});

describe("asbabByFirstAyah", () => {
  it("groups ranges by their first ayah", () => {
    const m = asbabByFirstAyah({
      source: "",
      items: [
        [96, 96, ["x", "y"]],
        [96, 98, ["z"]],
      ],
    });
    expect(m.get(96)?.map((e) => e.last)).toEqual([96, 98]);
    expect(m.has(97)).toBe(false);
  });
});
