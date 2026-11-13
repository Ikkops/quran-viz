import { describe, expect, it } from "vitest";
import type { TopicNode, Verse } from "../types/quran";
import {
  buildTopicTree,
  formatRun,
  groupBySurah,
  searchTopicTree,
  topicName,
  topicPath,
} from "./topics";

const NODES: TopicNode[] = [
  { k: "sejarah", en: "Stories & History", id: "Kisah & Sejarah", p: -1 },
  { k: "sejarah.nabi", en: "Stories of the Prophets", id: "Kisah Para Nabi", p: 0 },
  { k: "t20", en: "Moses", id: "Musa", p: 1, ar: "موسى", v: [3, 1] },
  {
    k: "t2338",
    en: "defeats Pharaoh's magicians",
    id: "Mengalahkan penyihir",
    p: 2,
    v: [4, 3],
  },
  { k: "ibadah", en: "Worship", id: "Ibadah", p: -1, v: [9] },
  { k: "t1038", en: "Prayer", id: "Salat", p: 4, ar: "الصلاة", v: [2] },
];

const verse = (id: number, s: number, a: number) => ({ id, s, a }) as Verse;

describe("buildTopicTree", () => {
  const tree = buildTopicTree(NODES);

  it("links children and roots in file order", () => {
    expect(tree.roots).toEqual([0, 4]);
    expect(tree.children[1]).toEqual([2]);
    expect(tree.byKey.get("t1038")).toBe(5);
  });

  it("rolls descendant ayahs up into each node, sorted and unique", () => {
    expect(tree.all[3]).toEqual([3, 4]);
    expect(tree.all[2]).toEqual([1, 3, 4]);
    expect(tree.all[0]).toEqual([1, 3, 4]);
    expect(tree.all[4]).toEqual([2, 9]);
  });

  it("walks the path from the top category", () => {
    expect(topicPath(tree, 3)).toEqual([0, 1, 2, 3]);
    expect(topicPath(tree, 4)).toEqual([4]);
  });
});

describe("topicName", () => {
  it("follows the UI language", () => {
    expect(topicName(NODES[2], "id")).toBe("Musa");
    expect(topicName(NODES[2], "en")).toBe("Moses");
  });
});

describe("searchTopicTree", () => {
  const tree = buildTopicTree(NODES);

  it("matches Indonesian and English names, prefix first", () => {
    expect(searchTopicTree(tree, "musa", 5)).toEqual([2]);
    expect(searchTopicTree(tree, "MOSES", 5)).toEqual([2]);
    expect(searchTopicTree(tree, "sal", 5)).toEqual([5]);
  });

  it("matches word starts and Arabic without diacritics", () => {
    expect(searchTopicTree(tree, "penyihir", 5)).toEqual([3]);
    expect(searchTopicTree(tree, "الصلاة", 5)).toEqual([5]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchTopicTree(tree, "  ", 5)).toEqual([]);
  });
});

describe("groupBySurah", () => {
  const byId = new Map(
    [
      verse(1, 2, 30),
      verse(2, 2, 31),
      verse(3, 2, 32),
      verse(4, 2, 40),
      verse(5, 7, 11),
    ].map((v) => [v.id, v]),
  );

  it("folds consecutive ayahs into runs per surah", () => {
    expect(groupBySurah([1, 2, 3, 4, 5], byId)).toEqual([
      {
        s: 2,
        runs: [
          [30, 32, 1],
          [40, 40, 4],
        ],
        count: 4,
      },
      { s: 7, runs: [[11, 11, 5]], count: 1 },
    ]);
  });

  it("skips ayahs outside the scope", () => {
    expect(groupBySurah([4, 99], byId)).toEqual([
      { s: 2, runs: [[40, 40, 4]], count: 1 },
    ]);
  });

  it("formats a run", () => {
    expect(formatRun([30, 32, 1])).toBe("30–32");
    expect(formatRun([40, 40, 4])).toBe("40");
  });
});
