import { SCOPE_MAX } from "../components/charts/common";
import { dayDate } from "../data/readingLog";
import { usePersistentState } from "./usePersistentState";

// Khatam target: finish the whole mushaf by a chosen day. Stored as `qv.khatam`.

export const MUSHAF_PAGES = SCOPE_MAX.page;
export const KHATAM_KEY = "qv.khatam";

export interface KhatamTarget {
  /** Day the target was set (dayKey). */
  start: string;
  /** Day to finish by, inclusive (dayKey). */
  end: string;
  /** Mushaf page the reader was on when the target was set. */
  from: number;
}

export type KhatamStatus =
  | { kind: "done" }
  | { kind: "onTrack" }
  | { kind: "behind"; pages: number }
  | { kind: "overdue" };

export interface KhatamPlan {
  /** Pages after the current one, up to and including the last page. */
  pagesLeft: number;
  /** Days from today to the end date, both counted; 0 once it has passed. */
  daysLeft: number;
  /** Average pages a day from here on (all that is left once overdue). */
  perDay: number;
  /** Pages still to read today to stand on the line tonight; 0 once read. */
  today: number;
  /** Where a straight line from `from` at `start` to the last page at `end`
   *  stands at the start of today (yesterday's quota met). */
  expected: number;
  status: KhatamStatus;
  /** 0..1 of the way from `from` to the last page. */
  progress: number;
}

const isDay = (x: unknown): x is string =>
  typeof x === "string" && !Number.isNaN(dayDate(x).getTime());

const daysBetween = (from: string, to: string) =>
  Math.round((dayDate(to).getTime() - dayDate(from).getTime()) / 86_400_000);

export function sanitizeKhatam(raw: unknown): KhatamTarget | null | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { start, end, from } = raw as Record<string, unknown>;
  if (!isDay(start) || !isDay(end) || end < start) return undefined;
  if (typeof from !== "number" || !Number.isInteger(from)) return undefined;
  if (from < 1 || from > MUSHAF_PAGES) return undefined;
  return { start, end, from };
}

export function khatamPlan(
  target: KhatamTarget,
  currentPage: number,
  today: string,
): KhatamPlan {
  // shortcut: progress is the last-read position, not pages actually read; fine for sequential reading, revisit if per-page reading history is ever tracked.
  const last = MUSHAF_PAGES;
  const pagesLeft = Math.max(0, last - currentPage);
  const overdue = today > target.end;
  const daysLeft = overdue ? 0 : Math.max(1, daysBetween(today, target.end) + 1);
  const perDay = overdue ? pagesLeft : Math.ceil(pagesLeft / daysLeft);
  const total = daysBetween(target.start, target.end) + 1;
  const elapsed = Math.min(total, Math.max(0, daysBetween(target.start, today)));
  const span = last - target.from;
  const expected = Math.floor(target.from + (span * elapsed) / total);
  const tonight = Math.ceil(target.from + (span * Math.min(total, elapsed + 1)) / total);
  const todayPages = overdue ? pagesLeft : Math.max(0, tonight - currentPage);
  const progress =
    currentPage >= last || span <= 0
      ? 1
      : Math.min(1, Math.max(0, (currentPage - target.from) / span));
  const status: KhatamStatus =
    currentPage >= last
      ? { kind: "done" }
      : overdue
        ? { kind: "overdue" }
        : currentPage < expected
          ? { kind: "behind", pages: expected - currentPage }
          : { kind: "onTrack" };
  return { pagesLeft, daysLeft, perDay, today: todayPages, expected, status, progress };
}

/** The khatam target (`qv.khatam`), shared by Home and Activity. */
export function useKhatam() {
  return usePersistentState<KhatamTarget | null>(KHATAM_KEY, null, sanitizeKhatam);
}
