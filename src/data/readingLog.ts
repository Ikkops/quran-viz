// Reading time per day and what the Activity page derives from it: streaks,
// and totals per week, month, year or for all time. Pure; the timer and the
// stored copy live in lib/readingStore.ts.
//
// Days are local calendar days keyed "YYYY-MM-DD", so a day belongs to the
// date the learner saw on the clock, and the keys sort as text.

/** Seconds read per local day. */
export type ReadingLog = Record<string, number>;

export type ActivityPeriod = "week" | "month" | "year" | "all";
export const ACTIVITY_PERIODS: readonly ActivityPeriod[] = [
  "week",
  "month",
  "year",
  "all",
];

/** Daily goals on offer, in minutes; a day counts for the streak once met. */
export const GOAL_CHOICES = [1, 5, 10, 15, 20, 30, 60] as const;
export const DEFAULT_GOAL_MINUTES = 5;

const pad2 = (n: number) => String(n).padStart(2, "0");
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Noon of that day, so adding days never trips over a DST change. */
export function dayDate(key: string): Date {
  const m = DAY_KEY.exec(key);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

export function addDays(key: string, n: number): string {
  const d = dayDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Keep only well-formed days with a positive number of seconds. */
export function sanitizeReadingLog(raw: unknown): ReadingLog | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: ReadingLog = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    // "2026-13-40" parses, but as some other day: keep only real dates.
    if (!DAY_KEY.test(k) || dayKey(dayDate(k)) !== k) continue;
    // A day has 86,400 seconds; more than that is a corrupt entry.
    if (typeof v === "number" && Number.isFinite(v) && v > 0)
      out[k] = Math.min(86_400, v);
  }
  return out;
}

export function addReading(log: ReadingLog, day: string, seconds: number): ReadingLog {
  if (!(seconds > 0)) return log;
  return { ...log, [day]: Math.min(86_400, (log[day] ?? 0) + seconds) };
}

const met = (log: ReadingLog, day: string, goalSec: number) => (log[day] ?? 0) >= goalSec;

/** Days in a row that met the goal, ending today. A today that hasn't met it
 *  yet doesn't break the streak: it counts up to yesterday. */
export function currentStreak(log: ReadingLog, today: string, goalSec: number): number {
  let day = met(log, today, goalSec) ? today : addDays(today, -1);
  let n = 0;
  while (met(log, day, goalSec)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function longestStreak(log: ReadingLog, goalSec: number): number {
  const days = Object.keys(log)
    .filter((d) => met(log, d, goalSec))
    .sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface ActivityBucket {
  /** First and last day the bar covers (the same day for a daily bar). */
  from: string;
  to: string;
  seconds: number;
  /** Days with any reading. */
  daysRead: number;
  /** Days that met the goal. */
  daysMet: number;
  /** The whole bar lies after today. */
  future: boolean;
}

export interface ActivityView {
  period: ActivityPeriod;
  /** What one bar is. */
  unit: "day" | "month" | "year";
  from: string;
  to: string;
  buckets: ActivityBucket[];
  seconds: number;
  daysRead: number;
  daysMet: number;
  /** Days of the period up to today (the denominator for "days read"). */
  daysElapsed: number;
  /** There is something earlier / later to page to. */
  hasPrev: boolean;
  hasNext: boolean;
}

const monthStart = (key: string) => `${key.slice(0, 8)}01`;
const yearStart = (key: string) => `${key.slice(0, 4)}-01-01`;

function monthEnd(key: string): string {
  const d = dayDate(monthStart(key));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return dayKey(d);
}

function addMonths(key: string, n: number): string {
  const d = dayDate(monthStart(key));
  d.setMonth(d.getMonth() + n);
  return dayKey(d);
}

/** The Sunday on or before `key` (the week runs Sunday to Saturday). */
function weekStart(key: string): string {
  return addDays(key, -dayDate(key).getDay());
}

function bucket(
  log: ReadingLog,
  from: string,
  to: string,
  today: string,
  goalSec: number,
): ActivityBucket {
  let seconds = 0;
  let daysRead = 0;
  let daysMet = 0;
  for (const [d, s] of Object.entries(log)) {
    if (d < from || d > to) continue;
    seconds += s;
    daysRead++;
    if (s >= goalSec) daysMet++;
  }
  return { from, to, seconds, daysRead, daysMet, future: from > today };
}

const daysBetween = (from: string, to: string) =>
  Math.round((dayDate(to).getTime() - dayDate(from).getTime()) / 86_400_000) + 1;

/** The period that contains `anchor`, cut into bars: a week or month by day,
 *  a year by month, all time by month (by year once it spans over two years). */
export function activityView(
  log: ReadingLog,
  period: ActivityPeriod,
  anchor: string,
  today: string,
  goalSec: number,
): ActivityView {
  const first = Object.keys(log).sort()[0] ?? today;
  let from: string;
  let to: string;
  let unit: ActivityView["unit"] = "day";
  const ranges: [string, string][] = [];
  if (period === "week") {
    from = weekStart(anchor);
    to = addDays(from, 6);
    for (let i = 0; i < 7; i++) ranges.push([addDays(from, i), addDays(from, i)]);
  } else if (period === "month") {
    from = monthStart(anchor);
    to = monthEnd(anchor);
    for (let d = from; d <= to; d = addDays(d, 1)) ranges.push([d, d]);
  } else if (period === "year") {
    unit = "month";
    from = yearStart(anchor);
    to = `${anchor.slice(0, 4)}-12-31`;
    for (let m = from; m <= to; m = addMonths(m, 1)) ranges.push([m, monthEnd(m)]);
  } else {
    from = first < today ? first : today;
    to = today;
    const months =
      (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
      Number(to.slice(5, 7)) -
      Number(from.slice(5, 7)) +
      1;
    if (months <= 24) {
      unit = "month";
      for (let m = monthStart(from); m <= to; m = addMonths(m, 1))
        ranges.push([m, monthEnd(m)]);
    } else {
      unit = "year";
      for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++)
        ranges.push([`${y}-01-01`, `${y}-12-31`]);
    }
  }
  const buckets = ranges.map(([a, b]) => bucket(log, a, b, today, goalSec));
  const whole = bucket(log, from, to, today, goalSec);
  const lastDay = to < today ? to : today;
  return {
    period,
    unit,
    from,
    to,
    buckets,
    seconds: whole.seconds,
    daysRead: whole.daysRead,
    daysMet: whole.daysMet,
    daysElapsed: from > today ? 0 : daysBetween(from, lastDay),
    hasPrev: period !== "all" && first < from,
    hasNext: period !== "all" && to < today,
  };
}

/** The anchor day one period earlier (-1) or later (+1). */
export function shiftAnchor(
  period: ActivityPeriod,
  anchor: string,
  delta: 1 | -1,
): string {
  if (period === "week") return addDays(anchor, 7 * delta);
  if (period === "month") return addMonths(anchor, delta);
  if (period === "year") return `${Number(anchor.slice(0, 4)) + delta}-01-01`;
  return anchor;
}

/** Whole minutes for a label; anything under a minute that isn't zero is 1. */
export function minutesOf(seconds: number): number {
  return seconds <= 0 ? 0 : Math.max(1, Math.round(seconds / 60));
}
