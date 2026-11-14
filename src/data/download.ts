// File downloads in the Android app, shared by audioStore and tafsirStore.

import { Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";

/** Size of the file at `path`; 0 when it isn't there. */
export async function sizeOf(path: string): Promise<number> {
  try {
    return (await Filesystem.stat({ path })).size;
  } catch {
    return 0;
  }
}

/** Download `url` to `<path>.part`, then move it into place, so an
 *  interrupted download never leaves a short file that looks finished. A file
 *  of at least `minBytes` already at `path` is kept. Resolves to its size. */
export async function fetchFile(
  url: string,
  path: string,
  minBytes = 1,
): Promise<number> {
  const have = await sizeOf(path);
  if (have >= minBytes) return have;
  const part = `${path}.part`;
  await FileTransfer.downloadFile({
    url,
    path: part,
    connectTimeout: 15_000,
    readTimeout: 30_000,
  });
  const got = await sizeOf(part);
  if (got < minBytes) throw new Error(path.slice(path.lastIndexOf("/") + 1));
  // A short leftover would block the rename.
  if (have > 0) await Filesystem.deleteFile({ path }).catch(() => undefined);
  await Filesystem.rename({ from: part, to: path });
  return got;
}

/** Run `task` over `items`, `parallel` at a time. No new item starts once
 *  `stopped()` is true or a task has failed. Settles only when every task in
 *  flight has ended (a retry must never meet a transfer still writing), then
 *  rejects with the first failure. */
export async function runPool<T>(
  items: readonly T[],
  parallel: number,
  stopped: () => boolean,
  task: (item: T) => Promise<void>,
): Promise<void> {
  const todo = [...items];
  let failed = false;
  const worker = async () => {
    while (todo.length > 0 && !failed && !stopped()) {
      try {
        await task(todo.shift() as T);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  const ended = await Promise.allSettled(Array.from({ length: parallel }, worker));
  const bad = ended.find((r) => r.status === "rejected");
  if (bad) throw bad.reason;
}
