import type { EnrichedVerse, Verse } from "../types/quran";

/**
 * Adds cumulative running totals to each verse:
 *  - global word/verse/letter progress through the whole Quran
 *  - per-juz word/verse/letter progress (resets at each juz boundary)
 * Assumes `verses` is ordered by global ayah id.
 */
export function enrichVerses(verses: Verse[]): EnrichedVerse[] {
  let gW = 0;
  let gV = 0;
  let gL = 0;
  let curJuz = -1;
  let jW = 0;
  let jV = 0;
  let jL = 0;
  const out: EnrichedVerse[] = [];
  for (const v of verses) {
    if (v.juz !== curJuz) {
      curJuz = v.juz;
      jW = 0;
      jV = 0;
      jL = 0;
    }
    gW += v.w;
    gV += 1;
    gL += v.l;
    jW += v.w;
    jV += 1;
    jL += v.l;
    out.push({
      ...v,
      cumulGlobalW: gW,
      cumulGlobalV: gV,
      cumulGlobalL: gL,
      cumulJuzW: jW,
      cumulJuzV: jV,
      cumulJuzL: jL,
    });
  }
  return out;
}
