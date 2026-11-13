import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_GOAL_MINUTES,
  GOAL_CHOICES,
  addReading,
  dayKey,
  sanitizeReadingLog,
  type ReadingLog,
} from "../data/readingLog";
import { readPersisted, usePersistentState } from "./usePersistentState";

// The reading log (seconds per day), kept outside React so the timer's ticks
// re-render only the screens that show it. Persisted as `qv.reading.log`.

export const READING_LOG_KEY = "qv.reading.log";

/** Without a touch, key or scroll for this long, the timer stops counting. */
const IDLE_MS = 120_000;
const TICK_MS = 10_000;
/** A tick never adds more than this (the device slept, the tab was frozen). */
const MAX_STEP_MS = 60_000;

let log: ReadingLog | null = null;
const listeners = new Set<() => void>();
let listening = false;

function current(): ReadingLog {
  if (!log) log = readPersisted<ReadingLog>(READING_LOG_KEY, {}, sanitizeReadingLog);
  return log;
}

export function addReadingTime(seconds: number, now: Date = new Date()): void {
  const next = addReading(current(), dayKey(now), seconds);
  if (next === log) return;
  log = next;
  try {
    window.localStorage.setItem(READING_LOG_KEY, JSON.stringify(next));
  } catch {
    /* ignore (quota / private mode) */
  }
  listeners.forEach((fn) => fn());
}

/** Recitation is playing: listening counts as reading, even with the screen
 *  untouched or off. */
export function setListening(on: boolean): void {
  listening = on;
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function useReadingLog(): ReadingLog {
  return useSyncExternalStore(subscribe, current, current);
}

/** For tests: forget the in-memory copy. */
export function resetReadingStore(): void {
  log = null;
  listening = false;
}

/** Count time while `active` (the reader is open): the page must be visible
 *  and recently touched, or recitation must be playing. */
export function useReadingTimer(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    let lastInput = last;
    const onInput = () => {
      lastInput = Date.now();
    };
    const tick = () => {
      const now = Date.now();
      const step = Math.min(now - last, MAX_STEP_MS);
      last = now;
      const visible = document.visibilityState === "visible";
      if (listening || (visible && now - lastInput < IDLE_MS))
        addReadingTime(step / 1000, new Date(now));
    };
    const onVisibility = () => {
      // Returning counts as activity; leaving closes the open stretch.
      if (document.visibilityState === "visible") {
        last = Date.now();
        lastInput = last;
      } else tick();
    };
    const opts = { passive: true, capture: true } as const;
    const inputs = ["pointerdown", "keydown", "wheel", "scroll", "touchmove"] as const;
    for (const e of inputs) window.addEventListener(e, onInput, opts);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(tick, TICK_MS);
    return () => {
      tick();
      clearInterval(timer);
      for (const e of inputs) window.removeEventListener(e, onInput, opts);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);
}

const goalChoice = (raw: unknown) =>
  GOAL_CHOICES.includes(raw as (typeof GOAL_CHOICES)[number])
    ? (raw as number)
    : undefined;

/** The daily goal in minutes (`qv.reading.goal`), shared by Home and Activity. */
export function useReadingGoal() {
  return usePersistentState<number>("qv.reading.goal", DEFAULT_GOAL_MINUTES, goalChoice);
}
