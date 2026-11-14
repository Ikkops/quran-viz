// Word timings (`timings/<reciter>/<surah>.json`, from quran-align via the
// ETL): for each ayah of the surah, flat [wordFrom, wordTo, startMs, endMs, …]
// with 0-based words of `splitWords`, wordTo exclusive.

import { useEffect, useState } from "react";
import { dataUrl } from "./base";

/** Reciters whose recordings have word timings. */
export const TIMED_RECITERS: ReadonlySet<string> = new Set([
  "shuraym",
  "abdulbasit-mujawwad",
  "abdulbasit",
  "sudais",
  "shatri",
  "rifai",
  "husary-muallim",
  "husary",
  "alafasy",
  "minshawi-mujawwad",
  "minshawi",
  "tablawi",
]);

export type SurahTimings = number[][];

export const timingsPath = (reciter: string, surah: number) =>
  `timings/${reciter}/${surah}.json`;

const cache = new Map<string, SurahTimings>();
const inflight = new Map<string, Promise<SurahTimings>>();
/** When a surah's timings last failed to load (retried after a while). */
const failedAt = new Map<string, number>();
const RETRY_MS = 8000;

/** Where a surah's timings come from: `data/` here; in the app the device
 *  copy, downloaded first when missing (null when it can't be had). */
export type TimingsSource = (
  reciter: string,
  surah: number,
) => Promise<SurahTimings | null>;
const fromWeb: TimingsSource = async (r, s) => {
  const res = await fetch(dataUrl(timingsPath(r, s)));
  if (!res.ok) throw new Error(`${timingsPath(r, s)}: ${res.status}`);
  return (await res.json()) as SurahTimings;
};

export function loadTimings(
  reciter: string,
  surah: number,
  source: TimingsSource = fromWeb,
): Promise<SurahTimings> {
  const path = timingsPath(reciter, surah);
  const hit = cache.get(path);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(path);
  if (!p) {
    p = source(reciter, surah)
      .then((d) => {
        if (!Array.isArray(d)) throw new Error(`${path}: not available`);
        cache.set(path, d);
        failedAt.delete(path);
        return d;
      })
      .catch((e: unknown) => {
        failedAt.set(path, Date.now());
        throw e;
      })
      .finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

/** The surah's timings for a timed reciter, null otherwise or until loaded
 *  (a missing file just means no word highlighting). `again` (the ayah
 *  being recited) retries a failed load once a few seconds have passed. */
export function useWordTimings(
  reciter: string,
  surah: number | null,
  source?: TimingsSource,
  again?: unknown,
): SurahTimings | null {
  const on = surah !== null && TIMED_RECITERS.has(reciter);
  const path = on ? timingsPath(reciter, surah) : "";
  const [, bump] = useState(0);
  useEffect(() => {
    if (!on || cache.has(path)) return;
    const failed = failedAt.get(path);
    if (failed !== undefined && Date.now() - failed < RETRY_MS) return;
    let alive = true;
    loadTimings(reciter, surah, source).then(
      () => alive && bump((n) => n + 1),
      () => undefined,
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, again]);
  return on ? (cache.get(path) ?? null) : null;
}

/** The words [from, to) being recited `ms` into the ayah: the last segment
 *  that has begun (held through the pause after it), or null before the first. */
export function wordAt(flat: number[] | undefined, ms: number): [number, number] | null {
  if (!flat) return null;
  let cur: [number, number] | null = null;
  for (let k = 0; k < flat.length; k += 4) {
    if (ms < flat[k + 2]) break;
    cur = [flat[k], flat[k + 1]];
  }
  return cur;
}
