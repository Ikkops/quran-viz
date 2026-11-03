import type { RevelationType, Surah, Verse } from "../types/quran";
import { categorizeOpening } from "./fawatih";

export type SortKey = "quran" | "verses" | "words" | "letters";
export type FilterMode = "all" | "surah" | "juz";

export interface FilterState {
  mode: FilterMode;
  surahRange: [number, number];
  juzRange: [number, number];
  sort: SortKey;
}

export const DEFAULT_FILTER: FilterState = {
  mode: "all",
  surahRange: [1, 114],
  juzRange: [1, 30],
  sort: "quran",
};

export function filterVerses(verses: Verse[], f: FilterState): Verse[] {
  if (f.mode === "surah") {
    const [lo, hi] = f.surahRange;
    return verses.filter((v) => v.s >= lo && v.s <= hi);
  }
  if (f.mode === "juz") {
    const [lo, hi] = f.juzRange;
    return verses.filter((v) => v.juz >= lo && v.juz <= hi);
  }
  return verses;
}

export interface SurahDatum {
  id: number;
  name: string;
  nameAr: string;
  meaning: string;
  type: RevelationType;
  ayahCount: number;
  wordCount: number;
  letterCount: number;
  avgWords: number;
  category: string;
}

/**
 * Aggregates filtered verses back up to per-surah data and sorts it.
 * Using the *filtered* verses means juz-range filtering correctly reflects
 * partial surahs.
 */
export function aggregateBySurah(
  verses: Verse[],
  surahMap: Map<number, Surah>,
  sort: SortKey,
): SurahDatum[] {
  const acc = new Map<number, { w: number; l: number; v: number }>();
  for (const verse of verses) {
    const a = acc.get(verse.s) ?? { w: 0, l: 0, v: 0 };
    a.w += verse.w;
    a.l += verse.l;
    a.v += 1;
    acc.set(verse.s, a);
  }
  const out: SurahDatum[] = [];
  for (const [id, a] of acc) {
    const s = surahMap.get(id)!;
    out.push({
      id,
      name: s.nameEn,
      nameAr: s.nameAr,
      meaning: s.meaning,
      type: s.type,
      ayahCount: a.v,
      wordCount: a.w,
      letterCount: a.l,
      avgWords: a.v ? a.w / a.v : 0,
      category: categorizeOpening(id),
    });
  }
  switch (sort) {
    case "verses":
      out.sort((x, y) => y.ayahCount - x.ayahCount);
      break;
    case "words":
      out.sort((x, y) => y.wordCount - x.wordCount);
      break;
    case "letters":
      out.sort((x, y) => y.letterCount - x.letterCount);
      break;
    default:
      out.sort((x, y) => x.id - y.id);
  }
  return out;
}

export function surahMapOf(surahs: Surah[]): Map<number, Surah> {
  return new Map(surahs.map((s) => [s.id, s]));
}
