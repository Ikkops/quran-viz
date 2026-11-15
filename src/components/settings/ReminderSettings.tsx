import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import {
  DEFAULT_REMINDERS,
  REMINDERS_KEY,
  REMINDER_KINDS,
  sanitizeReminders,
  type ReminderKind,
  type ReminderSettings as Settings,
} from "../../lib/reminders";
import { REMINDERS_EVENT, requestReminderPermission } from "../../lib/remindersNative";
import { usePersistentState } from "../../lib/usePersistentState";
import { Toggle } from "../ui";

/** Daily reminders (Android app): reading goal and memorisation review, each
 *  on or off at its own time. The permission is asked when one is turned on. */
export function ReminderSettings() {
  const { t } = useI18n();
  const r = t.settings.reminders;
  const [settings, setSettings] = usePersistentState<Settings>(
    REMINDERS_KEY,
    DEFAULT_REMINDERS,
    sanitizeReminders,
  );
  const [blocked, setBlocked] = useState(false);
  // After usePersistentState's own effect has stored the value: resync.
  useEffect(() => {
    window.dispatchEvent(new Event(REMINDERS_EVENT));
  }, [settings]);

  const set = (k: ReminderKind, part: Partial<Settings[ReminderKind]>) =>
    setSettings((s) => ({ ...s, [k]: { ...s[k], ...part } }));
  const toggle = async (k: ReminderKind, on: boolean) => {
    if (!on) return set(k, { on });
    const granted = await requestReminderPermission();
    setBlocked(!granted);
    if (granted) set(k, { on });
  };

  return (
    <div className="flex flex-col gap-1">
      {REMINDER_KINDS.map((k) => (
        <div key={k} className="flex items-center gap-3">
          <div className="flex-1 [&>button]:w-full">
            <Toggle
              label={r[k]}
              checked={settings[k].on}
              onChange={(on) => void toggle(k, on)}
            />
          </div>
          <input
            type="time"
            aria-label={`${r[k]}: ${r.time}`}
            value={settings[k].time}
            onChange={(e) => e.target.value && set(k, { time: e.target.value })}
            className="min-h-11 rounded border border-line bg-surface px-3 text-sm text-ink"
          />
        </div>
      ))}
      {blocked && (
        <p className="text-sm text-rubric" role="status">
          {r.blocked}
        </p>
      )}
    </div>
  );
}
