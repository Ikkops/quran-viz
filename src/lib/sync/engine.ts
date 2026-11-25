import { useSyncExternalStore } from "react";
import { sanitizeReadingByDevice, sanitizeReadingLog } from "../../data/readingLog";
import { HIFDH_KEY, sanitizeHifdh } from "../hifdh";
import { LAST_READ_KEY, sanitizeLastRead } from "../lastRead";
import { MARKS_KEY, sanitizeMarks } from "../marks";
import { READING_LOG_KEY, READING_OTHERS_KEY } from "../readingStore";
import { REVIEW_LOG_KEY, sanitizeReviewLog } from "../reviewLog";
import {
  SYNCED_PREFS,
  SYNC_STAMPS_KEY,
  announceSyncApplied,
  onLocalChange,
  readStamps,
} from "./changes";
import { isSealed, seal, unseal, WrongPassphrase } from "./crypto";
import {
  SyncError,
  createGist,
  findGist,
  readGist,
  writeGist,
  type SyncProblem,
} from "./gist";
import { canonical, mergeDocs, sanitizeDoc, type SyncDoc } from "./merge";

// One sync: read the copy in the gist, open it with the passphrase, merge it
// with what this device has, store the result here, and write it back when
// it differs. Runs on launch, when the app comes back to the front, 20 s after
// a change (sooner when the app goes to the background), and on "Sync now".

export const SYNC_CONFIG_KEY = "qv.sync.config";
const SYNC_STATE_KEY = "qv.sync.state";
const DEVICE_KEY = "qv.device";
const SOON_MS = 20_000;

export interface SyncConfig {
  token: string;
  passphrase: string;
  /** Found or created on the first sync. */
  gistId?: string;
}

const read = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};
const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore (quota / private mode) */
  }
};

export function readConfig(): SyncConfig | null {
  const c = read(SYNC_CONFIG_KEY) as Partial<SyncConfig> | undefined;
  return c && typeof c.token === "string" && typeof c.passphrase === "string" && c.token
    ? {
        token: c.token,
        passphrase: c.passphrase,
        ...(typeof c.gistId === "string" ? { gistId: c.gistId } : {}),
      }
    : null;
}

export function saveConfig(c: SyncConfig | null): void {
  if (c) write(SYNC_CONFIG_KEY, c);
  else
    try {
      window.localStorage.removeItem(SYNC_CONFIG_KEY);
    } catch {
      /* ignore */
    }
}

/** This install's id: the key its reading time travels under. */
export function deviceId(): string {
  const id = read(DEVICE_KEY);
  if (typeof id === "string" && id) return id;
  const fresh =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  write(DEVICE_KEY, fresh);
  return fresh;
}

/** Everything this device has that syncs. */
export function collectLocal(device: string): SyncDoc {
  const stamps = readStamps();
  const prefs: SyncDoc["prefs"] = {};
  for (const k of SYNCED_PREFS) {
    const v = read(k);
    if (v !== undefined) prefs[k] = { v, t: stamps[k] ?? 0 };
  }
  return {
    app: "quran-viz",
    v: 1,
    marks: sanitizeMarks(read(MARKS_KEY)),
    hifdh: sanitizeHifdh(read(HIFDH_KEY)),
    log: sanitizeReviewLog(read(REVIEW_LOG_KEY)) ?? [],
    reading: {
      ...sanitizeReadingByDevice(read(READING_OTHERS_KEY)),
      [device]: sanitizeReadingLog(read(READING_LOG_KEY)) ?? {},
    },
    lastRead: sanitizeLastRead(read(LAST_READ_KEY)) ?? [],
    prefs,
  };
}

/** Store a merged copy on this device; returns the keys that changed (and
 *  tells the screens holding them). */
export function applyLocal(doc: SyncDoc, device: string): string[] {
  const changed: string[] = [];
  const put = (key: string, value: unknown) => {
    const cur = read(key);
    // A key this device never had stays unwritten while there's nothing for it.
    const empty = Array.isArray(value)
      ? value.length === 0
      : !!value && typeof value === "object" && Object.keys(value).length === 0;
    if (value === undefined || (cur === undefined && empty)) return;
    if (canonical(cur) === canonical(value)) return;
    write(key, value);
    changed.push(key);
  };
  put(MARKS_KEY, doc.marks);
  put(HIFDH_KEY, doc.hifdh);
  put(REVIEW_LOG_KEY, doc.log);
  put(LAST_READ_KEY, doc.lastRead);
  // This device's own time may have grown since it was collected: keep the larger.
  const own = { ...(sanitizeReadingLog(read(READING_LOG_KEY)) ?? {}) };
  for (const [day, s] of Object.entries(doc.reading[device] ?? {}))
    own[day] = Math.max(own[day] ?? 0, s);
  put(READING_LOG_KEY, own);
  const others = { ...doc.reading };
  delete others[device];
  put(READING_OTHERS_KEY, others);
  const stamps = readStamps();
  let stamped = false;
  for (const [k, p] of Object.entries(doc.prefs))
    if (SYNCED_PREFS.includes(k) && p.t > (stamps[k] ?? -1)) {
      put(k, p.v);
      stamps[k] = p.t;
      stamped = true;
    }
  if (stamped) write(SYNC_STAMPS_KEY, stamps);
  if (changed.length) announceSyncApplied(changed);
  return changed;
}

/** Where the sealed copy is read from and written to. */
export interface Transport {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

/** The learner's sync gist: found by name the first time, created on the
 *  first write when there is none; its id is remembered. */
export function gistTransport(cfg: SyncConfig): Transport {
  let id = cfg.gistId;
  const remember = (gistId: string | undefined) => {
    id = gistId;
    const c = readConfig();
    if (c && c.gistId !== gistId) saveConfig({ ...c, gistId });
  };
  return {
    async read() {
      if (!id) remember((await findGist(cfg.token)) ?? undefined);
      if (!id) return null;
      const text = await readGist(cfg.token, id);
      if (text === null) remember(undefined);
      return text;
    },
    async write(text) {
      if (id) await writeGist(cfg.token, id, text);
      else remember(await createGist(cfg.token, text));
    },
  };
}

/** One full sync through `transport`. */
export async function syncOnce(
  transport: Transport,
  passphrase: string,
  device: string,
  now = Date.now(),
): Promise<{ changedHere: string[]; pushed: boolean }> {
  const text = await transport.read();
  let remote: SyncDoc | null = null;
  let salt: Uint8Array<ArrayBuffer> | undefined;
  if (text) {
    let sealed: unknown;
    try {
      sealed = JSON.parse(text);
    } catch {
      throw new SyncError("format");
    }
    if (!isSealed(sealed)) throw new SyncError("format");
    try {
      const opened = await unseal(sealed, passphrase);
      salt = opened.salt;
      remote = sanitizeDoc(JSON.parse(opened.plain));
    } catch (e) {
      throw new SyncError(e instanceof WrongPassphrase ? "passphrase" : "format");
    }
    if (!remote) throw new SyncError("format");
  }
  const local = collectLocal(device);
  const merged = remote ? mergeDocs(local, remote, now) : local;
  const changedHere = applyLocal(merged, device);
  const pushed = !remote || canonical(merged) !== canonical(remote);
  if (pushed)
    await transport.write(
      JSON.stringify(await seal(JSON.stringify(merged), passphrase, { salt })),
    );
  return { changedHere, pushed };
}

// —— Status, for the settings card ——

export interface SyncStatus {
  state: "off" | "idle" | "syncing" | "error";
  /** When the last sync finished (ms). */
  last?: number;
  problem?: SyncProblem;
}

const lastSync = (): number | undefined => {
  const s = read(SYNC_STATE_KEY) as { last?: unknown } | undefined;
  return typeof s?.last === "number" ? s.last : undefined;
};
let status: SyncStatus = { state: "off" };
const statusListeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  statusListeners.forEach((fn) => fn());
};
const getStatus = () => status;
const subscribeStatus = (fn: () => void) => {
  statusListeners.add(fn);
  return () => void statusListeners.delete(fn);
};

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, getStatus);
}

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Sync now (once more after the current one, if one is running). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  clearTimeout(timer);
  timer = undefined;
  const cfg = readConfig();
  if (!cfg) {
    setStatus({ state: "off" });
    return Promise.resolve();
  }
  setStatus({ state: "syncing", last: lastSync() });
  running = (async () => {
    try {
      await syncOnce(gistTransport(cfg), cfg.passphrase, deviceId());
      const last = Date.now();
      write(SYNC_STATE_KEY, { last });
      setStatus({ state: "idle", last });
    } catch (e) {
      const problem = e instanceof SyncError ? e.problem : "github";
      setStatus({ state: "error", last: lastSync(), problem });
    } finally {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    }
  })();
  return running;
}

/** Stop syncing on this device (its data stays). */
export function stopSync(): void {
  clearTimeout(timer);
  saveConfig(null);
  setStatus({ state: "off" });
}

/** Run sync at the right moments; returns the cleanup. */
export function startSyncTriggers(): () => void {
  if (readConfig()) void syncNow();
  else setStatus({ state: "off", last: lastSync() });
  const soon = () => {
    if (!readConfig()) return;
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), SOON_MS);
  };
  const offChange = onLocalChange(soon);
  const onVisibility = () => {
    if (!readConfig()) return;
    // Back to the front: catch up. To the background with a change waiting:
    // send it now, before the app is frozen.
    if (document.visibilityState === "visible" || timer) void syncNow();
  };
  const onOnline = () => readConfig() && void syncNow();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  return () => {
    offChange();
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
  };
}
