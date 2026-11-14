import { beforeEach, expect, it, vi } from "vitest";

// The device behind the store: a map of paths to sizes (or text), transfers
// that stay in flight until the test lets them land, and two volumes.
const dev = vi.hoisted(() => ({
  files: new Map<string, number | string>(),
  inFlight: [] as { path: string; land: () => void; fail: () => void }[],
  /** Copying a file of this name fails. */
  badCopy: "",
}));
const INTERNAL = "file:///int/audio/yasser";
const CARD = "file:///card/audio/yasser";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, convertFileSrc: (s: string) => s },
  registerPlugin: () => ({
    volumes: async () => ({
      volumes: [
        { id: "internal", uri: "file:///int", removable: false, free: 1e12, total: 1e12 },
        { id: "/card", uri: "file:///card", removable: true, free: 1e12, total: 1e12 },
      ],
    }),
  }),
}));
vi.mock("@capacitor/filesystem", () => {
  const need = (path: string) => {
    const v = dev.files.get(path);
    if (v === undefined) throw new Error(`no ${path}`);
    return v;
  };
  return {
    Encoding: { UTF8: "utf8" },
    Directory: { Data: "DATA" },
    Filesystem: {
      readFile: async ({ path }: { path: string }) => ({ data: need(path) }),
      writeFile: async ({ path, data }: { path: string; data: string }) =>
        void dev.files.set(path, data),
      stat: async ({ path }: { path: string }) => {
        const v = need(path);
        return { size: typeof v === "number" ? v : v.length };
      },
      mkdir: async () => undefined,
      rmdir: async () => undefined,
      deleteFile: async ({ path }: { path: string }) => void dev.files.delete(path),
      rename: async ({ from, to }: { from: string; to: string }) => {
        dev.files.set(to, need(from));
        dev.files.delete(from);
      },
      copy: async ({ from, to }: { from: string; to: string }) => {
        if (dev.badCopy && from.endsWith(dev.badCopy)) throw new Error(dev.badCopy);
        dev.files.set(to, need(from));
      },
      readdir: async ({ path }: { path: string }) => ({
        files: [...dev.files]
          .filter(([p]) => p.startsWith(`${path}/`))
          .map(([p, v]) => ({
            name: p.slice(path.length + 1),
            type: "file",
            size: typeof v === "number" ? v : v.length,
          })),
      }),
    },
  };
});
vi.mock("@capacitor/file-transfer", () => ({
  FileTransfer: {
    downloadFile: ({ path }: { path: string }) =>
      new Promise<void>((resolve, reject) =>
        dev.inFlight.push({
          path,
          land: () => {
            dev.files.set(path, 5000);
            resolve();
          },
          fail: () => reject(new Error("network")),
        }),
      ),
  },
}));

const settle = async () => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
};
const flying = () => dev.inFlight.map((t) => t.path.split("/").pop());
const landAll = () => dev.inFlight.splice(0).forEach((t) => t.land());
const job = (surah: number, ayahCount: number) => ({
  surah,
  ayahCount,
  hasBismillah: true,
});
// A fresh store per test (its state is module-wide). "yasser" has no word
// timings, so nothing is fetched besides the audio.
const store = () => import("./audioStore");

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  dev.files.clear();
  dev.inFlight.length = 0;
  dev.badCopy = "";
});

it("starts a surah asked for while a cancelled one is still landing", async () => {
  const a = await store();
  a.downloadSurahs("yasser", [job(112, 4)]);
  await settle();
  expect(flying()).toHaveLength(4);
  a.cancelDownloads();
  a.downloadSurahs("yasser", [job(113, 5)]);
  await settle();
  landAll();
  await settle();
  expect(flying().some((n) => n?.startsWith("113"))).toBe(true);
});

it("never downloads a file twice when retrying after a failure", async () => {
  const a = await store();
  a.downloadSurahs("yasser", [job(2, 286)]);
  await settle();
  dev.inFlight.shift()!.fail();
  await settle();
  // Three files are still on their way: the retry must not start them again.
  a.downloadSurahs("yasser", [job(2, 286)]);
  await settle();
  expect(new Set(flying()).size).toBe(flying().length);
  landAll();
  await settle();
  // Once they have landed, a retry fetches what is missing.
  a.downloadSurahs("yasser", [job(2, 286)]);
  await settle();
  expect(flying()).toContain("001001.mp3.part");
  expect(new Set(flying()).size).toBe(flying().length);
});

it("leaves the audio where it was when a move fails, and finishes on a retry", async () => {
  const names = ["001001.mp3", "001002.mp3", "surahs.json"];
  for (const n of names)
    dev.files.set(`${INTERNAL}/${n}`, n.endsWith("json") ? "{}" : 5000);
  const a = await store();

  dev.badCopy = "001002.mp3";
  await a.moveAudioTo("/card");
  for (const n of names) expect(dev.files.has(`${INTERNAL}/${n}`)).toBe(true);
  expect(localStorage.getItem("qv.audio.location")).toBeNull();

  dev.badCopy = "";
  await a.moveAudioTo("/card");
  for (const n of names) {
    expect(dev.files.has(`${CARD}/${n}`)).toBe(true);
    expect(dev.files.has(`${INTERNAL}/${n}`)).toBe(false);
  }
  expect(localStorage.getItem("qv.audio.location")).toBe("/card");
});
