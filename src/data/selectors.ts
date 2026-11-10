import type { AyahPlace, RevelationType, Surah, Verse } from "../types/quran";
import { categorizeOpening } from "./fawatih";

export type SortKey = "quran" | "revelation" | "verses" | "words" | "letters";

export const SORT_LABELS: Record<SortKey, string> = {
  quran: "Mushaf order",
  revelation: "Revelation order",
  verses: "Verse count",
  words: "Word count",
  letters: "Letter count",
};

/** Where an ayah was revealed: its own (traditional) place when it is a
 *  mushaf-header exception, otherwise its surah's classification. */
export function ayahPlace(v: Verse, surahMap: Map<number, Surah>): AyahPlace {
  return v.p ?? surahMap.get(v.s)?.type ?? "Meccan";
}

/** An ayah (number within its surah) whose place differs from its surah's. */
export interface PlaceException {
  a: number;
  p: AyahPlace;
}

/** Surah id -> its exception ayahs, in ayah order. */
export function exceptionsBySurah(verses: Verse[]): Map<number, PlaceException[]> {
  const out = new Map<number, PlaceException[]>();
  for (const v of verses)
    if (v.p) out.set(v.s, [...(out.get(v.s) ?? []), { a: v.a, p: v.p }]);
  return out;
}

/** Per-place totals for one metric. */
export type PlaceSplit = Record<AyahPlace, number>;
const emptySplit = (): PlaceSplit => ({ Meccan: 0, Medinan: 0, Hijra: 0 });
export type FilterMode = "all" | "surah" | "juz";
/** Keep only ayahs revealed in one place (ayah-level, see `ayahPlace`). */
export type PlaceFilter = "all" | RevelationType;

export interface FilterState {
  mode: FilterMode;
  surahRange: [number, number];
  juzRange: [number, number];
  sort: SortKey;
  /** Optional for filters stored before it existed; missing = "all". */
  place?: PlaceFilter;
}

export const DEFAULT_FILTER: FilterState = {
  mode: "all",
  surahRange: [1, 114],
  juzRange: [1, 30],
  sort: "quran",
  place: "all",
};

/** Sanitizer for a stored filter: fills fields added since it was saved and
 *  rejects malformed ones. */
export function sanitizeFilter(raw: unknown): FilterState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const f = { ...DEFAULT_FILTER, ...(raw as Partial<FilterState>) };
  const pair = (x: unknown) =>
    Array.isArray(x) && x.length === 2 && x.every((n) => typeof n === "number");
  if (!["all", "surah", "juz"].includes(f.mode)) return undefined;
  if (!pair(f.surahRange) || !pair(f.juzRange)) return undefined;
  if (!(f.sort in SORT_LABELS)) f.sort = "quran";
  if (!["all", "Meccan", "Medinan"].includes(f.place ?? "all")) f.place = "all";
  return f;
}

export function filterVerses(
  verses: Verse[],
  f: FilterState,
  surahMap?: Map<number, Surah>,
): Verse[] {
  let out = verses;
  if (f.mode === "surah") {
    const [lo, hi] = f.surahRange;
    out = out.filter((v) => v.s >= lo && v.s <= hi);
  } else if (f.mode === "juz") {
    const [lo, hi] = f.juzRange;
    out = out.filter((v) => v.juz >= lo && v.juz <= hi);
  }
  const place = f.place ?? "all";
  if (place !== "all" && surahMap)
    out = out.filter((v) => ayahPlace(v, surahMap) === place);
  return out;
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
  revelationOrder: number;
  /** Words / letters / verses split by ayah place (sums equal the totals). */
  split: { w: PlaceSplit; l: PlaceSplit; v: PlaceSplit };
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
  type Acc = { w: number; l: number; v: number; split: SurahDatum["split"] };
  const acc = new Map<number, Acc>();
  for (const verse of verses) {
    let a = acc.get(verse.s);
    if (!a) {
      a = {
        w: 0,
        l: 0,
        v: 0,
        split: { w: emptySplit(), l: emptySplit(), v: emptySplit() },
      };
      acc.set(verse.s, a);
    }
    a.w += verse.w;
    a.l += verse.l;
    a.v += 1;
    const p = ayahPlace(verse, surahMap);
    a.split.w[p] += verse.w;
    a.split.l[p] += verse.l;
    a.split.v[p] += 1;
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
      revelationOrder: s.revelationOrder,
      split: a.split,
    });
  }
  switch (sort) {
    case "revelation":
      out.sort((x, y) => x.revelationOrder - y.revelationOrder);
      break;
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
