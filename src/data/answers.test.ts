import { describe, expect, it } from "vitest";
import type { Verse } from "../types/quran";
import type { SurahDatum } from "./selectors";
import {
  correlationFacts,
  distributionFacts,
  extremesFacts,
  lengthFacts,
  openingFacts,
  pearson,
  posFacts,
  spreadFacts,
  spreadOverSurahs,
} from "./answers";

const verse = (id: number, s: number, w: number): Verse => ({
  id,
  s,
  a: id,
  juz: 1,
  hizb: 1,
  rub: 1,
  ruku: 1,
  manzil: 1,
  page: 1,
  sajda: 0,
  w,
  l: w * 4,
  ar: "",
});

const datum = (id: number, ayahs: number, words: number, category = "X"): SurahDatum =>
  ({
    id,
    name: `S${id}`,
    ayahCount: ayahs,
    wordCount: words,
    letterCount: words * 4,
    avgWords: words / ayahs,
    category,
  }) as SurahDatum;

describe("answers", () => {
  it("finds the longest and shortest surah and the top share", () => {
    const f = lengthFacts(
      [datum(1, 7, 30), datum(2, 286, 6000), datum(3, 3, 10)],
      "wordCount",
    );
    expect(f?.top.id).toBe(2);
    expect(f?.bottom.id).toBe(3);
    expect(f?.share).toBeCloseTo(6000 / 6040);
    expect(lengthFacts([datum(1, 2, 4)], "avgWords")?.share).toBeNull();
    expect(lengthFacts([], "wordCount")).toBeNull();
  });

  it("computes a Pearson correlation", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it("names the densest and sparsest surahs", () => {
    const f = correlationFacts([datum(1, 10, 100), datum(2, 10, 20), datum(3, 10, 50)]);
    expect(f?.dense.id).toBe(1);
    expect(f?.sparse.id).toBe(2);
  });

  it("counts the commonest opening, ignoring Unknown", () => {
    const f = openingFacts([
      datum(1, 1, 1, "Unknown"),
      datum(2, 1, 1, "Unknown"),
      datum(3, 1, 1, "Oath"),
    ]);
    expect(f).toEqual({ category: "Oath", count: 1, total: 3 });
  });

  it("summarises ayah lengths", () => {
    const vs = [3, 3, 5, 7, 9].map((w, i) => verse(i + 1, 1, w));
    const f = distributionFacts(vs);
    expect(f?.median).toBe(5);
    expect(f?.mode).toBe(3);
    expect(f?.modeShare).toBeCloseTo(0.4);
  });

  it("finds the widest spread and highest median", () => {
    const vs = [
      ...[1, 2, 30].map((w, i) => verse(i + 1, 1, w)),
      ...[10, 11, 12].map((w, i) => verse(i + 4, 2, w)),
      verse(7, 3, 100), // too few ayahs to count
    ];
    const f = spreadFacts(vs);
    expect(f?.widest).toEqual({ s: 1, min: 1, max: 30 });
    expect(f?.highest).toEqual({ s: 2, median: 11 });
  });

  it("finds the longest ayah and the shortest length's count", () => {
    const f = extremesFacts([verse(1, 1, 2), verse(2, 1, 9), verse(3, 2, 2)]);
    expect(f?.longest.id).toBe(2);
    expect(f).toMatchObject({ shortestWords: 2, shortestCount: 2 });
  });

  it("spreads ids over surahs within scope", () => {
    const scope = new Map(
      [verse(1, 1, 1), verse(2, 2, 1), verse(3, 2, 1)].map((v) => [v.id, v]),
    );
    expect(spreadOverSurahs([1, 2, 3, 99], scope)).toEqual({
      total: 3,
      surahs: 2,
      top: 2,
      topCount: 2,
    });
  });

  it("gives the two commonest parts of speech", () => {
    const f = posFacts([
      { tag: "V", label: "Verb", count: 30 },
      { tag: "N", label: "Noun", count: 60 },
      { tag: "P", label: "Prep", count: 10 },
    ]);
    expect(f?.first.tag).toBe("N");
    expect(f?.firstShare).toBeCloseTo(0.6);
    expect(f?.second.tag).toBe("V");
  });
});
