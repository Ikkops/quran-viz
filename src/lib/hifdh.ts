// What a learner has memorised, kept by ayah so it holds whichever printed
// layout is chosen (page breaks differ between the Madinah and IndoPak
// mushafs), and the words they stumbled on while testing themselves.
// Stored as `qv.hifdh`.

import { addDays, dayDate } from "../data/readingLog";

export const HIFDH_KEY = "qv.hifdh";
const AYAHS = 6236;

/** 0 not started · 1 memorising · 2 memorised · 3 memorised but weak. */
export type HifdhStatus = 0 | 1 | 2 | 3;
export const HIFDH_STATUSES: readonly HifdhStatus[] = [0, 1, 2, 3];

/** The fixed review ladder before FSRS (days after each smooth review in a
 *  row): stored `{ due, step }` reviews are read through it. */
const OLD_LADDER = [1, 3, 7, 14, 30, 90];
/** Due pages last reviewed this many days or fewer apart are "recent" review. */
const RECENT_DAYS = 7;
export type Rating = "forgot" | "hard" | "smooth";
export const RATINGS: readonly Rating[] = ["forgot", "hard", "smooth"];
/** The chance of still knowing a page on the day it comes due (FSRS's
 *  desired retention): higher means more reviews and fewer slips. */
export const RETENTION_CHOICES = [0.85, 0.9, 0.95, 0.97] as const;
export const DEFAULT_RETENTION = 0.9;
/** A memorised page is never left longer than this, however well it went. */
const MAX_INTERVAL = 180;
/** How many old pages a day's plan offers. */
export const QUOTA_CHOICES = [2, 5, 10, 20] as const;
export const DEFAULT_QUOTA = 5;

export interface Stumble {
  /** How many times the word had to be peeked at. */
  n: number;
  at: number;
}

/** A page's memory, as FSRS models it, and when it is next due. */
export interface Review {
  /** The day (`dayKey`) it is next due. */
  due: string;
  /** The day it was last reviewed. */
  last: string;
  /** Stability: days until the chance of recalling it falls to 90%. */
  s: number;
  /** Difficulty, 1 (easy) to 10. */
  d: number;
}

export interface Hifdh {
  /** One digit per ayah, in mushaf order: the ayah's `HifdhStatus`. */
  status: string;
  /** Keyed `"<ayah id>:<word index>"` (word index from 0). */
  stumbles: Record<string, Stumble>;
  /** Review state per mushaf page (the Madinah page number, `verses.page`). */
  reviews: Record<string, Review>;
  /** Desired retention (one of `RETENTION_CHOICES`); unset is the default. */
  retention?: number;
}

export const emptyHifdh = (): Hifdh => ({
  status: "0".repeat(AYAHS),
  stumbles: {},
  reviews: {},
});

/** Keep stored hifdh data only in the shape above; anything else starts empty. */
export function sanitizeHifdh(raw: unknown): Hifdh | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.status !== "string" || !/^[0-3]*$/.test(r.status)) return undefined;
  const status = r.status.slice(0, AYAHS).padEnd(AYAHS, "0");
  const stumbles: Record<string, Stumble> = {};
  if (r.stumbles && typeof r.stumbles === "object")
    for (const [k, v] of Object.entries(r.stumbles as Record<string, unknown>)) {
      const s = v as Partial<Stumble> | null;
      if (
        /^\d+:\d+$/.test(k) &&
        s &&
        Number.isInteger(s.n) &&
        (s.n as number) > 0 &&
        typeof s.at === "number"
      )
        stumbles[k] = { n: s.n as number, at: s.at };
    }
  const reviews: Record<string, Review> = {};
  const day = (x: unknown): x is string =>
    typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const num = (x: unknown, lo: number, hi: number): x is number =>
    typeof x === "number" && x >= lo && x <= hi;
  if (r.reviews && typeof r.reviews === "object")
    for (const [k, v] of Object.entries(r.reviews as Record<string, unknown>)) {
      const x = v as Record<string, unknown> | null;
      if (!/^\d+$/.test(k) || !x || !day(x.due)) continue;
      if (day(x.last) && num(x.s, S_MIN, S_MAX) && num(x.d, 1, 10))
        reviews[k] = { due: x.due, last: x.last, s: x.s, d: x.d };
      // A ladder review: its last interval stands in for stability.
      else if (Number.isInteger(x.step) && num(x.step, 0, OLD_LADDER.length - 1)) {
        const days = OLD_LADDER[x.step];
        reviews[k] = { due: x.due, last: addDays(x.due, -days), s: days, d: 5 };
      }
    }
  const retention = (RETENTION_CHOICES as readonly unknown[]).includes(r.retention)
    ? (r.retention as number)
    : undefined;
  return { status, stumbles, reviews, ...(retention ? { retention } : {}) };
}

export const statusOf = (h: Hifdh, id: number): HifdhStatus =>
  (Number(h.status[id - 1]) || 0) as HifdhStatus;

/** Give every ayah from `from` to `to` (global ids, inclusive) one status. */
export function setStatus(h: Hifdh, from: number, to: number, s: HifdhStatus): Hifdh {
  const a = Math.max(1, Math.min(from, to));
  const b = Math.min(AYAHS, Math.max(from, to));
  if (b < a) return h;
  return {
    ...h,
    status: h.status.slice(0, a - 1) + String(s).repeat(b - a + 1) + h.status.slice(b),
  };
}

/** How many ayahs from `from` to `to` have each status, indexed by status. */
export function countStatus(h: Hifdh, from = 1, to = AYAHS): number[] {
  const n = [0, 0, 0, 0];
  for (let i = Math.max(1, from); i <= Math.min(AYAHS, to); i++) n[statusOf(h, i)]++;
  return n;
}

/** Ids of the ayahs whose status is one of `which`. */
export function ayahsWith(h: Hifdh, which: readonly HifdhStatus[]): number[] {
  const ids: number[] = [];
  for (let i = 1; i <= AYAHS; i++) if (which.includes(statusOf(h, i))) ids.push(i);
  return ids;
}

/** One more stumble on word `w` (from 0) of ayah `id`. */
export function addStumble(h: Hifdh, id: number, w: number, now: number): Hifdh {
  const key = `${id}:${w}`;
  return {
    ...h,
    stumbles: { ...h.stumbles, [key]: { n: (h.stumbles[key]?.n ?? 0) + 1, at: now } },
  };
}

export const stumbleCount = (h: Hifdh, id: number, w: number): number =>
  h.stumbles[`${id}:${w}`]?.n ?? 0;

/** Every stumble, the most repeated (then the latest) first. */
export function listStumbles(
  h: Hifdh,
): { id: number; w: number; n: number; at: number }[] {
  return Object.entries(h.stumbles)
    .map(([k, s]) => {
      const [id, w] = k.split(":").map(Number);
      return { id, w, n: s.n, at: s.at };
    })
    .sort((a, b) => b.n - a.n || b.at - a.at);
}

export function removeStumble(h: Hifdh, id: number, w: number): Hifdh {
  const stumbles = { ...h.stumbles };
  delete stumbles[`${id}:${w}`];
  return { ...h, stumbles };
}

/** What the planner needs of a verse (`Verse` has both). */
export interface PagedAyah {
  id: number;
  page: number;
}

/** A mushaf page with memorised ayahs on it: its whole ayah range. */
export interface HifdhPage {
  page: number;
  from: number;
  to: number;
}

/** Pages holding an ayah whose status is one of `which`, in mushaf order. */
export function pagesWith(
  h: Hifdh,
  verses: readonly PagedAyah[],
  which: readonly HifdhStatus[],
): HifdhPage[] {
  const out: HifdhPage[] = [];
  let cur: (HifdhPage & { hit: boolean }) | null = null;
  const close = () => {
    if (cur?.hit) out.push({ page: cur.page, from: cur.from, to: cur.to });
  };
  for (const v of verses) {
    if (!cur || cur.page !== v.page) {
      close();
      cur = { page: v.page, from: v.id, to: v.id, hit: false };
    }
    cur.to = v.id;
    if (which.includes(statusOf(h, v.id))) cur.hit = true;
  }
  close();
  return out;
}

// ── FSRS-6, the scheduler Anki uses (open-spaced-repetition/fsrs-rs 6.6.2,
// `model.rs`), with its default parameters. A page is one card; forgot,
// hard and smooth are Again, Hard and Good.
const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
  1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];
const S_MIN = 0.001;
const S_MAX = 36500;
const DECAY = -W[20];
const FACTOR = 0.9 ** (1 / DECAY) - 1;
const GRADE: Record<Rating, 1 | 2 | 3> = { forgot: 1, hard: 2, smooth: 3 };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const initDifficulty = (g: number) => W[4] - Math.exp(W[5] * (g - 1)) + 1;

/** The chance of recalling a page `days` after its last review. */
export const retrievability = (days: number, s: number): number =>
  (1 + (FACTOR * days) / s) ** DECAY;

/** The memory after a review graded `g` (1 Again … 4 Easy), `days` after the
 *  last one; `null` is a first review. */
export function nextMemory(
  m: { s: number; d: number } | null,
  days: number,
  g: number,
): { s: number; d: number } {
  if (!m) return { s: W[g - 1], d: clamp(initDifficulty(g), 1, 10) };
  const s = clamp(m.s, S_MIN, S_MAX);
  const d = clamp(m.d, 1, 10);
  const r = retrievability(days, s);
  let next: number;
  if (days === 0) {
    // Again the same day: short-term stability.
    const sinc = Math.exp(W[17] * (g - 3 + W[18])) * s ** -W[19];
    next = s * (g >= 2 ? Math.max(sinc, 1) : sinc);
  } else if (g === 1) {
    next = Math.min(
      W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp(W[14] * (1 - r)),
      s / Math.exp(W[17] * W[18]),
    );
  } else {
    const grade = g === 2 ? W[15] : g === 4 ? W[16] : 1;
    next =
      s *
      (Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp(W[10] * (1 - r)) - 1) * grade +
        1);
  }
  const moved = d + ((10 - d) * -W[6] * (g - 3)) / 9;
  return {
    s: clamp(next, S_MIN, S_MAX),
    d: clamp(W[7] * (initDifficulty(4) - moved) + moved, 1, 10),
  };
}

const daysBetween = (a: string, b: string) =>
  Math.round((dayDate(b).getTime() - dayDate(a).getTime()) / 86_400_000);

/** Anki's fuzz range around an interval (`fuzz.rs`): none under 2.5 days,
 *  then a day plus 15%, 10% and 5% of the days in each band. */
function fuzzRange(ivl: number): [number, number] {
  if (ivl < 2.5) return [Math.round(ivl), Math.round(ivl)];
  const delta =
    1 +
    0.15 * (Math.min(ivl, 7) - 2.5) +
    0.1 * Math.max(0, Math.min(ivl, 20) - 7) +
    0.05 * Math.max(0, ivl - 20);
  const lo = clamp(Math.round(ivl - delta), 1, MAX_INTERVAL);
  const hi = clamp(Math.round(ivl + delta), 1, MAX_INTERVAL);
  return [lo, hi === lo && hi > 2 && hi < MAX_INTERVAL ? lo + 1 : hi];
}

/**
 * Record how reciting `pages` from memory went, on day `today`. Each page's
 * FSRS memory moves and its next review lands where the chance of still
 * knowing it falls to the desired retention. Pages rated together are spread
 * over that interval's fuzz range, each on the day with the fewest pages
 * already due (Anki's load balancer, made deterministic), so a juz reviewed
 * in one sitting does not come due in one day. Smooth clears "needs review";
 * forgot marks the page's memorised ayahs as needing it.
 */
export function rateReview(
  h: Hifdh,
  pages: readonly HifdhPage[],
  rating: Rating,
  today: string,
): Hifdh {
  const status = [...h.status];
  const reviews = { ...h.reviews };
  const rated = new Set(pages.map((p) => String(p.page)));
  const load = new Map<string, number>();
  for (const [k, r] of Object.entries(h.reviews))
    if (!rated.has(k)) load.set(r.due, (load.get(r.due) ?? 0) + 1);
  const retention = h.retention ?? DEFAULT_RETENTION;
  for (const p of pages) {
    const was = h.reviews[p.page];
    const m = nextMemory(
      was ?? null,
      was ? Math.max(0, daysBetween(was.last, today)) : 0,
      GRADE[rating],
    );
    const ivl = clamp((m.s / FACTOR) * (retention ** (1 / DECAY) - 1), 1, MAX_INTERVAL);
    const [lo, hi] = fuzzRange(ivl);
    let due = addDays(today, Math.round(ivl));
    for (let i = lo, best = Infinity; i <= hi; i++) {
      const day = addDays(today, i);
      const cost = (load.get(day) ?? 0) * 100 + Math.abs(i - ivl);
      if (cost < best) [best, due] = [cost, day];
    }
    load.set(due, (load.get(due) ?? 0) + 1);
    reviews[p.page] = { due, last: today, s: m.s, d: m.d };
    if (rating === "hard") continue;
    const [a, b] = rating === "forgot" ? ["2", "3"] : ["3", "2"];
    for (let id = p.from; id <= p.to; id++) if (status[id - 1] === a) status[id - 1] = b;
  }
  return { ...h, status: status.join(""), reviews };
}

export interface HifdhPlan {
  /** Pages with ayahs still being memorised (ziyadah). */
  learning: HifdhPage[];
  /** Due pages last reviewed a week or less apart. */
  recent: HifdhPage[];
  /** The day's share of older due pages, the likeliest forgotten first. */
  old: HifdhPage[];
  /** How many older pages are due in all. */
  oldDue: number;
}

/** What to recite on day `today`, offering at most `quota` older pages. */
export function todaysPlan(
  h: Hifdh,
  verses: readonly PagedAyah[],
  today: string,
  quota: number,
): HifdhPlan {
  const recent: HifdhPage[] = [];
  const old: (HifdhPage & { recall: number })[] = [];
  for (const p of pagesWith(h, verses, [2, 3])) {
    const r = h.reviews[p.page];
    if (r && r.due > today) continue;
    if (r && daysBetween(r.last, r.due) <= RECENT_DAYS) recent.push(p);
    // Anki's order for FSRS: the lowest chance of recall first; never
    // reviewed after everything that is due.
    else
      old.push({
        ...p,
        recall: r ? retrievability(Math.max(0, daysBetween(r.last, today)), r.s) : 2,
      });
  }
  old.sort((a, b) => a.recall - b.recall || a.page - b.page);
  return {
    learning: pagesWith(h, verses, [1]),
    recent,
    old: old.slice(0, quota).map(({ page, from, to }) => ({ page, from, to })),
    oldDue: old.length,
  };
}

/** One group's memorisation (a surah, a juz…): its ayah count, how many are
 *  memorised (`done`, needing review or not), need review (`weak`) and are
 *  being memorised (`learning`), and its first and last ayah ids. */
export interface Progress {
  total: number;
  done: number;
  weak: number;
  learning: number;
  from: number;
  to: number;
}

/** Memorisation per group of `verses` (in mushaf order), keyed by `key`. */
export function progressBy<V extends { id: number }>(
  h: Hifdh,
  verses: readonly V[],
  key: (v: V) => number,
): Map<number, Progress> {
  const out = new Map<number, Progress>();
  verses.forEach((v) => {
    const k = key(v);
    let g = out.get(k);
    if (!g) {
      g = { total: 0, done: 0, weak: 0, learning: 0, from: v.id, to: v.id };
      out.set(k, g);
    }
    const st = statusOf(h, v.id);
    g.total++;
    g.to = v.id;
    if (st >= 2) g.done++;
    if (st === 3) g.weak++;
    if (st === 1) g.learning++;
  });
  return out;
}

/** Ayahs to prompt "continue from here": memorised, and so is the next ayah
 *  of the same surah. */
export function sambungStarts(
  h: Hifdh,
  verses: readonly { id: number; s: number }[],
): number[] {
  const known = (id: number) => statusOf(h, id) >= 2;
  const out: number[] = [];
  for (let i = 0; i + 1 < verses.length; i++)
    if (verses[i].s === verses[i + 1].s && known(verses[i].id) && known(verses[i + 1].id))
      out.push(verses[i].id);
  return out;
}
