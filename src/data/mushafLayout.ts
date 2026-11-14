// Printed mushaf layouts (`mushaf/<id>.json`, built by scripts/reader_data.py
// from quran.com's per-word line numbers): which words sit on which line of
// which page, so the reader's mushaf mode breaks lines as the print does.

import type { Verse } from "../types/quran";
import { useLazyJson } from "./useLazyJson";

/** [ayah id, first word (1-based)] | ["s", surah] | ["sb", surah] (name and
 *  basmala on one line) | ["b"] | [] */
export type LayoutLine = [number, number] | ["s", number] | ["sb", number] | ["b"] | [];

export interface MushafLayout {
  pages: number;
  lines: number;
  page: LayoutLine[][];
}

export function useMushafLayout(id: string | null) {
  return useLazyJson<MushafLayout>(`mushaf/${id ?? "none"}.json`, !!id);
}

/** A token of pause marks or signs only (U+0600–0605, U+0615–061A,
 *  U+06D6–06ED). */
function isMarkToken(tok: string): boolean {
  for (const c of tok) {
    const n = c.codePointAt(0)!;
    if (
      !(
        (n >= 0x600 && n <= 0x605) ||
        (n >= 0x615 && n <= 0x61a) ||
        (n >= 0x6d6 && n <= 0x6ed)
      )
    )
      return false;
  }
  return tok.length > 0;
}

/** An ayah's words: pause marks join the word before them, a leading sign
 *  (۞) the word after. MIRRORS scripts/reader_data.py:split_words. */
export function splitWords(ar: string): string[] {
  const words: string[] = [];
  let lead = "";
  for (const tok of ar.split(/\s+/).filter(Boolean)) {
    if (isMarkToken(tok)) {
      if (words.length) words[words.length - 1] += " " + tok;
      else lead += tok + " ";
    } else {
      words.push(lead + tok);
      lead = "";
    }
  }
  return words;
}

/** One line of a page as the reader draws it. */
export type PageLine =
  | { kind: "words"; words: { id: number; w: number }[] }
  | { kind: "name"; surah: number; basmala?: boolean }
  | { kind: "basmala" }
  | { kind: "blank" };

const isWordLine = (l: LayoutLine): l is [number, number] =>
  l.length === 2 && typeof l[0] === "number";

/** The first word line at or after page `p` (0-based), for a line's end. */
function nextStart(
  layout: MushafLayout,
  p: number,
  from: number,
): [number, number] | null {
  for (let i = p; i < layout.page.length; i++) {
    const lines = layout.page[i];
    for (let j = i === p ? from : 0; j < lines.length; j++) {
      const l = lines[j];
      if (isWordLine(l)) return l;
    }
  }
  return null;
}

/** Page `p` (1-based) as lines of words. `wordCount(id)` is the ayah's
 *  number of words (`splitWords`). */
export function pageLines(
  layout: MushafLayout,
  p: number,
  wordCount: (id: number) => number,
  lastId: number,
): PageLine[] {
  const lines = layout.page[p - 1] ?? [];
  return lines.map((l, j): PageLine => {
    if (!isWordLine(l)) {
      if (l[0] === "s") return { kind: "name", surah: l[1] as number };
      if (l[0] === "sb") return { kind: "name", surah: l[1] as number, basmala: true };
      if (l[0] === "b") return { kind: "basmala" };
      return { kind: "blank" };
    }
    const end = nextStart(layout, p - 1, j + 1) ?? [lastId + 1, 1];
    const words: { id: number; w: number }[] = [];
    let [id, w] = l;
    while (id < end[0] || (id === end[0] && w < end[1])) {
      if (w > wordCount(id)) {
        id += 1;
        w = 1;
        continue;
      }
      words.push({ id, w });
      w += 1;
    }
    return { kind: "words", words };
  });
}

/** Pages (1-based) that hold any of the ayahs `from`..`to` (ids). */
export function pagesFor(layout: MushafLayout, from: number, to: number): number[] {
  const out: number[] = [];
  for (let p = 0; p < layout.page.length; p++) {
    const ids: number[] = [];
    for (const l of layout.page[p]) if (isWordLine(l)) ids.push(l[0]);
    // The page's last line may run into the next ayah: it ends where the
    // next page starts.
    const next = nextStart(layout, p + 1, 0);
    if (!ids.length) continue;
    const lo = ids[0];
    const hi = next ? (next[1] > 1 ? next[0] : next[0] - 1) : ids[ids.length - 1];
    if (hi >= from && lo <= to) out.push(p + 1);
  }
  return out;
}

/** The page (1-based) of ayah `id`'s first word. */
export function pageOf(layout: MushafLayout, id: number): number {
  let found = 1;
  for (let p = 0; p < layout.page.length; p++)
    for (const l of layout.page[p])
      if (isWordLine(l)) {
        // The last line starting at or before (id, word 1) holds that word.
        if (l[0] > id || (l[0] === id && l[1] > 1)) return found;
        found = p + 1;
      }
  return found;
}

/** Word counts per ayah id, computed once per verse list. */
export function wordCounter(verses: Verse[]): (id: number) => number {
  const cache = new Map<number, number>();
  return (id) => {
    let n = cache.get(id);
    if (n === undefined) {
      n = verses[id - 1] ? splitWords(verses[id - 1].ar).length : 0;
      cache.set(id, n);
    }
    return n;
  };
}
