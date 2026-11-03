import type { AsbabData, ThemesData } from "../types/quran";

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
