// Statistical helpers for the distribution / box-plot / histogram charts.

export interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function boxStats(values: number[]): BoxStats {
  if (values.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
  };
}

export interface HistogramBucket {
  label: string;
  range: [number, number];
  count: number;
}

export function histogram(values: number[], bucketSize: number): HistogramBucket[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const bucketCount = Math.ceil((max + 1) / bucketSize);
  const buckets: HistogramBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const lo = i * bucketSize + 1;
    const hi = (i + 1) * bucketSize;
    return { label: `${lo}-${hi}`, range: [lo, hi] as [number, number], count: 0 };
  });
  for (const v of values) {
    const idx = Math.min(Math.floor((v - 1) / bucketSize), bucketCount - 1);
    if (idx >= 0) buckets[idx].count++;
  }
  return buckets;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function mean(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}
