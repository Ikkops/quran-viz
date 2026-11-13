import type { AsbabData, RootEntry, SimilarData } from "../types/quran";
import type { AsbabEntry } from "./sections";
import type { TopicTree } from "./topics";

/**
 * Per-ayah lookups for the reader's "Konteks ayat" panel. The source files are
 * keyed the other way round (root → ayahs, topic → ayahs, pairs), so each
 * reverse index is built once per loaded dataset and cached by its identity.
 */

const rootIndexCache = new WeakMap<RootEntry[], Map<number, Map<number, number>>>();

/** Ayah id → (root index → occurrences in that ayah). */
function rootIndex(roots: RootEntry[]): Map<number, Map<number, number>> {
  let idx = rootIndexCache.get(roots);
  if (idx) return idx;
  idx = new Map();
  roots.forEach((r, ri) => {
    for (const id of r.v) {
      let m = idx!.get(id);
      if (!m) idx!.set(id, (m = new Map()));
      m.set(ri, (m.get(ri) ?? 0) + 1);
    }
  });
  rootIndexCache.set(roots, idx);
  return idx;
}

export interface AyahRoot {
  root: RootEntry;
  /** Occurrences in this ayah. */
  here: number;
  /** Occurrences in the whole Qur'an. */
  total: number;
}

/** The roots occurring in ayah `id`, rarest first (the telling words lead). */
export function rootsInAyah(roots: RootEntry[], id: number): AyahRoot[] {
  const m = rootIndex(roots).get(id);
  if (!m) return [];
  return [...m.entries()]
    .map(([ri, here]) => ({ root: roots[ri], here, total: roots[ri].v.length }))
    .sort((a, b) => a.total - b.total || a.root.bw.localeCompare(b.root.bw));
}

const topicIndexCache = new WeakMap<TopicTree, Map<number, number[]>>();

/** Topic nodes that tag ayah `id` themselves (not via a descendant), in tree order. */
export function topicsForAyah(tree: TopicTree, id: number): number[] {
  let idx = topicIndexCache.get(tree);
  if (!idx) {
    idx = new Map();
    tree.nodes.forEach((n, i) => {
      for (const a of n.v ?? []) {
        const list = idx!.get(a);
        if (list) list.push(i);
        else idx!.set(a, [i]);
      }
    });
    topicIndexCache.set(tree, idx);
  }
  return idx.get(id) ?? [];
}

export interface SimilarAyah {
  id: number;
  score: number;
  words: number;
}

/** Ayahs paired with `id` in the similar-ayah data, strongest first. */
export function similarTo(data: SimilarData, id: number): SimilarAyah[] {
  const out: SimilarAyah[] = [];
  for (const [a, b, score, words] of data.pairs) {
    if (a === id) out.push({ id: b, score, words });
    else if (b === id) out.push({ id: a, score, words });
  }
  return out.sort((x, y) => y.score - x.score || x.id - y.id);
}

/** Asbab narrations whose ayah range covers `id`. */
export function asbabCovering(data: AsbabData, id: number): AsbabEntry[] {
  const out: AsbabEntry[] = [];
  for (const [first, last, texts] of data.items)
    if (first <= id && id <= last) out.push({ first, last, texts });
  return out;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** 255 → "٢٥٥". */
export function arabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/** The end-of-ayah sign with its number (U+06DD followed by Arabic-Indic
 *  digits); Qur'an fonts draw the digits inside the medallion. */
export function ayahEndMark(n: number): string {
  return `۝${arabicDigits(n)}`;
}
