import type { AsbabData, ThemesData, Verse } from "../types/quran";

/** Summary of one juz or manzil, for the Browse cards. */
export interface DivisionCard {
  n: number;
  first: Verse;
  last: Verse;
  /** Surahs it touches, in order, with how many of their ayahs fall inside. */
  surahs: { s: number; ayahs: number }[];
  ayahs: number;
  words: number;
  pages: [number, number];
  juzs: [number, number];
}

/** One card per juz or manzil, computed from the verses (mushaf order). */
export function divisionCards(
  verses: Verse[],
  division: "juz" | "manzil",
): DivisionCard[] {
  const out = new Map<number, DivisionCard>();
  for (const v of verses) {
    const n = v[division];
    let c = out.get(n);
    if (!c) {
      c = {
        n,
        first: v,
        last: v,
        surahs: [],
        ayahs: 0,
        words: 0,
        pages: [v.page, v.page],
        juzs: [v.juz, v.juz],
      };
      out.set(n, c);
    }
    c.last = v;
    c.ayahs += 1;
    c.words += v.w;
    c.pages = [Math.min(c.pages[0], v.page), Math.max(c.pages[1], v.page)];
    c.juzs = [Math.min(c.juzs[0], v.juz), Math.max(c.juzs[1], v.juz)];
    const tail = c.surahs[c.surahs.length - 1];
    if (tail?.s === v.s) tail.ayahs += 1;
    else c.surahs.push({ s: v.s, ayahs: 1 });
  }
  return [...out.values()].sort((a, b) => a.n - b.n);
}

/** Ayah id -> index into `themes` (-1 where no section theme covers it). */
export function themeIndexById(themes: ThemesData, maxId: number): Int32Array {
  const out = new Int32Array(maxId + 1).fill(-1);
  themes.forEach(([lo, hi], i) => {
    for (let id = lo; id <= hi && id <= maxId; id++) out[id] = i;
  });
  return out;
}

/** The theme heading to show above `id`: when a section starts there, or when
 *  the previous shown verse (`prevId`) lies in another section (or none). */
export function themeHeadingAt(
  themes: ThemesData,
  index: Int32Array,
  id: number,
  prevId: number | null,
): string | null {
  const i = index[id] ?? -1;
  if (i < 0) return null;
  if (prevId !== null && index[prevId] === i) return null;
  return themes[i][2];
}

export interface AsbabEntry {
  first: number;
  last: number;
  texts: string[];
}

/** Asbab entries keyed by the first ayah id of their range. */
export function asbabByFirstAyah(data: AsbabData): Map<number, AsbabEntry[]> {
  const out = new Map<number, AsbabEntry[]>();
  for (const [first, last, texts] of data.items) {
    const list = out.get(first) ?? [];
    list.push({ first, last, texts });
    out.set(first, list);
  }
  return out;
}

/** One passage of a grouped tafsir file: `[fromAyah, toAyah, text]`, ayah
 *  numbers within the surah. Written by the ETL as `tafsir/<ident>/<s>.json`. */
export type GroupedTafsirRow = [number, number, string];

export interface TafsirGroup {
  s: number;
  from: number;
  to: number;
  text: string;
}

/** Ayah id -> the tafsir passage covering it, for the given verses. Every ayah
 *  of one passage maps to the *same* object, so identity marks group edges. */
export function tafsirGroupLookup(
  verses: Verse[],
  bySurah: Map<number, GroupedTafsirRow[]>,
): Map<number, TafsirGroup> {
  const made = new Map<string, TafsirGroup>();
  const out = new Map<number, TafsirGroup>();
  for (const v of verses) {
    const row = bySurah.get(v.s)?.find(([from, to]) => v.a >= from && v.a <= to);
    if (!row) continue;
    const key = `${v.s}:${row[0]}`;
    let g = made.get(key);
    if (!g) {
      g = { s: v.s, from: row[0], to: row[1], text: row[2] };
      made.set(key, g);
    }
    out.set(v.id, g);
  }
  return out;
}

/** The passage to show under `id`: at the first *visible* ayah of a passage,
 *  i.e. where the previous shown verse (`prevId`) is in another passage (or
 *  there is none). A page/juz scope that starts mid-passage still shows it. */
export function tafsirGroupAt(
  lookup: Map<number, TafsirGroup>,
  id: number,
  prevId: number | null,
): TafsirGroup | null {
  const g = lookup.get(id);
  if (!g) return null;
  if (prevId !== null && lookup.get(prevId) === g) return null;
  return g;
}
