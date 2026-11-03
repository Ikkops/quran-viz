import type { SimilarData } from "../types/quran";

export interface SimilarPair {
  a: number;
  b: number;
  score: number;
  words: number;
}

/** Pairs at or above `minScore`, optionally only those touching `surah`
 *  (`surahOf` maps ayah id -> surah). Strongest first. */
export function filterSimilar(
  data: SimilarData,
  minScore: number,
  surah: number | null,
  surahOf: (id: number) => number | undefined,
): SimilarPair[] {
  const out: SimilarPair[] = [];
  for (const [a, b, score, words] of data.pairs) {
    if (score < minScore) continue;
    if (surah !== null && surahOf(a) !== surah && surahOf(b) !== surah) continue;
    out.push({ a, b, score, words });
  }
  return out.sort((x, y) => y.score - x.score || x.a - y.a);
}
