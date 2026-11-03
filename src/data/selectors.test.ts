import { describe, expect, it } from "vitest";
import {
  aggregateBySurah,
  filterVerses,
  surahMapOf,
  DEFAULT_FILTER,
  type FilterState,
} from "./selectors";
import type { Surah, Verse } from "../types/quran";

const surahs: Surah[] = [
  {
    id: 1,
    number: 1,
    nameAr: "الفاتحة",
    nameEn: "Al-Fatiha",
    meaning: "The Opening",
    type: "Meccan",
    ayahCount: 7,
    wordCount: 25,
    letterCount: 113,
    sajdaCount: 0,
    firstPage: 1,
    lastPage: 1,
    firstJuz: 1,
    lastJuz: 1,
    hasBismillah: false,
  },
  {
    id: 2,
    number: 2,
    nameAr: "البقرة",
    nameEn: "Al-Baqarah",
    meaning: "The Cow",
    type: "Medinan",
    ayahCount: 286,
    wordCount: 6000,
    letterCount: 26000,
    sajdaCount: 0,
    firstPage: 2,
    lastPage: 49,
    firstJuz: 1,
    lastJuz: 3,
    hasBismillah: true,
  },
  {
    id: 3,
    number: 3,
    nameAr: "آل عمران",
    nameEn: "Aal-i-Imraan",
    meaning: "The Family of Imraan",
    type: "Medinan",
    ayahCount: 200,
    wordCount: 3500,
    letterCount: 14000,
    sajdaCount: 0,
    firstPage: 50,
    lastPage: 76,
    firstJuz: 3,
    lastJuz: 4,
    hasBismillah: true,
  },
];

function v(id: number, s: number, w: number, l: number, juz = 1): Verse {
  return {
    id,
    s,
    a: id,
    juz,
    hizb: 1,
    rub: 1,
    ruku: 1,
    manzil: 1,
    page: 1,
    sajda: 0,
    w,
    l,
    ar: "",
  };
}

const verses: Verse[] = [
  v(1, 1, 4, 19, 1),
  v(2, 1, 4, 14, 1),
  v(3, 2, 1, 3, 1),
  v(4, 2, 1, 3, 2),
  v(5, 3, 1, 3, 3),
];

const surahMap = surahMapOf(surahs);

describe("filterVerses", () => {
  it("returns all verses in 'all' mode", () => {
    expect(filterVerses(verses, DEFAULT_FILTER)).toHaveLength(5);
  });

  it("filters by surah range", () => {
    const f: FilterState = { ...DEFAULT_FILTER, mode: "surah", surahRange: [2, 2] };
    expect(filterVerses(verses, f)).toEqual([verses[2], verses[3]]);
  });

  it("filters by juz range", () => {
    const f: FilterState = { ...DEFAULT_FILTER, mode: "juz", juzRange: [2, 3] };
    expect(filterVerses(verses, f)).toEqual([verses[3], verses[4]]);
  });
});

describe("aggregateBySurah", () => {
  it("sums per-surah counts from filtered verses", () => {
    const data = aggregateBySurah(verses, surahMap, "quran");
    const baqarah = data.find((d) => d.id === 2);
    expect(baqarah?.ayahCount).toBe(2);
    expect(baqarah?.wordCount).toBe(2);
    expect(baqarah?.avgWords).toBe(1);
  });

  it("sorts by verses descending", () => {
    const data = aggregateBySurah(verses, surahMap, "verses");
    expect(data[0].ayahCount).toBeGreaterThanOrEqual(data[1].ayahCount);
  });

  it("sorts by id (quran order) by default", () => {
    const data = aggregateBySurah(verses, surahMap, "quran");
    expect(data.map((d) => d.id)).toEqual([1, 2, 3]);
  });

  it("attaches the fawatih category", () => {
    const data = aggregateBySurah(verses, surahMap, "quran");
    expect(data.find((d) => d.id === 2)?.category).toBe("Muqatta'at");
  });
});

describe("surahMapOf", () => {
  it("maps by surah id", () => {
    const m = surahMapOf(surahs);
    expect(m.get(2)?.nameEn).toBe("Al-Baqarah");
    expect(m.has(999)).toBe(false);
  });
});
