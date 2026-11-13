import { describe, expect, it } from "vitest";
import { recordRead, sanitizeLastRead, type ReadStretch } from "./lastRead";

describe("recordRead", () => {
  it("moves the newest entry along while reading on", () => {
    let list: ReadStretch[] = [];
    for (let id = 8; id <= 37; id++) list = recordRead(list, id, 2, id);
    expect(list).toEqual([{ id: 37, s: 2, at: 37 }]);
  });

  it("starts a new entry in another surah and keeps the old one", () => {
    let list = recordRead([], 30, 2, 1);
    list = recordRead(list, 2141, 18, 2);
    expect(list.map((e) => e.id)).toEqual([2141, 30]);
  });

  it("keeps one entry per surah, even after a far jump inside it", () => {
    let list = recordRead([], 30, 2, 1);
    list = recordRead(list, 2141, 18, 2);
    list = recordRead(list, 262, 2, 3);
    expect(list.map((e) => e.id)).toEqual([262, 2141]);
    // A jump beyond reach within the newest surah replaces it too.
    list = recordRead(list, 100, 2, 4);
    expect(list.map((e) => e.id)).toEqual([100, 2141]);
  });

  it("ignores the same ayah and caps the list at ten", () => {
    let list = recordRead([], 1, 1, 1);
    expect(recordRead(list, 1, 1, 2)).toBe(list);
    const firstAyah = [1, 8, 294, 494, 670, 790, 955, 1161, 1236, 1365, 1474, 1597];
    firstAyah.forEach((id, i) => (list = recordRead(list, id, i + 1, i)));
    expect(list).toHaveLength(10);
    expect(list[0].s).toBe(12);
  });
});

describe("sanitizeLastRead", () => {
  it("drops junk and repeated surahs", () => {
    expect(sanitizeLastRead("x")).toBeUndefined();
    expect(
      sanitizeLastRead([{ id: 5, s: 1, at: 1 }, { id: 6, s: 1 }, { id: 0, s: 2 }, null]),
    ).toEqual([{ id: 5, s: 1, at: 1 }]);
  });
});
