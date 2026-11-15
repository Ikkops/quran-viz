// What a learner has memorised, kept by ayah so it holds whichever printed
// layout is chosen (page breaks differ between the Madinah and IndoPak
// mushafs), and the words they stumbled on while testing themselves.
// Stored as `qv.hifdh`.

import { addDays } from "../data/readingLog";

export const HIFDH_KEY = "qv.hifdh";
const AYAHS = 6236;

/** 0 not started · 1 memorising · 2 memorised · 3 memorised but weak. */
export type HifdhStatus = 0 | 1 | 2 | 3;
export const HIFDH_STATUSES: readonly HifdhStatus[] = [0, 1, 2, 3];

/** Days until a page is due again after each smooth review in a row. */
export const LADDER = [1, 3, 7, 14, 30, 90] as const;
/** Pages still at these steps (a week or less apart) are "recent" review. */
const RECENT_STEPS = 3;
export type Rating = "forgot" | "hard" | "smooth";
export const RATINGS: readonly Rating[] = ["forgot", "hard", "smooth"];
/** How many old pages a day's plan offers. */
export const QUOTA_CHOICES = [2, 5, 10, 20] as const;
export const DEFAULT_QUOTA = 5;

export interface Stumble {
  /** How many times the word had to be peeked at. */
  n: number;
  at: number;
}

/** Where a page stands in its review ladder. */
export interface Review {
  /** The day (`dayKey`) it is next due. */
  due: string;
  /** Index into `LADDER`. */
  step: number;
}

export interface Hifdh {
  /** One digit per ayah, in mushaf order: the ayah's `HifdhStatus`. */
  status: string;
  /** Keyed `"<ayah id>:<word index>"` (word index from 0). */
  stumbles: Record<string, Stumble>;
  /** Review state per mushaf page (the Madinah page number, `verses.page`). */
  reviews: Record<string, Review>;
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
  if (r.reviews && typeof r.reviews === "object")
    for (const [k, v] of Object.entries(r.reviews as Record<string, unknown>)) {
      const x = v as Partial<Review> | null;
      if (
        /^\d+$/.test(k) &&
        x &&
        typeof x.due === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(x.due) &&
        Number.isInteger(x.step) &&
        (x.step as number) >= 0 &&
        (x.step as number) < LADDER.length
      )
        reviews[k] = { due: x.due, step: x.step as number };
    }
  return { status, stumbles, reviews };
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

/**
 * Record how reciting `pages` from memory went, on day `today`. Smooth moves
 * a page one step up the ladder and clears "needs review" on it; hard repeats
 * the step; forgot sends it back to the start and marks its memorised ayahs
 * as needing review.
 */
export function rateReview(
  h: Hifdh,
  pages: readonly HifdhPage[],
  rating: Rating,
  today: string,
): Hifdh {
  const status = [...h.status];
  const reviews = { ...h.reviews };
  for (const p of pages) {
    const was = h.reviews[p.page]?.step ?? -1;
    const step =
      rating === "forgot"
        ? 0
        : rating === "hard"
          ? Math.max(0, was)
          : Math.min(was + 1, LADDER.length - 1);
    reviews[p.page] = { step, due: addDays(today, LADDER[step]) };
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
  /** The day's share of older due pages, the longest overdue first. */
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
  const old: (HifdhPage & { due: string })[] = [];
  for (const p of pagesWith(h, verses, [2, 3])) {
    const r = h.reviews[p.page];
    if (r && r.due > today) continue;
    if (r && r.step < RECENT_STEPS) recent.push(p);
    // Never reviewed: after everything that is overdue.
    else old.push({ ...p, due: r?.due ?? "9999" });
  }
  old.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.page - b.page));
  return {
    learning: pagesWith(h, verses, [1]),
    recent,
    old: old.slice(0, quota).map(({ page, from, to }) => ({ page, from, to })),
    oldDue: old.length,
  };
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
