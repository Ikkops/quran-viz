// Tafsir editions the Android app downloads instead of shipping.
//
// The editions flagged `download` in editions.ts are left out of the APK
// (vite.config.ts, `--mode android`). In the app the learner downloads one
// once, from the project's public GitHub repository (the same files as
// `public/data`), into the app's private storage at `<Data>/data/<path>`.
// `downloads.json` there maps edition id → bytes and is written only once
// every file is in place, so a half-finished download never counts.
//
// In the browser build nothing here is used: those files are served with the
// rest of `data/`.

import { useEffect, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { dataUrl } from "./base";
import { TAFSIR_EDITIONS, tafsirFiles, type TafsirEdition } from "./editions";

/** Where the app downloads tafsir files from: `public/data` on main. */
export const REMOTE_DATA =
  "https://raw.githubusercontent.com/Ikkops/quran-viz/main/public/data/";
const PARALLEL = 4;

const isNative = (): boolean => Capacitor.isNativePlatform();

/** An edition the Android app keeps out of the APK. */
export function downloadable(ed: TafsirEdition): boolean {
  return !!ed.download && isNative();
}

export interface TafsirDownloads {
  /** Edition id → bytes on the device; null until read. */
  have: Record<string, number> | null;
  active: { id: string; done: number; total: number } | null;
  /** The edition whose download last stopped, until the next one starts. */
  failed: string | null;
}

let state: TafsirDownloads = { have: null, active: null, failed: null };
const listeners = new Set<() => void>();
function update(patch: Partial<TafsirDownloads>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

let root: Promise<string> | null = null;
/** file:// URI of `<Data>/data`, without a trailing slash. */
function rootUri(): Promise<string> {
  root ??= Filesystem.getUri({ directory: Directory.Data, path: "data" }).then((r) =>
    r.uri.replace(/\/$/, ""),
  );
  return root;
}

let reading: Promise<Record<string, number>> | null = null;
function loadManifest(): Promise<Record<string, number>> {
  if (state.have) return Promise.resolve(state.have);
  reading ??= rootUri()
    .then((dir) =>
      Filesystem.readFile({ path: `${dir}/downloads.json`, encoding: Encoding.UTF8 }),
    )
    .then((f) => JSON.parse(String(f.data)) as Record<string, number>)
    .catch(() => ({}))
    .then((m) => {
      update({ have: m });
      return m;
    });
  return reading;
}

async function saveManifest(m: Record<string, number>) {
  await Filesystem.writeFile({
    path: `${await rootUri()}/downloads.json`,
    data: JSON.stringify(m),
    encoding: Encoding.UTF8,
    recursive: true,
  });
  update({ have: m });
}

/** The edition a data path belongs to, if the app downloads it. */
function editionOf(path: string): TafsirEdition | undefined {
  return TAFSIR_EDITIONS.find(
    (t) =>
      t.download &&
      (t.kind === "ayah"
        ? path === `translations/${t.id}.json`
        : path.startsWith(`tafsir/${t.id}/`)),
  );
}

/** URL to fetch a data file from: the device copy for a downloaded edition
 *  in the app, otherwise the bundled file. */
export async function dataFileUrl(path: string): Promise<string> {
  if (!isNative() || !editionOf(path)) return dataUrl(path);
  return Capacitor.convertFileSrc(`${await rootUri()}/${path}`);
}

async function sizeOf(path: string): Promise<number> {
  try {
    return (await Filesystem.stat({ path })).size;
  } catch {
    return 0;
  }
}

/** One file to `<name>.part`, then into place (kept if already there). */
async function fetchFile(dir: string, path: string): Promise<number> {
  const target = `${dir}/${path}`;
  const have = await sizeOf(target);
  if (have > 0) return have;
  const part = `${target}.part`;
  await FileTransfer.downloadFile({
    url: REMOTE_DATA + path,
    path: part,
    connectTimeout: 15_000,
    readTimeout: 30_000,
  });
  const got = await sizeOf(part);
  if (got === 0) throw new Error(path);
  await Filesystem.rename({ from: part, to: target });
  return got;
}

let stopRequested = false;

/** Download every file of an edition; one edition at a time. */
export async function downloadTafsir(id: string): Promise<void> {
  const ed = TAFSIR_EDITIONS.find((t) => t.id === id);
  if (!ed?.download || state.active) return;
  const have = await loadManifest();
  if (have[id]) return;
  const files = tafsirFiles(ed);
  stopRequested = false;
  update({ active: { id, done: 0, total: files.length }, failed: null });
  try {
    const dir = await rootUri();
    const folders = new Set(files.map((f) => f.slice(0, f.lastIndexOf("/"))));
    for (const f of folders)
      await Filesystem.mkdir({ path: `${dir}/${f}`, recursive: true }).catch(
        () => undefined,
      );
    const todo = [...files];
    let bytes = 0;
    let done = 0;
    const worker = async () => {
      for (let f = todo.shift(); f; f = todo.shift()) {
        if (stopRequested) return;
        bytes += await fetchFile(dir, f);
        done += 1;
        update({ active: { id, done, total: files.length } });
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    if (!stopRequested) await saveManifest({ ...(await loadManifest()), [id]: bytes });
  } catch {
    stopRequested = true;
    update({ failed: id });
  } finally {
    update({ active: null });
  }
}

/** Stop after the files in flight; what arrived is kept for the next try. */
export function cancelTafsirDownload(): void {
  stopRequested = true;
}

/** Delete an edition's files from the device. */
export async function deleteTafsir(id: string): Promise<void> {
  const ed = TAFSIR_EDITIONS.find((t) => t.id === id);
  if (!ed?.download) return;
  if (state.active?.id === id) cancelTafsirDownload();
  const dir = await rootUri();
  if (ed.kind === "ayah")
    await Filesystem.deleteFile({ path: `${dir}/translations/${id}.json` }).catch(
      () => undefined,
    );
  else
    await Filesystem.rmdir({ path: `${dir}/tafsir/${id}`, recursive: true }).catch(
      () => undefined,
    );
  const rest = { ...(await loadManifest()) };
  delete rest[id];
  await saveManifest(rest);
}

/** The download state; reads what is on the device the first time. */
export function useTafsirDownloads(): TafsirDownloads {
  useEffect(() => {
    if (isNative()) void loadManifest();
  }, []);
  return useSyncExternalStore(subscribe, () => state);
}

/** Whether an edition still has to be downloaded before it can be read. */
export function needsDownload(ed: TafsirEdition, s: TafsirDownloads): boolean {
  return downloadable(ed) && !s.have?.[ed.id];
}
