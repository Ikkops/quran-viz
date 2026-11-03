import { describe, expect, it } from "vitest";
import type { RootEntry, SimilarData, Topic, Verse } from "../types/quran";
import { rootSurahCounts, searchRoots, searchTopics, topRootsForSurah } from "./roots";
import { filterSimilar } from "./similar";

const verse = (id: number, s: number): Verse => ({
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
  w: 1,
  l: 1,
  ar: "",
});
const scope = new Map(
  [verse(1, 1), verse(2, 1), verse(3, 2), verse(4, 3)].map((v) => [v.id, v]),
);
const ktb: RootEntry = { ar: "كتب", bw: "ktb", gloss: "write", v: [3, 1, 3, 9] };
const alh: RootEntry = { ar: "اله", bw: "Alh", gloss: "Allah", v: [1, 2, 4] };

describe("rootSurahCounts", () => {
  it("counts repeats per surah and skips ayahs out of scope", () => {
    const c = rootSurahCounts(ktb, scope);
    expect(c.get(1)).toEqual({ count: 1, first: 1 });
    expect(c.get(2)).toEqual({ count: 2, first: 3 });
    expect(c.has(3)).toBe(false); // ayah 9 is not in scope
  });
});

describe("topRootsForSurah", () => {
  it("ranks the roots of one surah by count", () => {
    expect(
      topRootsForSurah([ktb, alh], scope, 1, 5).map((r) => [r.root.bw, r.count]),
    ).toEqual([
      ["Alh", 2],
      ["ktb", 1],
    ]);
  });
});

describe("searchRoots", () => {
  it("matches Arabic with alef variants, Buckwalter and gloss", () => {
    expect(searchRoots([ktb, alh], "أله", 5)).toEqual([alh]);
    expect(searchRoots([ktb, alh], "ktb", 5)).toEqual([ktb]);
    expect(searchRoots([ktb, alh], "WRI", 5)).toEqual([ktb]);
    expect(searchRoots([ktb, alh], "", 1)).toEqual([ktb]);
  });
});

describe("filterSimilar", () => {
  const data: SimilarData = {
    source: "",
    pairs: [
      [1, 3, 80, 4],
      [2, 4, 100, 6],
      [3, 4, 50, 2],
    ],
  };
  const surahOf = (id: number) => scope.get(id)?.s;
  it("applies the score floor and sorts strongest first", () => {
    expect(filterSimilar(data, 60, null, surahOf).map((p) => p.score)).toEqual([100, 80]);
  });
  it("keeps only pairs touching the focused surah", () => {
    expect(filterSimilar(data, 0, 2, surahOf).map((p) => [p.a, p.b])).toEqual([
      [1, 3],
      [3, 4],
    ]);
  });
});

describe("searchTopics", () => {
  const moses: Topic = { id: 1, name: "Moses", ar: "موسى", desc: "", v: [1] };
  const belief: Topic = { id: 2, name: "Belief", ar: "الإيمان", desc: "", v: [2] };
  it("matches English case-insensitively and Arabic with alef variants", () => {
    expect(searchTopics([belief, moses], "mos", 5)).toEqual([moses]);
    expect(searchTopics([belief, moses], "الايمان", 5)).toEqual([belief]);
    expect(searchTopics([belief, moses], " ", 1)).toEqual([belief]);
  });
});
