import { useSyncExternalStore } from "react";
import { readPersisted } from "./usePersistentState";
import { noteLocalChange, onSyncApplied } from "./sync/changes";

// Every page rating ever made: [page, grade, at]. Kept apart from `qv.hifdh`
// so the memorisation state stays small; it grows by a few bytes a review.
// It gives "how often I recalled" now and lets FSRS be fitted to the learner
// later. shortcut: localStorage holds it, move to IndexedDB if it passes ~2 MB.

export const REVIEW_LOG_KEY = "qv.hifdh.log";
/** A page (Madinah page number), its FSRS grade (1 forgot, 2 hard, 3 smooth)
 *  and when it was rated (ms). */
export type ReviewEntry = [page: number, grade: 1 | 2 | 3, at: number];

export function sanitizeReviewLog(raw: unknown): ReviewEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(
    (e): e is ReviewEntry =>
      Array.isArray(e) &&
      e.length === 3 &&
      Number.isInteger(e[0]) &&
      e[0] >= 1 &&
      e[0] <= 604 &&
      (e[1] === 1 || e[1] === 2 || e[1] === 3) &&
      typeof e[2] === "number" &&
      Number.isFinite(e[2]),
  );
}

/** `log` with one entry per page rated `grade` at `at`. */
export const logReviews = (
  log: readonly ReviewEntry[],
  pages: readonly number[],
  grade: 1 | 2 | 3,
  at: number,
): ReviewEntry[] => [...log, ...pages.map((p): ReviewEntry => [p, grade, at])];

/** Page reviews since `days` before `now` (later ones count too), and how
 *  many were recalled (hard or smooth, not forgot). */
export function recallStats(
  log: readonly ReviewEntry[],
  now: number,
  days = 30,
): { reviews: number; recalled: number } {
  const since = now - days * 86_400_000;
  let reviews = 0;
  let recalled = 0;
  for (const [, grade, at] of log)
    if (at >= since) {
      reviews++;
      if (grade > 1) recalled++;
    }
  return { reviews, recalled };
}

let log: ReviewEntry[] | null = null;
const listeners = new Set<() => void>();
const current = (): ReviewEntry[] =>
  (log ??= readPersisted<ReviewEntry[]>(REVIEW_LOG_KEY, [], sanitizeReviewLog));
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const reload = () => {
  log = null;
  listeners.forEach((fn) => fn());
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => e.key === REVIEW_LOG_KEY && reload());
  onSyncApplied((keys) => keys.includes(REVIEW_LOG_KEY) && reload());
}

/** Record that `pages` were rated `grade` now. */
export function appendReviews(
  pages: readonly number[],
  grade: 1 | 2 | 3,
  at = Date.now(),
) {
  if (!pages.length) return;
  log = logReviews(current(), pages, grade, at);
  try {
    window.localStorage.setItem(REVIEW_LOG_KEY, JSON.stringify(log));
  } catch {
    /* ignore (quota / private mode) */
  }
  listeners.forEach((fn) => fn());
  noteLocalChange(REVIEW_LOG_KEY);
}

export function useReviewLog(): readonly ReviewEntry[] {
  return useSyncExternalStore(subscribe, current, current);
}
