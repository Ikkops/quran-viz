import { describe, expect, it } from "vitest";
import type { Surah } from "../types/quran";
import { parseVerseRef } from "./refs";

const surahMap = new Map([[2, { id: 2, ayahCount: 286 } as Surah]]);

describe("parseVerseRef", () => {
  it("accepts colon, space and dot separators", () => {
    expect(parseVerseRef("2:255", surahMap)).toEqual({ s: 2, a: 255 });
    expect(parseVerseRef(" 2 255 ", surahMap)).toEqual({ s: 2, a: 255 });
    expect(parseVerseRef("2.255", surahMap)).toEqual({ s: 2, a: 255 });
  });
  it("rejects verses that don't exist and non-references", () => {
    expect(parseVerseRef("2:287", surahMap)).toBeNull();
    expect(parseVerseRef("3:1", surahMap)).toBeNull();
    expect(parseVerseRef("الله", surahMap)).toBeNull();
  });
});
