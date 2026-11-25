// One file with everything the app keeps in this device's storage: marks,
// memorisation, the reading log, last-read places and settings. Restoring
// writes the keys back and the app reloads, so every value passes through its
// own sanitizer on the way in.

export const BACKUP_APP = "quran-viz";

/** Where audio is kept is a path on this device; it does not travel. Nor do
 *  sync's token, passphrase and state, or this install's id. */
const SKIP = new Set(["qv.audio.location", "qv.device"]);
const mine = (k: string) =>
  (k.startsWith("qv.") || k === "quranviz.theme") &&
  !SKIP.has(k) &&
  !k.startsWith("qv.sync.");

export interface Backup {
  app: typeof BACKUP_APP;
  version: 1;
  /** The day it was saved (`dayKey`). */
  saved: string;
  data: Record<string, unknown>;
}

type Store = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

const ownKeys = (store: Store): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && mine(k)) keys.push(k);
  }
  return keys.sort();
};

/** Everything of the app's in `store`, parsed (unreadable values are left out). */
export function buildBackup(store: Store, saved: string): Backup {
  const data: Record<string, unknown> = {};
  for (const k of ownKeys(store)) {
    try {
      data[k] = JSON.parse(store.getItem(k) ?? "");
    } catch {
      // Not JSON: nothing the app wrote.
    }
  }
  return { app: BACKUP_APP, version: 1, saved, data };
}

/** The app's keys from a backup file, or null when it is not one. */
export function readBackup(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Backup>;
  if (r.app !== BACKUP_APP || !r.data || typeof r.data !== "object") return null;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r.data)) if (mine(k)) data[k] = v;
  return Object.keys(data).length > 0 ? data : null;
}

/** Replace the app's stored state with `data` (what is not in it is removed). */
export function applyBackup(data: Record<string, unknown>, store: Store): void {
  for (const k of ownKeys(store)) store.removeItem(k);
  for (const [k, v] of Object.entries(data)) store.setItem(k, JSON.stringify(v));
}
