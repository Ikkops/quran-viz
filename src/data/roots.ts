import type { RootEntry, Verse } from "../types/quran";
import { normalizeArabic } from "./arabic";

/** Occurrences per surah of anything listing ayah ids in `v` (a root's
 *  occurrences, a topic's ayahs), counting only ayahs in `inScope` (ayah id ->
 *  verse). `first` is the first ayah id where it occurs. */
export function rootSurahCounts(
  root: { v: number[] },
  inScope: Map<number, Verse>,
): Map<number, { count: number; first: number }> {
  const out = new Map<number, { count: number; first: number }>();
  for (const id of root.v) {
    const v = inScope.get(id);
    if (!v) continue;
    const r = out.get(v.s);
    if (r) {
      r.count += 1;
      r.first = Math.min(r.first, id);
    } else out.set(v.s, { count: 1, first: id });
  }
  return out;
}

/** The most frequent roots among the ayahs in `inScope`, descending. */
export function topRootsInScope(
  roots: RootEntry[],
  inScope: Set<number>,
  limit: number,
): { root: RootEntry; count: number }[] {
  const out: { root: RootEntry; count: number }[] = [];
  for (const root of roots) {
    let count = 0;
    for (const id of root.v) if (inScope.has(id)) count += 1;
    if (count) out.push({ root, count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** The most frequent roots within one surah, descending. */
export function topRootsForSurah(
  roots: RootEntry[],
  inScope: Map<number, Verse>,
  surah: number,
  limit: number,
): { root: RootEntry; count: number }[] {
  const out: { root: RootEntry; count: number }[] = [];
  for (const root of roots) {
    let count = 0;
    for (const id of root.v) if (inScope.get(id)?.s === surah) count += 1;
    if (count) out.push({ root, count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Roots matching a query on Arabic letters (alef-normalised), Buckwalter, or
 *  gloss. `roots` is frequency-sorted, so matches keep that order. */
export function searchRoots(
  roots: RootEntry[],
  query: string,
  limit: number,
): RootEntry[] {
  const q = query.trim();
  if (!q) return roots.slice(0, limit);
  const ar = normalizeArabic(q).replace(/\s+/g, "");
  const lower = q.toLowerCase();
  const out: RootEntry[] = [];
  for (const r of roots) {
    if (
      (ar && normalizeArabic(r.ar).includes(ar)) ||
      r.bw === q ||
      r.bw.toLowerCase().startsWith(lower) ||
      r.gloss.toLowerCase().includes(lower)
    ) {
      out.push(r);
      if (out.length >= limit) break;
    }
  }
  return out;
}
