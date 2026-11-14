// Find-in-text for the reader's search: every occurrence, as source-string
// ranges, so matches can be highlighted in the text as shown.

import { arabicKeyWithMap, searchKeyArabic } from "./arabic";

/** [start, end) in the source string. */
export type Range = [number, number];

const COMBINING = /[̀-ͯ]/g;

/** Lower-cased, accents dropped, with each folded character's source index. */
function foldWithMap(text: string): { key: string; map: number[] } {
  let key = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = text[i].normalize("NFD").replace(COMBINING, "").toLowerCase();
    for (const c of f) {
      key += c;
      map.push(i);
    }
  }
  return { key, map };
}

export function foldLatin(text: string): string {
  return foldWithMap(text).key;
}

/** Every occurrence of `query` in `text`, ignoring case and accents. */
export function findAllLatin(text: string, query: string): Range[] {
  const q = foldLatin(query.trim());
  if (!q) return [];
  const { key, map } = foldWithMap(text);
  const out: Range[] = [];
  for (let i = key.indexOf(q); i >= 0; i = key.indexOf(q, i + q.length))
    out.push([map[i], map[i + q.length - 1] + 1]);
  return out;
}

const ARABIC_MARK = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;

/** Every occurrence of an Arabic query in Uthmani text, spelling-tolerant
 *  (`searchKeyArabic`), each extended over the marks that follow it. */
export function findAllArabic(text: string, query: string): Range[] {
  const q = searchKeyArabic(query.trim());
  if (!q || !/[ء-ي]/.test(q)) return [];
  const { key, map } = arabicKeyWithMap(text);
  const out: Range[] = [];
  for (let i = key.indexOf(q); i >= 0; i = key.indexOf(q, i + q.length)) {
    let end = map[i + q.length - 1] + 1;
    while (end < text.length && ARABIC_MARK.test(text[end])) end++;
    out.push([map[i], end]);
  }
  return out;
}

/** One match the reader can step to. `field` is "ar" or a translation id. */
export interface TextMatch {
  id: number;
  field: string;
  range: Range | null;
}

/** "2:255" or "255" names an ayah of the scope instead of text. */
export function isAyahRef(q: string, s: number, a: number): boolean {
  const t = q.trim();
  return t === `${s}:${a}` || t === String(a);
}

/** Text split at the given ranges: [text, rangeIndex | -1] pieces. */
export function splitAt(text: string, ranges: Range[]): [string, number][] {
  const out: [string, number][] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a < at) return;
    if (a > at) out.push([text.slice(at, a), -1]);
    out.push([text.slice(a, b), i]);
    at = b;
  });
  if (at < text.length) out.push([text.slice(at), -1]);
  return out;
}
