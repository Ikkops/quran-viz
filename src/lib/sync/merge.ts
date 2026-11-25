import { sanitizeReadingByDevice, type ReadingLog } from "../../data/readingLog";
import { sanitizeHifdh, type Hifdh, type Review, type Stumble } from "../hifdh";
import { sanitizeLastRead, type ReadStretch } from "../lastRead";
import { sanitizeMarks, type Marks } from "../marks";
import { sanitizeReviewLog, type ReviewEntry } from "../reviewLog";

// What travels between devices, and how two copies become one. Every rule
// gives the same result whichever copy comes first, and merging a copy with
// itself changes nothing, so devices can sync in any order and any number of
// times and still agree.

export interface SyncDoc {
  app: "quran-viz";
  v: 1;
  marks?: Marks;
  hifdh?: Hifdh;
  /** Every page rating, from every device. */
  log: ReviewEntry[];
  /** Reading time per device id; each device writes only its own. */
  reading: Record<string, ReadingLog>;
  lastRead: ReadStretch[];
  /** Synced settings, each with when it was last changed (ms). */
  prefs: Record<string, { v: unknown; t: number }>;
}

/** Deletion markers older than this are dropped (every device has synced by then). */
const KEEP_GONE_MS = 180 * 86_400_000;

const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);

/** A synced copy read back from storage, or null when it is not one. */
export function sanitizeDoc(raw: unknown): SyncDoc | null {
  if (!isRecord(raw) || raw.app !== "quran-viz" || raw.v !== 1) return null;
  const prefs: SyncDoc["prefs"] = {};
  if (isRecord(raw.prefs))
    for (const [k, p] of Object.entries(raw.prefs))
      if (isRecord(p) && typeof p.t === "number" && Number.isFinite(p.t) && "v" in p)
        prefs[k] = { v: p.v, t: p.t };
  return {
    app: "quran-viz",
    v: 1,
    marks: sanitizeMarks(raw.marks),
    hifdh: sanitizeHifdh(raw.hifdh),
    log: sanitizeReviewLog(raw.log) ?? [],
    reading: sanitizeReadingByDevice(raw.reading),
    lastRead: sanitizeLastRead(raw.lastRead) ?? [],
    prefs,
  };
}

/** The newer of two records by `time`, `a` on a tie. */
function newer<T>(a: T | undefined, b: T | undefined, time: (x: T) => number) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return time(b) > time(a) ? b : a;
}

/** Ids of `a` in order, then those only `b` has. */
function idsInOrder<T extends { id: string | number }>(a: T[], b: T[]): string[] {
  const ids = a.map((x) => String(x.id));
  const seen = new Set(ids);
  for (const x of b) if (!seen.has(String(x.id))) ids.push(String(x.id));
  return ids;
}

const byId = <T extends { id: string | number }>(xs: T[]) =>
  new Map(xs.map((x) => [String(x.id), x]));

/**
 * Pins, collections and their ayahs are separate records: each keeps its
 * newest change (`t`, or `at` in data from before sync). A deletion marker
 * wins over every change made before it, and loses to one made after (an
 * ayah taken out on one device and added back on another stays).
 */
export function mergeMarks(a?: Marks, b?: Marks, now = Date.now()): Marks | undefined {
  if (!a || !b) return a ?? b;
  const gone: Record<string, number> = {};
  for (const g of [a.gone, b.gone])
    for (const [k, t] of Object.entries(g ?? {}))
      if (now - t < KEEP_GONE_MS && t > (gone[k] ?? -Infinity)) gone[k] = t;
  const alive = (key: string, t: number) => !(key in gone) || t > gone[key];

  const pinsA = byId(a.pins);
  const pinsB = byId(b.pins);
  const pins = idsInOrder(a.pins, b.pins)
    .map((id) => newer(pinsA.get(id), pinsB.get(id), (p) => p.t ?? p.at)!)
    .filter((p) => alive(`p:${p.id}`, p.t ?? p.at));

  const colsA = byId(a.collections);
  const colsB = byId(b.collections);
  const collections = idsInOrder(a.collections, b.collections).flatMap((id) => {
    const ca = colsA.get(id);
    const cb = colsB.get(id);
    const head = newer(ca, cb, (c) => c.t ?? 0)!;
    if (!alive(`c:${id}`, head.t ?? 0)) return [];
    const ia = byId(ca?.items ?? []);
    const ib = byId(cb?.items ?? []);
    const items = idsInOrder(ca?.items ?? [], cb?.items ?? [])
      .map((ayah) => newer(ia.get(ayah), ib.get(ayah), (i) => i.t ?? i.at)!)
      .filter((i) => alive(`i:${id}:${i.id}`, i.t ?? i.at));
    return [{ ...head, items }];
  });
  return { pins, collections, ...(Object.keys(gone).length ? { gone } : {}) };
}

/**
 * Each ayah keeps its newest status (`statusAt`); with no time on either side
 * (data from before sync), the further along wins, so marking on one device
 * and not on another never unmarks. Each page keeps its newest rating, each
 * word its newest stumble count (a removal is a zero count), and the newest
 * recall target wins.
 */
export function mergeHifdh(a?: Hifdh, b?: Hifdh): Hifdh | undefined {
  if (!a || !b) return a ?? b;
  const status: string[] = [];
  const statusAt: Record<string, number> = {};
  for (let i = 0; i < Math.max(a.status.length, b.status.length); i++) {
    const ta = a.statusAt?.[i + 1] ?? 0;
    const tb = b.statusAt?.[i + 1] ?? 0;
    const sa = a.status[i] ?? "0";
    const sb = b.status[i] ?? "0";
    status.push(tb > ta ? sb : ta > tb ? sa : sa > sb ? sa : sb);
    if (ta || tb) statusAt[i + 1] = Math.max(ta, tb);
  }
  const reviews: Record<string, Review> = {};
  for (const page of new Set([...Object.keys(a.reviews), ...Object.keys(b.reviews)])) {
    const ra = a.reviews[page];
    const rb = b.reviews[page];
    // The newer rating; with no times (data from before sync), the later day.
    const bWins =
      !ra ||
      (!!rb &&
        ((rb.at ?? 0) > (ra.at ?? 0) ||
          ((rb.at ?? 0) === (ra.at ?? 0) && rb.last > ra.last)));
    reviews[page] = bWins ? rb! : ra;
  }
  const stumbles: Record<string, Stumble> = {};
  for (const k of new Set([...Object.keys(a.stumbles), ...Object.keys(b.stumbles)]))
    stumbles[k] = newer(a.stumbles[k], b.stumbles[k], (s) => s.at + s.n / 1e6)!;
  const r = (b.retentionAt ?? 0) > (a.retentionAt ?? 0) ? b : a;
  return {
    status: status.join(""),
    stumbles,
    reviews,
    ...(r.retention ? { retention: r.retention } : {}),
    ...(r.retentionAt ? { retentionAt: r.retentionAt } : {}),
    ...(Object.keys(statusAt).length ? { statusAt } : {}),
  };
}

/** Every rating from both, once, oldest first. */
export function mergeLog(a: ReviewEntry[], b: ReviewEntry[]): ReviewEntry[] {
  const seen = new Map<string, ReviewEntry>();
  for (const e of [...a, ...b]) seen.set(`${e[0]}:${e[2]}`, e);
  return [...seen.values()].sort((x, y) => x[2] - y[2] || x[0] - y[0]);
}

/** Per device and day, the larger count: a device's own log only grows. */
export function mergeReading(
  a: Record<string, ReadingLog>,
  b: Record<string, ReadingLog>,
): Record<string, ReadingLog> {
  const out: Record<string, ReadingLog> = {};
  for (const device of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const log: ReadingLog = { ...a[device] };
    for (const [day, s] of Object.entries(b[device] ?? {}))
      log[day] = Math.max(log[day] ?? 0, s);
    out[device] = log;
  }
  return out;
}

/** The newest place per surah, newest first, as many as the list keeps. */
export const mergeLastRead = (a: ReadStretch[], b: ReadStretch[]): ReadStretch[] =>
  sanitizeLastRead([...a, ...b].sort((x, y) => y.at - x.at || x.id - y.id)) ?? [];

/** Each setting keeps its newest change. */
export function mergePrefs(a: SyncDoc["prefs"], b: SyncDoc["prefs"]): SyncDoc["prefs"] {
  const out = { ...a };
  for (const [k, p] of Object.entries(b)) out[k] = newer(out[k], p, (x) => x.t)!;
  return out;
}

export function mergeDocs(a: SyncDoc, b: SyncDoc, now = Date.now()): SyncDoc {
  return {
    app: "quran-viz",
    v: 1,
    marks: mergeMarks(a.marks, b.marks, now),
    hifdh: mergeHifdh(a.hifdh, b.hifdh),
    log: mergeLog(a.log, b.log),
    reading: mergeReading(a.reading, b.reading),
    lastRead: mergeLastRead(a.lastRead, b.lastRead),
    prefs: mergePrefs(a.prefs, b.prefs),
  };
}

/** JSON with object keys sorted, so two equal copies give one string. */
export function canonical(x: unknown): string {
  return JSON.stringify(x, (_, v: unknown) =>
    isRecord(v)
      ? Object.fromEntries(Object.entries(v).sort(([p], [q]) => (p < q ? -1 : 1)))
      : v,
  );
}
