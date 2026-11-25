// The thin edge of sync that the rest of the app touches: a local write tells
// sync something changed (and stamps a synced setting), and sync's own writes
// are announced so screens read their keys again. Nothing here loads the
// sync engine itself.

/** Settings that mean the same on every device. Display settings (theme,
 *  fonts, interface scale), the reciter (the desktop and app lists differ),
 *  reminders and view state stay per device. */
export const SYNCED_PREFS: readonly string[] = [
  "qv.lang",
  "qv.edition",
  "qv.reading.goal",
  "qv.khatam",
  "qv.hifdh.quota",
  "qv.lastRead.count",
  "qv.reader.tajweed",
  "qv.reader.infoLang",
  "qv.reader.glossLang",
];
/** When each synced setting was last changed here (ms), keyed by its key. */
export const SYNC_STAMPS_KEY = "qv.sync.stamps";
/** Changes worth a sync soon. Reading time and last-read places change all
 *  the time while reading; they travel with the next sync. */
const PROMPT_KEYS = new Set(["qv.marks", "qv.hifdh", "qv.hifdh.log", ...SYNCED_PREFS]);

export function readStamps(): Record<string, number> {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(SYNC_STAMPS_KEY) ?? "{}");
    return raw && typeof raw === "object" ? (raw as Record<string, number>) : {};
  } catch {
    return {};
  }
}

const changeListeners = new Set<(key: string) => void>();

/** A synced key was written by the learner's action on this device. */
export function noteLocalChange(key: string, now = Date.now()): void {
  if (SYNCED_PREFS.includes(key))
    try {
      window.localStorage.setItem(
        SYNC_STAMPS_KEY,
        JSON.stringify({ ...readStamps(), [key]: now }),
      );
    } catch {
      /* ignore (quota / private mode) */
    }
  if (PROMPT_KEYS.has(key)) changeListeners.forEach((fn) => fn(key));
}

export function onLocalChange(fn: (key: string) => void): () => void {
  changeListeners.add(fn);
  return () => void changeListeners.delete(fn);
}

const SYNC_EVENT = "qv-sync";

/** Sync wrote these keys: anything holding them in memory reads them again. */
export function announceSyncApplied(keys: string[]): void {
  window.dispatchEvent(new CustomEvent<string[]>(SYNC_EVENT, { detail: keys }));
}

export function onSyncApplied(fn: (keys: string[]) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<string[]>).detail ?? []);
  window.addEventListener(SYNC_EVENT, handler);
  return () => window.removeEventListener(SYNC_EVENT, handler);
}
