// Recitation audio on the device (Android app only).
//
// The browser build plays the files fetch_audio.py put in `audio/`; the APK
// ships without them. Instead the learner downloads a surah at a time from
// everyayah.com into the app's own storage (`<volume>/audio/<reciter>/
// SSSAAA.mp3`, the same layout), and playback is offline from then on. Each
// reciter folder keeps `surahs.json`: surah number → bytes on disk, written
// only once every file of that surah is in place.
//
// The volume is the app's internal storage or its folder on an SD card, as
// listed by the in-app AudioStorage plugin (android/…/AudioStoragePlugin.java);
// the choice persists as `qv.audio.location`. Paths are absolute file:// URIs,
// which the Filesystem and FileTransfer plugins accept without a `directory`.
//
// Reciters with word timings also get `words-<surah>.json` (from the
// project's repository, see tafsirStore's REMOTE_DATA) next to the audio, so
// the word being recited lights up offline.
//
// One store for the whole app: the reader and its player sheet read the same
// state through useAudioDownloads().

import { useEffect, useSyncExternalStore } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Encoding, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import {
  RECITERS,
  RECITER_INFO,
  audioFileName,
  surahAudioFiles,
  type ReciterId,
} from "./recitation";
import { REMOTE_DATA } from "./tafsirStore";
import { TIMED_RECITERS, timingsPath, type SurahTimings } from "./wordTimings";

/** Running inside the Android app (audio comes from device storage). */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** A place the app may keep audio. */
export interface AudioVolume {
  /** "internal", the SD card folder's path, or the chosen folder's path. */
  id: string;
  /** file:// URI of the app's folder on that volume (or of the chosen folder). */
  uri: string;
  /** A folder the learner chose: reciter folders sit directly inside it. */
  custom?: boolean;
  removable: boolean;
  free: number;
  total: number;
}

interface AudioStoragePlugin {
  volumes(): Promise<{ volumes: AudioVolume[] }>;
  /** Whether "All files access" is granted. */
  access(): Promise<{ granted: boolean }>;
  /** Open the system screen that grants it. */
  requestAccess(): Promise<void>;
  /** The system folder picker; rejects with "cancelled" or "unsupported". */
  pickFolder(): Promise<{ path: string }>;
  /** A chosen folder as a volume. */
  folder(o: { path: string }): Promise<AudioVolume & { writable: boolean }>;
}
const AudioStorage = registerPlugin<AudioStoragePlugin>("AudioStorage");

const LOCATION_KEY = "qv.audio.location";
/** Smaller than any real ayah file; anything below it is a failed download. */
const MIN_BYTES = 2048;
const PARALLEL = 4;

export interface SurahJob {
  surah: number;
  ayahCount: number;
  hasBismillah: boolean;
}

export interface AudioDownloads {
  /** reciter → surah → bytes on disk; a reciter is absent until loaded. */
  downloaded: Partial<Record<string, Record<number, number>>>;
  /** Surahs waiting after the active one. */
  queue: { reciter: ReciterId; job: SurahJob }[];
  active: { reciter: ReciterId; surah: number; done: number; total: number } | null;
  /** The file a download stopped at, until the next download starts. */
  error: string | null;
  /** Where audio can go (internal first), and where it goes now. */
  volumes: AudioVolume[];
  location: AudioVolume | null;
  /** The chosen SD card isn't there, so internal storage is in use. */
  cardMissing: boolean;
  /** URL the WebView plays device files from: `<…>/audio/`. */
  base: string | null;
  /** Moving downloaded files to another volume. */
  moving: { done: number; total: number } | null;
  /** Why the last move failed ("space", or a file name). */
  moveError: string | null;
}

let state: AudioDownloads = {
  downloaded: {},
  queue: [],
  active: null,
  error: null,
  volumes: [],
  location: null,
  cardMissing: false,
  base: null,
  moving: null,
  moveError: null,
};
const listeners = new Set<() => void>();
function update(patch: Partial<AudioDownloads>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function readLocation(): string | null {
  try {
    return localStorage.getItem(LOCATION_KEY);
  } catch {
    return null;
  }
}
function writeLocation(id: string) {
  try {
    localStorage.setItem(LOCATION_KEY, id);
  } catch {
    // Private mode or storage off: the choice lasts this session only.
  }
}

const audioDir = (v: AudioVolume) =>
  v.custom ? v.uri.replace(/\/$/, "") : `${v.uri.replace(/\/$/, "")}/audio`;
const folderIn = (v: AudioVolume, reciter: string) => `${audioDir(v)}/${reciter}`;
function folder(reciter: string): string {
  if (!state.location) throw new Error("storage");
  return folderIn(state.location, reciter);
}

/** Point the store at a volume: new base URL, manifests read afresh. */
function selectVolume(v: AudioVolume, cardMissing = false) {
  loading.clear();
  update({
    location: v,
    cardMissing,
    downloaded: {},
    base: `${Capacitor.convertFileSrc(audioDir(v))}/`,
  });
}

let ready: Promise<void> | null = null;
/** List the volumes and settle on the stored one (internal if it's gone). */
function init(): Promise<void> {
  ready ??= AudioStorage.volumes()
    .then(async ({ volumes }) => {
      const internal = volumes.find((v) => v.id === "internal") ?? volumes[0];
      const want = readLocation();
      let chosen = volumes.find((v) => v.id === want);
      // A folder the learner chose: usable while it exists and can be written
      // (the card is in, "All files access" still granted).
      if (!chosen && want?.startsWith("/")) chosen = await customFolder(want);
      update({ volumes });
      if (internal)
        selectVolume(chosen ?? internal, !!want && want !== "internal" && !chosen);
    })
    .catch(() => {
      // An APK without the plugin: nothing to offer.
      update({ volumes: [] });
    });
  return ready;
}

async function customFolder(path: string): Promise<AudioVolume | undefined> {
  try {
    const v = await AudioStorage.folder({ path });
    return v.writable ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Whether Android lets the app write to any folder ("All files access"). */
export async function hasFolderAccess(): Promise<boolean> {
  try {
    return (await AudioStorage.access()).granted;
  } catch {
    return false;
  }
}

/** Open the system screen where the learner grants that access. */
export async function requestFolderAccess(): Promise<void> {
  await AudioStorage.requestAccess();
}

/**
 * Let the learner pick a folder and move the audio there. Resolves to what
 * happened: "moved", "cancelled", "unsupported" (a folder from another
 * provider, such as a cloud drive) or "unwritable".
 */
export async function chooseAudioFolder(): Promise<
  "moved" | "cancelled" | "unsupported" | "unwritable"
> {
  let path: string;
  try {
    path = (await AudioStorage.pickFolder()).path;
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return why.includes("unsupported") ? "unsupported" : "cancelled";
  }
  const v = await customFolder(path);
  if (!v) return "unwritable";
  await moveAudioTo(v);
  return "moved";
}

/** Ask Android again (a card inserted or removed while the app runs). */
export async function refreshVolumes(): Promise<void> {
  try {
    const { volumes } = await AudioStorage.volumes();
    const now = state.location?.custom
      ? await customFolder(state.location.id)
      : volumes.find((v) => v.id === state.location?.id);
    update({
      volumes,
      // Free space changes as files are written; keep the figures current.
      location: now ?? state.location,
    });
    const want = readLocation();
    const card =
      volumes.find((v) => v.id === want) ??
      (state.cardMissing && want?.startsWith("/") ? await customFolder(want) : undefined);
    if (state.cardMissing && card) selectVolume(card);
  } catch {
    // Keep what we had.
  }
}

const loading = new Map<string, Promise<Record<number, number>>>();
async function loadManifest(reciter: string): Promise<Record<number, number>> {
  await init();
  const have = state.downloaded[reciter];
  if (have) return have;
  let p = loading.get(reciter);
  if (!p) {
    const at = state.location;
    p = Filesystem.readFile({
      path: `${folder(reciter)}/surahs.json`,
      encoding: Encoding.UTF8,
    })
      .then((f) => JSON.parse(String(f.data)) as Record<number, number>)
      .catch(() => ({}))
      .then((m) => {
        // Ignore a read that finished after the volume changed.
        if (state.location === at)
          update({ downloaded: { ...state.downloaded, [reciter]: m } });
        loading.delete(reciter);
        return m;
      });
    loading.set(reciter, p);
  }
  return p;
}

async function saveManifest(reciter: string, m: Record<number, number>) {
  await Filesystem.writeFile({
    path: `${folder(reciter)}/surahs.json`,
    data: JSON.stringify(m),
    encoding: Encoding.UTF8,
    recursive: true,
  });
  update({ downloaded: { ...state.downloaded, [reciter]: m } });
}

async function sizeOf(path: string): Promise<number> {
  try {
    return (await Filesystem.stat({ path })).size;
  } catch {
    return 0;
  }
}

/** Download one file to `<name>.part`, then move it into place, so an
 *  interrupted download never leaves a short file that looks finished. */
async function fetchFile(reciter: ReciterId, name: string): Promise<number> {
  const path = `${folder(reciter)}/${name}`;
  const have = await sizeOf(path);
  if (have >= MIN_BYTES) return have;
  const part = `${path}.part`;
  await FileTransfer.downloadFile({
    url: RECITER_INFO[reciter].source + name,
    path: part,
    connectTimeout: 15_000,
    readTimeout: 30_000,
  });
  const got = await sizeOf(part);
  if (got < MIN_BYTES) throw new Error(name);
  // A short leftover would block the rename.
  if (have > 0) await Filesystem.deleteFile({ path }).catch(() => undefined);
  await Filesystem.rename({ from: part, to: path });
  return got;
}

/** A surah's word timings from the device, downloading the small file
 *  first if it isn't there (surahs downloaded before timings existed). Read
 *  and written through Filesystem, not the WebView's file server. Null for
 *  reciters without timings or when it can't be had. */
export async function deviceTimings(
  reciter: string,
  surah: number,
): Promise<SurahTimings | null> {
  if (!TIMED_RECITERS.has(reciter)) return null;
  try {
    await init();
    const path = `${folder(reciter)}/words-${surah}.json`;
    try {
      const { data } = await Filesystem.readFile({ path, encoding: Encoding.UTF8 });
      const d = JSON.parse(
        typeof data === "string" ? data : await data.text(),
      ) as unknown;
      if (Array.isArray(d)) return d as SurahTimings;
    } catch {
      // Not there yet (or unreadable): fetch it below.
    }
    const res = await fetch(REMOTE_DATA + timingsPath(reciter, surah));
    if (!res.ok) return null;
    const text = await res.text();
    const d = JSON.parse(text) as unknown;
    if (!Array.isArray(d)) return null;
    await Filesystem.writeFile({
      path,
      data: text,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return d as SurahTimings;
  } catch {
    return null;
  }
}

let stopRequested = false;
let running = false;

async function run() {
  if (running) return;
  running = true;
  try {
    while (state.queue.length > 0 && !state.moving) {
      const [{ reciter, job }, ...rest] = state.queue;
      const files = surahAudioFiles(job.surah, job.ayahCount, job.hasBismillah);
      update({
        queue: rest,
        error: null,
        active: { reciter, surah: job.surah, done: 0, total: files.length },
      });
      stopRequested = false;
      await Filesystem.mkdir({ path: folder(reciter), recursive: true }).catch(
        () => undefined,
      );
      const todo = [...files];
      let bytes = 0;
      let done = 0;
      const worker = async () => {
        for (let name = todo.shift(); name; name = todo.shift()) {
          if (stopRequested) return;
          const size = await fetchFile(reciter, name);
          // The shared basmalah file counts toward surah 1 only.
          if (name !== audioFileName(1, 1) || job.surah === 1) bytes += size;
          done += 1;
          if (state.active) update({ active: { ...state.active, done } });
        }
      };
      try {
        await Promise.all(Array.from({ length: PARALLEL }, worker));
      } catch (e) {
        stopRequested = true;
        update({ error: e instanceof Error ? e.message : String(e), queue: [] });
        break;
      }
      if (stopRequested) break;
      // Word timings ride along; without them the audio still plays.
      await deviceTimings(reciter, job.surah);
      const m = await loadManifest(reciter);
      await saveManifest(reciter, { ...m, [job.surah]: bytes });
    }
  } finally {
    running = false;
    update({ active: null });
    void refreshVolumes();
  }
}

/** Queue surahs for download (ones already on the device or queued are skipped). */
export function downloadSurahs(reciter: ReciterId, jobs: SurahJob[]): void {
  if (state.moving) return;
  void loadManifest(reciter).then((have) => {
    const waiting = (s: number) =>
      (state.active?.reciter === reciter && state.active.surah === s) ||
      state.queue.some((q) => q.reciter === reciter && q.job.surah === s);
    const add = jobs.filter((j) => !have[j.surah] && !waiting(j.surah));
    if (add.length === 0) return;
    update({ queue: [...state.queue, ...add.map((job) => ({ reciter, job }))] });
    void run();
  });
}

/** Stop after the files in flight; finished surahs stay. */
export function cancelDownloads(): void {
  stopRequested = true;
  update({ queue: [] });
}

/** Delete every downloaded file of a reciter. */
export async function deleteReciterAudio(reciter: ReciterId): Promise<void> {
  if (state.active?.reciter === reciter) cancelDownloads();
  await Filesystem.rmdir({ path: folder(reciter), recursive: true }).catch(
    () => undefined,
  );
  update({ downloaded: { ...state.downloaded, [reciter]: {} } });
  void refreshVolumes();
}

/** Files under `dir` (name and size); none when it doesn't exist. */
async function listFiles(dir: string): Promise<{ name: string; size: number }[]> {
  try {
    const { files } = await Filesystem.readdir({ path: dir });
    return files
      .filter((f) => f.type === "file")
      .map((f) => ({ name: f.name, size: f.size }));
  } catch {
    return [];
  }
}

/**
 * Keep audio on another volume from now on, moving what is already
 * downloaded (copy, then delete the original, file by file). Downloads stop
 * first. If the target is short of space nothing is moved.
 */
export async function moveAudioTo(target: string | AudioVolume): Promise<void> {
  await init();
  const from = state.location;
  const to =
    typeof target === "string" ? state.volumes.find((v) => v.id === target) : target;
  if (!to || !from || to.id === from.id || state.moving) return;
  cancelDownloads();
  // Wait for the files in flight to land.
  while (running) await new Promise((r) => setTimeout(r, 200));

  // From a card that has gone missing there is nothing to copy: just switch.
  const plan: { reciter: string; files: { name: string; size: number }[] }[] = [];
  if (!state.cardMissing)
    for (const r of RECITERS) {
      const files = await listFiles(folderIn(from, r));
      if (files.length) plan.push({ reciter: r, files });
    }
  const total = plan.reduce((n, p) => n + p.files.length, 0);
  const bytes = plan.reduce((n, p) => n + p.files.reduce((m, f) => m + f.size, 0), 0);
  if (bytes > to.free) {
    update({ moveError: "space" });
    return;
  }
  update({ moving: { done: 0, total }, moveError: null });
  let done = 0;
  try {
    for (const { reciter, files } of plan) {
      const src = folderIn(from, reciter);
      const dst = folderIn(to, reciter);
      await Filesystem.mkdir({ path: dst, recursive: true }).catch(() => undefined);
      for (const f of files) {
        // Unfinished downloads aren't worth carrying over.
        if (f.name.endsWith(".part")) {
          await Filesystem.deleteFile({ path: `${src}/${f.name}` }).catch(
            () => undefined,
          );
        } else {
          await Filesystem.copy({ from: `${src}/${f.name}`, to: `${dst}/${f.name}` });
          await Filesystem.deleteFile({ path: `${src}/${f.name}` });
        }
        done += 1;
        update({ moving: { done, total } });
      }
    }
    // Tidy up the emptied folders, never anything else that sits beside them.
    if (!state.cardMissing) {
      for (const { reciter } of plan)
        await Filesystem.rmdir({ path: folderIn(from, reciter) }).catch(() => undefined);
      if (!from.custom)
        await Filesystem.rmdir({ path: audioDir(from) }).catch(() => undefined);
    }
  } catch (e) {
    // Files copied so far stay at the target; the rest stay where they were.
    // Point at the target anyway only if everything got there.
    update({ moving: null, moveError: e instanceof Error ? e.message : String(e) });
    void refreshVolumes();
    return;
  }
  writeLocation(to.id);
  selectVolume(to);
  update({ moving: null });
  void refreshVolumes();
}

/** The shared download state; loads the given reciters' manifests (Android only). */
export function useAudioDownloads(reciters: readonly string[]): AudioDownloads {
  const s = useSyncExternalStore(subscribe, () => state);
  const key = reciters.join(",");
  const at = s.location?.id;
  useEffect(() => {
    if (!isNativeApp()) return;
    for (const r of key.split(",")) void loadManifest(r);
  }, [key, at]);
  return s;
}
