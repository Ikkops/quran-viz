import type { Surah } from "../types/quran";

/** Parse a verse reference typed in search: `2:255`, `2 255`, `2.255`.
 *  Returns null unless the surah and ayah exist. */
export function parseVerseRef(
  query: string,
  surahMap: Map<number, Surah>,
): { s: number; a: number } | null {
  const m = /^\s*(\d{1,3})\s*[:.\s]\s*(\d{1,3})\s*$/.exec(query);
  if (!m) return null;
  const s = Number(m[1]);
  const a = Number(m[2]);
  const surah = surahMap.get(s);
  if (!surah || a < 1 || a > surah.ayahCount) return null;
  return { s, a };
}
