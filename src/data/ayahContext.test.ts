import { describe, expect, it } from "vitest";
import type { RootEntry, SimilarData, TopicNode } from "../types/quran";
import {
  arabicDigits,
  asbabCovering,
  ayahEndMark,
  rootsInAyah,
  similarTo,
  topicsForAyah,
} from "./ayahContext";
import { buildTopicTree } from "./topics";

const roots: RootEntry[] = [
  { ar: "اله", bw: "Alh", gloss: "Allah", v: [1, 2, 2, 3] },
  { ar: "رحم", bw: "rHm", gloss: "mercy", v: [1, 1, 3] },
  { ar: "حمد", bw: "Hmd", gloss: "praise", v: [2] },
];

describe("rootsInAyah", () => {
  it("lists each root once with its count in the ayah, rarest first", () => {
    expect(rootsInAyah(roots, 1).map((r) => [r.root.bw, r.here, r.total])).toEqual([
      ["rHm", 2, 3],
      ["Alh", 1, 4],
    ]);
    expect(rootsInAyah(roots, 2).map((r) => r.root.bw)).toEqual(["Hmd", "Alh"]);
  });

  it("returns nothing for an ayah without roots", () => {
    expect(rootsInAyah(roots, 99)).toEqual([]);
  });
});

describe("topicsForAyah", () => {
  const nodes: TopicNode[] = [
    { k: "a", en: "A", id: "A", p: -1 },
    { k: "a.b", en: "B", id: "B", p: 0, v: [5, 6] },
    { k: "c", en: "C", id: "C", p: -1, v: [6] },
  ];
  it("finds the nodes tagging the ayah themselves", () => {
    const tree = buildTopicTree(nodes);
    expect(topicsForAyah(tree, 6)).toEqual([1, 2]);
    expect(topicsForAyah(tree, 5)).toEqual([1]);
    expect(topicsForAyah(tree, 1)).toEqual([]);
  });
});

describe("similarTo", () => {
  const data: SimilarData = {
    source: "test",
    pairs: [
      [1, 3, 80, 2],
      [1, 9, 95, 4],
      [2, 3, 50, 2],
    ],
  };
  it("returns partners from either side of a pair, strongest first", () => {
    expect(similarTo(data, 1).map((s) => s.id)).toEqual([9, 3]);
    expect(similarTo(data, 3)).toEqual([
      { id: 1, score: 80, words: 2 },
      { id: 2, score: 50, words: 2 },
    ]);
  });
});

describe("asbabCovering", () => {
  it("keeps narrations whose range covers the ayah", () => {
    const data = {
      source: "t",
      items: [
        [10, 12, ["x"]],
        [11, 11, ["y"]],
        [20, 20, ["z"]],
      ] as [number, number, string[]][],
    };
    expect(asbabCovering(data, 11).map((e) => e.texts[0])).toEqual(["x", "y"]);
    expect(asbabCovering(data, 13)).toEqual([]);
  });
});

describe("ayah end mark", () => {
  it("uses Arabic-Indic digits after U+06DD", () => {
    expect(arabicDigits(255)).toBe("٢٥٥");
    expect(ayahEndMark(7)).toBe("۝٧");
  });
});
