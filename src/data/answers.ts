import type { PosDatum, Verse } from "../types/quran";
import type { SurahDatum } from "./selectors";
import { boxStats } from "./stats";

/**
 * The one-line answers under each dashboard question, as plain facts. The
 * dashboard words them (i18n); everything here is computed from the data in
 * the current range, so the answer always matches the chart above it.
 */

export type LengthMetric = "wordCount" | "letterCount" | "ayahCount" | "avgWords";

/** The surah with the most / fewest of `metric`, and the top one's share. */
export function lengthFacts(data: SurahDatum[], metric: LengthMetric) {
  if (!data.length) return null;
  let top = data[0];
  let bottom = data[0];
  let total = 0;
  for (const d of data) {
    if (d[metric] > top[metric]) top = d;
    if (d[metric] < bottom[metric]) bottom = d;
    total += d[metric];
  }
  return {
    top,
    bottom,
    /** Share of the range (0–1); not meaningful for an average. */
    share: metric === "avgWords" || total === 0 ? null : top[metric] / total,
  };
}

/** Pearson correlation of two equal-length series (0 when undefined). */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  return vx && vy ? cov / Math.sqrt(vx * vy) : 0;
}

/** How closely words follow ayahs, and the surahs with the longest and
 *  shortest ayahs on average (the points furthest from the trend). */
export function correlationFacts(data: SurahDatum[]) {
  if (data.length < 2) return null;
  let dense = data[0];
  let sparse = data[0];
  for (const d of data) {
    if (d.avgWords > dense.avgWords) dense = d;
    if (d.avgWords < sparse.avgWords) sparse = d;
  }
  return {
    r: pearson(
      data.map((d) => d.ayahCount),
      data.map((d) => d.wordCount),
    ),
    dense,
    sparse,
  };
}

/** The most common opening category and how many surahs open that way. */
export function openingFacts(data: SurahDatum[]) {
  if (!data.length) return null;
  const counts = new Map<string, number>();
  for (const d of data) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
  let category = "";
  let count = 0;
  for (const [c, k] of counts)
    if (k > count && c !== "Unknown") {
      category = c;
      count = k;
    }
  return category ? { category, count, total: data.length } : null;
}

/** Median and middle half of ayah lengths, and the single commonest length. */
export function distributionFacts(verses: Verse[]) {
  if (!verses.length) return null;
  const b = boxStats(verses.map((v) => v.w));
  const counts = new Map<number, number>();
  for (const v of verses) counts.set(v.w, (counts.get(v.w) ?? 0) + 1);
  let mode = 0;
  let modeCount = 0;
  for (const [w, k] of counts)
    if (k > modeCount || (k === modeCount && w < mode)) {
      mode = w;
      modeCount = k;
    }
  return {
    median: b.median,
    q1: b.q1,
    q3: b.q3,
    mode,
    modeShare: modeCount / verses.length,
  };
}

/** Within-surah spread of ayah lengths: the widest range, and the highest
 *  median (surahs with at least `minAyahs` ayahs in range). */
export function spreadFacts(verses: Verse[], minAyahs = 3) {
  const grouped = new Map<number, number[]>();
  for (const v of verses) {
    const arr = grouped.get(v.s);
    if (arr) arr.push(v.w);
    else grouped.set(v.s, [v.w]);
  }
  let widest: { s: number; min: number; max: number } | null = null;
  let highest: { s: number; median: number } | null = null;
  for (const [s, ws] of grouped) {
    if (ws.length < minAyahs) continue;
    const b = boxStats(ws);
    if (!widest || b.max - b.min > widest.max - widest.min)
      widest = { s, min: b.min, max: b.max };
    if (!highest || b.median > highest.median) highest = { s, median: b.median };
  }
  return widest && highest ? { widest, highest } : null;
}

/** The longest ayah, and how many ayahs share the shortest length. */
export function extremesFacts(verses: Verse[]) {
  if (!verses.length) return null;
  let longest = verses[0];
  let minW = verses[0].w;
  for (const v of verses) {
    if (v.w > longest.w) longest = v;
    if (v.w < minW) minW = v.w;
  }
  return {
    longest,
    shortestWords: minW,
    shortestCount: verses.filter((v) => v.w === minW).length,
  };
}

/** Per surah: how many of `ids` fall in scope, and the surah with the most. */
export function spreadOverSurahs(ids: number[], inScope: Map<number, Verse>) {
  const per = new Map<number, number>();
  let total = 0;
  for (const id of ids) {
    const v = inScope.get(id);
    if (!v) continue;
    total++;
    per.set(v.s, (per.get(v.s) ?? 0) + 1);
  }
  let top = 0;
  let topCount = 0;
  for (const [s, k] of per)
    if (k > topCount) {
      top = s;
      topCount = k;
    }
  return { total, surahs: per.size, top, topCount };
}

/** The two commonest parts of speech, as shares of all segments. */
export function posFacts(pos: PosDatum[]) {
  if (pos.length < 2) return null;
  const total = pos.reduce((a, p) => a + p.count, 0) || 1;
  const sorted = [...pos].sort((a, b) => b.count - a.count);
  return {
    first: sorted[0],
    firstShare: sorted[0].count / total,
    second: sorted[1],
    secondShare: sorted[1].count / total,
  };
}
