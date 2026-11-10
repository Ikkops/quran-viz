import { describe, expect, it } from "vitest";
import type { ThemesData, Verse } from "../types/quran";
import {
  asbabByFirstAyah,
  divisionCards,
  tafsirGroupAt,
  tafsirGroupLookup,
  themeHeadingAt,
  themeIndexById,
} from "./sections";

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

describe("grouped tafsir", () => {
  // Surah 19 ayahs 7–10 as global ids 100–103; one passage covers 7–9.
  const vs = [7, 8, 9, 10].map((a, i) => ({ id: 100 + i, s: 19, a }) as Verse);
  const lookup = tafsirGroupLookup(
    vs,
    new Map([
      [
        19,
        [
          [7, 9, "passage"],
          [10, 10, "single"],
        ],
      ],
    ]),
  );
  it("maps every ayah of a passage to the same group", () => {
    expect(lookup.get(100)).toBe(lookup.get(102));
    expect(lookup.get(103)?.text).toBe("single");
  });
  it("shows a passage once, at its first visible ayah", () => {
    expect(tafsirGroupAt(lookup, 100, null)?.text).toBe("passage");
    expect(tafsirGroupAt(lookup, 101, 100)).toBeNull();
    expect(tafsirGroupAt(lookup, 101, null)?.text).toBe("passage"); // scope starts mid-passage
    expect(tafsirGroupAt(lookup, 103, 102)?.text).toBe("single");
  });
});

describe("divisionCards (real data)", () => {
  const raw = import.meta.glob<string>("../../public/data/verses.json", {
    query: "?raw",
    import: "default",
    eager: true,
  });
  const verses = JSON.parse(Object.values(raw)[0]) as Verse[];

  it("covers every ayah once, for juz and manzil", () => {
    for (const [division, n] of [
      ["juz", 30],
      ["manzil", 7],
    ] as const) {
      const cards = divisionCards(verses, division);
      expect(cards.map((c) => c.n)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      expect(cards.reduce((t, c) => t + c.ayahs, 0)).toBe(6236);
      for (const c of cards)
        expect(c.surahs.reduce((t, x) => t + x.ayahs, 0)).toBe(c.ayahs);
    }
  });

  it("knows where the divisions start and end", () => {
    const juz = divisionCards(verses, "juz");
    expect([juz[1].first.s, juz[1].first.a]).toEqual([2, 142]);
    expect([juz[29].last.s, juz[29].last.a]).toEqual([114, 6]);
    const manzil = divisionCards(verses, "manzil");
    expect(manzil.map((m) => m.first.s)).toEqual([1, 5, 10, 17, 26, 37, 50]);
  });
});
