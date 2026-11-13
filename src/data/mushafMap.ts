import type { Verse } from "../types/quran";

/**
 * Geometry for the Peta Mushaf: every ayah as a sliver in mushaf order, one row
 * per juz, each sliver as wide as its text (letters). Juz are near-equal
 * divisions of the text, so the rows come out near-equal and their ragged ends
 * are the real differences. Positions are fractions of the longest row.
 */
export interface MapRow {
  /** Juz number (1-based). */
  n: number;
  first: number;
  last: number;
  /** Row length as a fraction of the longest row. */
  length: number;
}

export interface MapLayout {
  rows: MapRow[];
  /** Per ayah id (index 0 unused): row index, start and end (0–1). */
  row: Uint8Array;
  x0: Float64Array;
  x1: Float64Array;
}

const weight = (v: Verse) => Math.max(1, v.l);

/** Lay `verses` (mushaf order, ids 1..n) out in rows of `rowOf(v)`. */
export function buildMapLayout(
  verses: Verse[],
  rowOf: (v: Verse) => number = (v) => v.juz,
): MapLayout {
  const n = verses.length;
  const row = new Uint8Array(n + 1);
  const x0 = new Float64Array(n + 1);
  const x1 = new Float64Array(n + 1);
  const rows: MapRow[] = [];
  const totals: number[] = [];
  for (const v of verses) {
    const r = rowOf(v);
    let cur = rows[rows.length - 1];
    if (!cur || cur.n !== r) {
      cur = { n: r, first: v.id, last: v.id, length: 0 };
      rows.push(cur);
      totals.push(0);
    }
    const i = rows.length - 1;
    cur.last = v.id;
    row[v.id] = i;
    x0[v.id] = totals[i];
    totals[i] += weight(v);
    x1[v.id] = totals[i];
  }
  const max = Math.max(1, ...totals);
  rows.forEach((r, i) => (r.length = totals[i] / max));
  for (let id = 1; id <= n; id++) {
    x0[id] /= max;
    x1[id] /= max;
  }
  return { rows, row, x0, x1 };
}

/** The ayah under fraction `x` of row `r` (nearest at the ends), by bisection. */
export function ayahAt(layout: MapLayout, r: number, x: number): number {
  const row = layout.rows[r];
  if (!row) return 0;
  let lo = row.first;
  let hi = row.last;
  if (x <= layout.x0[lo]) return lo;
  if (x >= layout.x1[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (layout.x1[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The ayah one row up or down from `id`, at the same horizontal position. */
export function ayahInNextRow(layout: MapLayout, id: number, dir: 1 | -1): number {
  const r = layout.row[id] + dir;
  if (r < 0 || r >= layout.rows.length) return id;
  return ayahAt(layout, r, (layout.x0[id] + layout.x1[id]) / 2);
}

/** Share of the reveal each surah spends fading in (the rest staggers them). */
export const REVEAL_FADE = 0.12;

/**
 * When each ayah starts to appear in the map's opening reveal, as a fraction of
 * the reveal (index = ayah id): surahs in revelation order, so the map fills
 * from Al-ʿAlaq in juz 30 to the late Madinan surahs near the top, then stands
 * in mushaf order. Surahs without a known order go last.
 */
export function revealStarts(
  verses: Verse[],
  revelationOrder: (surah: number) => number | undefined,
): Float32Array {
  const starts = new Float32Array(verses.length + 1);
  const span = 1 - REVEAL_FADE;
  for (const v of verses) {
    const order = revelationOrder(v.s) ?? 114;
    starts[v.id] = ((Math.min(114, Math.max(1, order)) - 1) / 113) * span;
  }
  return starts;
}

/** Opacity of an ayah that starts at `start`, at reveal progress `p` (0–1). */
export function revealAlpha(start: number, p: number): number {
  return Math.min(1, Math.max(0, (p - start) / REVEAL_FADE));
}
