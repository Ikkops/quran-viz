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

/** Where a surah's timings are read from: `data/` here, the device copy in
 *  the app (null when there is none). */
export type TimingsUrl = (reciter: string, surah: number) => Promise<string | null>;
const webUrl: TimingsUrl = async (r, s) => dataUrl(timingsPath(r, s));

export function loadTimings(
  reciter: string,
  surah: number,
  url: TimingsUrl = webUrl,
): Promise<SurahTimings> {
  const path = timingsPath(reciter, surah);
  const hit = cache.get(path);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(path);
  if (!p) {
    p = url(reciter, surah)
      .then((u) => {
        if (!u) throw new Error(`${path}: not on the device`);
        return fetch(u);
      })
      .then((r) => {
        if (!r.ok) throw new Error(`${path}: ${r.status}`);
        return r.json() as Promise<SurahTimings>;
      })
      .then((d) => {
        cache.set(path, d);
        return d;
      })
      .finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

/** The surah's timings for a timed reciter, null otherwise or until loaded
 *  (a missing file just means no word highlighting). */
export function useWordTimings(
  reciter: string,
  surah: number | null,
  url?: TimingsUrl,
): SurahTimings | null {
  const on = surah !== null && TIMED_RECITERS.has(reciter);
  const path = on ? timingsPath(reciter, surah) : "";
  const [, bump] = useState(0);
  useEffect(() => {
    if (!on || cache.has(path)) return;
    let alive = true;
    loadTimings(reciter, surah, url).then(
      () => alive && bump((n) => n + 1),
      () => undefined,
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
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
