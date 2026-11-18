import { describe, expect, it } from "vitest";
import {
  lineWidths,
  pageAyahs,
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
  it("pageAyahs: the ayahs starting on a page", () => {
    expect(pageAyahs(layout, 1, 3)).toEqual({ from: 1, to: 2 });
    expect(pageAyahs(layout, 2, 3)).toEqual({ from: 3, to: 3 });
    expect(pageAyahs(layout, 3, 3)).toBeNull();
  });
});

describe("lineWidths", () => {
  it("sums each line's words, medallions and gaps, and finds the short ones", () => {
    // Ayah 1 has words "aa bb", ayah 2 "c"; one char measures 1 at px 4.
    const words = new Map([
      [1, { text: ["aa", "bb"], segs: null }],
      [2, { text: ["c"], segs: [[{ text: "cc" }, { text: "c", rule: "g" }]] }],
    ]);
    const lines = [
      { kind: "name", surah: 1 },
      {
        kind: "words",
        words: [
          { id: 1, w: 1 },
          { id: 1, w: 2 },
          { id: 2, w: 1 },
        ],
      },
      { kind: "words", words: [{ id: 2, w: 1 }] },
    ] as const;
    const r = lineWidths(
      lines as never,
      words,
      [{ a: 1 }, { a: 2 }],
      (id) => (id === 1 ? 2 : 1),
      "KFGQPC Hafs",
      (t) => t.length,
      4,
    );
    // Line 1: "aa" + "bb ١" (KFGQPC: digits only) + "ccc ٢" + 2 gaps of 1 = 2+4+5+2.
    expect(r?.widest).toBe(13);
    // Line 2: "ccc ٢" = 5 < 13 × 0.72; the name line is not measured.
    expect([...(r?.short ?? [])]).toEqual([2]);
    expect(
      lineWidths(
        [{ kind: "blank" }],
        words,
        [],
        () => 1,
        "Amiri",
        () => 1,
        4,
      ),
    ).toBeNull();
  });
});
