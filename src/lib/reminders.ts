// Daily reminders (Android app): which local notifications to have pending.
// Pure; the plugin calls live in lib/remindersNative.ts. The app can only
// schedule while it is open, so each sync replaces the next 7 days.

import { addDays, dayDate, dayKey, type ReadingLog } from "../data/readingLog";
import { todaysPlan, type Hifdh, type PagedAyah } from "./hifdh";

export const REMINDERS_KEY = "qv.reminders";

export type ReminderKind = "reading" | "hifdh";
export const REMINDER_KINDS: readonly ReminderKind[] = ["reading", "hifdh"];

export interface ReminderSettings {
  reading: { on: boolean; time: string };
  hifdh: { on: boolean; time: string };
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  reading: { on: false, time: "20:00" },
  hifdh: { on: false, time: "05:30" },
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Keep each reminder's shape, falling back to its default part by part. */
export function sanitizeReminders(raw: unknown): ReminderSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const one = (k: ReminderKind) => {
    const v = (r[k] ?? {}) as Record<string, unknown>;
    return {
      on: typeof v.on === "boolean" ? v.on : DEFAULT_REMINDERS[k].on,
      time:
        typeof v.time === "string" && TIME.test(v.time)
          ? v.time
          : DEFAULT_REMINDERS[k].time,
    };
  };
  return { reading: one("reading"), hifdh: one("hifdh") };
}

export const REMINDER_DAYS = 7;
const BASE_ID: Record<ReminderKind, number> = { reading: 7100, hifdh: 7110 };
/** Every notification id this feature may use: cancelled before each sync. */
export const REMINDER_IDS: readonly number[] = REMINDER_KINDS.flatMap((k) =>
  Array.from({ length: REMINDER_DAYS }, (_, i) => BASE_ID[k] + i),
);

export interface Reminder {
  id: number;
  at: Date;
  kind: ReminderKind;
  /** Hifdh: pages due that day. */
  count?: number;
}

export interface ReminderState {
  goalMinutes: number;
  log: ReadingLog;
  hifdh: Hifdh;
  verses: readonly PagedAyah[];
}

/** Pages due for review on `day`, from the stored review dates. */
export function pagesDue(h: Hifdh, verses: readonly PagedAyah[], day: string): number {
  const plan = todaysPlan(h, verses, day, 0);
  return plan.recent.length + plan.oldDue;
}

/**
 * The reminders to schedule from `now`: one per enabled kind per day for
 * `REMINDER_DAYS` days. Today is left out once its time has passed or its
 * condition holds (goal met, nothing due); a later day always gets the reading
 * reminder, the hifdh one only when pages will be due then.
 */
export function nextReminders(
  now: Date,
  settings: ReminderSettings,
  state: ReminderState,
): Reminder[] {
  const today = dayKey(now);
  const out: Reminder[] = [];
  for (const kind of REMINDER_KINDS) {
    const { on, time } = settings[kind];
    if (!on) continue;
    const [hh, mm] = time.split(":").map(Number);
    for (let i = 0; i < REMINDER_DAYS; i++) {
      const day = addDays(today, i);
      // From the day's noon, so a DST change never moves it to another day.
      const at = dayDate(day);
      at.setHours(hh, mm, 0, 0);
      if (at <= now) continue;
      const id = BASE_ID[kind] + i;
      if (kind === "reading") {
        if (i === 0 && (state.log[today] ?? 0) >= state.goalMinutes * 60) continue;
        out.push({ id, at, kind });
      } else {
        const count = pagesDue(state.hifdh, state.verses, day);
        if (count > 0) out.push({ id, at, kind, count });
      }
    }
  }
  return out;
}
