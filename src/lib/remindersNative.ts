import { useEffect, useRef } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useI18n } from "../i18n/I18nContext";
import type { Hifdh, PagedAyah } from "./hifdh";
import { readReadingGoal, readingLog, subscribeReadingLog } from "./readingStore";
import {
  DEFAULT_REMINDERS,
  REMINDERS_KEY,
  REMINDER_IDS,
  nextReminders,
  sanitizeReminders,
} from "./reminders";
import { readPersisted } from "./usePersistentState";

/** One notification, worded in the UI language. */
export interface ReminderNote {
  id: number;
  at: Date;
  title: string;
  body: string;
}

// The plugin is imported on first use, so it stays out of App's chunk.
const plugin = () =>
  import("@capacitor/local-notifications").then((m) => m.LocalNotifications);

/** Ask for the notification permission (Settings, when a reminder is turned
 *  on). False off-native, when denied or on any plugin error. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const ln = await plugin();
    if ((await ln.checkPermissions()).display === "granted") return true;
    return (await ln.requestPermissions()).display === "granted";
  } catch {
    return false;
  }
}

async function sync(notes: readonly ReminderNote[]): Promise<void> {
  try {
    const ln = await plugin();
    await ln.cancel({ notifications: REMINDER_IDS.map((id) => ({ id })) });
    if (!notes.length) return;
    // schedule() would ask for the permission itself; it is only ever asked
    // from Settings (a restored backup on a new device stays silent).
    if ((await ln.checkPermissions()).display !== "granted") return;
    await ln.schedule({
      notifications: notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        // Inexact alarms need no SCHEDULE_EXACT_ALARM; allowWhileIdle is fine without it.
        schedule: { at: n.at, allowWhileIdle: true },
        isExactNotification: false,
        smallIcon: "ic_launcher_monochrome",
      })),
    });
  } catch {
    // A reminder that cannot be scheduled must never break the app.
  }
}

let queue = Promise.resolve();
/** Replace this feature's pending notifications with `notes` (no-op off-native).
 *  Calls run one after another, so a cancel never lands between another
 *  sync's cancel and schedule. */
export function syncReminders(notes: readonly ReminderNote[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  queue = queue.then(() => sync(notes));
  return queue;
}

/** Settings → Reminders changed in this tab (other tabs send `storage`). */
export const REMINDERS_EVENT = "qv-reminders";

/**
 * Keep the reminders scheduled (Android app): on start, on resume, and when
 * the settings, today's goal, the reading log or the hifdh state change.
 * Reading-timer ticks change the log every few seconds, so the plan is
 * recomputed then but synced only when the resulting notifications differ.
 */
export function useReminders(hifdh: Hifdh, verses: readonly PagedAyah[] | undefined) {
  const { t } = useI18n();
  const last = useRef("");
  useEffect(() => {
    // Without the verses the hifdh reminders would look empty: wait for them.
    if (!Capacitor.isNativePlatform() || !verses) return;
    const r = t.settings.reminders;
    const run = (force = false) => {
      const settings = readPersisted(REMINDERS_KEY, DEFAULT_REMINDERS, sanitizeReminders);
      const goalMinutes = readReadingGoal();
      const list = nextReminders(new Date(), settings, {
        goalMinutes,
        log: readingLog(),
        hifdh,
        verses,
      });
      const notes = list.map((x) => ({
        id: x.id,
        at: x.at,
        ...(x.kind === "reading"
          ? { title: r.readingTitle, body: r.readingBody(goalMinutes) }
          : { title: r.hifdhTitle, body: r.hifdhBody(x.count ?? 0) }),
      }));
      const key = JSON.stringify(notes);
      if (!force && key === last.current) return;
      last.current = key;
      void syncReminders(notes);
    };
    run();
    const onChange = () => run();
    const onStorage = (e: StorageEvent) => {
      if (e.key === REMINDERS_KEY || e.key === "qv.reading.goal") run();
    };
    const unsubscribe = subscribeReadingLog(onChange);
    window.addEventListener(REMINDERS_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    // Back in the app: what fired is gone and the day may have changed.
    const resume = CapacitorApp.addListener("resume", () => run(true));
    return () => {
      unsubscribe();
      window.removeEventListener(REMINDERS_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
      void resume.then((l) => l.remove());
    };
  }, [hifdh, verses, t]);
}
