import { describe, expect, it } from "vitest";
import {
  pageLines,
  pageOf,
  pagesFor,
  splitWords,
  type MushafLayout,
} from "./mushafLayout";

describe("splitWords", () => {
  it("joins pause marks to the word before and ۞ to the word after", () => {
    expect(splitWords("ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى")).toEqual([
      "ذَٰلِكَ",
      "ٱلْكِتَٰبُ",
      "لَا",
      "رَيْبَ ۛ",
      "فِيهِ ۛ",
      "هُدًى",
    ]);
    expect(splitWords("۞ إِنَّ ٱللَّهَ")).toEqual(["۞ إِنَّ", "ٱللَّهَ"]);
  });
});

// Ayahs 1..3 with 3, 4 and 2 words over two pages.
const counts = [0, 3, 4, 2];
const layout: MushafLayout = {
  pages: 2,
  lines: 3,
  page: [
    [
      ["s", 1],
      [1, 1],
      [2, 2],
    ],
    [[2, 4], ["b"], [3, 1]],
  ],
};

describe("pageLines", () => {
  it("runs each line to the start of the next, across pages", () => {
    const lines = pageLines(layout, 1, (id) => counts[id], 3);
    expect(lines[0]).toEqual({ kind: "name", surah: 1 });
    expect(lines[1]).toEqual({
      kind: "words",
      words: [
        { id: 1, w: 1 },
        { id: 1, w: 2 },
        { id: 1, w: 3 },
        { id: 2, w: 1 },
      ],
    });
    expect(lines[2]).toEqual({
      kind: "words",
      words: [
        { id: 2, w: 2 },
        { id: 2, w: 3 },
      ],
    });
    const p2 = pageLines(layout, 2, (id) => counts[id], 3);
    expect(p2[0]).toEqual({ kind: "words", words: [{ id: 2, w: 4 }] });
    expect(p2[1]).toEqual({ kind: "basmala" });
    expect(p2[2]).toEqual({
      kind: "words",
      words: [
        { id: 3, w: 1 },
        { id: 3, w: 2 },
      ],
    });
  });
});

describe("pagesFor / pageOf", () => {
  it("finds the pages an ayah range touches", () => {
    expect(pagesFor(layout, 1, 1)).toEqual([1]);
    expect(pagesFor(layout, 2, 2)).toEqual([1, 2]);
    expect(pagesFor(layout, 3, 3)).toEqual([2]);
    expect(pageOf(layout, 2)).toBe(1);
    expect(pageOf(layout, 3)).toBe(2);
  });
});
