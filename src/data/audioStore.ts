// Recitation audio on the device (Android app only).
//
// The browser build plays the files fetch_audio.py put in `audio/`; the APK
// ships without them. Instead the learner downloads a surah at a time from
// everyayah.com into the app's own storage (Directory.Data/audio/<reciter>/
// SSSAAA.mp3, the same layout), and playback is offline from then on. Each
// reciter folder keeps `surahs.json`: surah number → bytes on disk, written
// only once every file of that surah is in place.
//
// One queue for the whole app: the reader and its player sheet read the same
// state through useAudioDownloads().

import { useEffect, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import {
  RECITER_INFO,
  audioFileName,
  surahAudioFiles,
  type ReciterId,
} from "./recitation";

/** Running inside the Android app (audio comes from device storage). */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

const DIR = Directory.Data;
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
}

let state: AudioDownloads = { downloaded: {}, queue: [], active: null, error: null };
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

const folder = (reciter: string) => `audio/${reciter}`;
const manifestPath = (reciter: string) => `${folder(reciter)}/surahs.json`;

const loading = new Map<string, Promise<Record<number, number>>>();
function loadManifest(reciter: string): Promise<Record<number, number>> {
  const have = state.downloaded[reciter];
  if (have) return Promise.resolve(have);
  let p = loading.get(reciter);
  if (!p) {
    p = Filesystem.readFile({
      path: manifestPath(reciter),
      directory: DIR,
      encoding: Encoding.UTF8,
    })
      .then((f) => JSON.parse(String(f.data)) as Record<number, number>)
      .catch(() => ({}))
      .then((m) => {
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
    path: manifestPath(reciter),
    directory: DIR,
    data: JSON.stringify(m),
    encoding: Encoding.UTF8,
    recursive: true,
  });
  update({ downloaded: { ...state.downloaded, [reciter]: m } });
}

let base: Promise<string> | null = null;
/** The URL the WebView can play device files from: `<…>/audio/`. */
export function nativeAudioBase(): Promise<string> {
  base ??= Filesystem.getUri({ directory: DIR, path: "audio" }).then(
    ({ uri }) => `${Capacitor.convertFileSrc(uri).replace(/\/$/, "")}/`,
  );
  return base;
}

async function sizeOf(path: string): Promise<number> {
  try {
    return (await Filesystem.stat({ path, directory: DIR })).size;
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
  const { uri } = await Filesystem.getUri({ path: part, directory: DIR });
  await FileTransfer.downloadFile({
    url: RECITER_INFO[reciter].source + name,
    path: uri,
    connectTimeout: 15_000,
    readTimeout: 30_000,
  });
  const got = await sizeOf(part);
  if (got < MIN_BYTES) throw new Error(name);
  // A short leftover would block the rename.
  if (have > 0)
    await Filesystem.deleteFile({ path, directory: DIR }).catch(() => undefined);
  await Filesystem.rename({ from: part, to: path, directory: DIR, toDirectory: DIR });
  return got;
}

let stopRequested = false;
let running = false;

async function run() {
  if (running) return;
  running = true;
  try {
    while (state.queue.length > 0) {
      const [{ reciter, job }, ...rest] = state.queue;
      const files = surahAudioFiles(job.surah, job.ayahCount, job.hasBismillah);
      update({
        queue: rest,
        error: null,
        active: { reciter, surah: job.surah, done: 0, total: files.length },
      });
      stopRequested = false;
      await Filesystem.mkdir({
        path: folder(reciter),
        directory: DIR,
        recursive: true,
      }).catch(() => undefined);
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
      const m = await loadManifest(reciter);
      await saveManifest(reciter, { ...m, [job.surah]: bytes });
    }
  } finally {
    running = false;
    update({ active: null });
  }
}

/** Queue surahs for download (ones already on the device or queued are skipped). */
export function downloadSurahs(reciter: ReciterId, jobs: SurahJob[]): void {
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
  await Filesystem.rmdir({
    path: folder(reciter),
    directory: DIR,
    recursive: true,
  }).catch(() => undefined);
  update({ downloaded: { ...state.downloaded, [reciter]: {} } });
}

/** The shared download state; loads the given reciters' manifests (Android only). */
export function useAudioDownloads(reciters: readonly string[]): AudioDownloads {
  const s = useSyncExternalStore(subscribe, () => state);
  const key = reciters.join(",");
  useEffect(() => {
    if (!isNativeApp()) return;
    for (const r of key.split(",")) void loadManifest(r);
  }, [key]);
  return s;
}
