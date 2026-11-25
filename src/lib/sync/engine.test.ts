import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyHifdh, setStatus, statusOf, sanitizeHifdh } from "../hifdh";
import {
  addPin,
  initialMarks,
  MARK_COLORS,
  sanitizeMarks,
  toggleInCollection,
} from "../marks";
import { onSyncApplied, SYNC_STAMPS_KEY } from "./changes";
import { applyLocal, collectLocal, syncOnce, type Transport } from "./engine";
import { SyncError } from "./gist";

// Two devices, each with its own storage, and one copy "in the gist".
const memory = () => {
  const t: Transport & { text: string | null; writes: number } = {
    text: null,
    writes: 0,
    async read() {
      return t.text;
    },
    async write(x: string) {
      t.text = x;
      t.writes++;
    },
  };
  return t;
};
const snapshot = () => ({ ...localStorage });
const restore = (s: Record<string, string>) => {
  localStorage.clear();
  for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
};
const set = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const get = (k: string): unknown => JSON.parse(localStorage.getItem(k) ?? "null");

const names = { pin: "Tilawah", collection: "Favourites" };
const T = Date.now();

beforeEach(() => localStorage.clear());

describe("sync between two devices", () => {
  it("brings each device's changes to the other, encrypted on the way", async () => {
    const gist = memory();
    // The phone: a new pin, memorised ayahs, reading time, a reading goal.
    set("qv.marks", addPin(initialMarks(names), "Hafalan", MARK_COLORS[0], 7, T));
    set("qv.hifdh", setStatus(emptyHifdh(), 1, 7, 2, T));
    set("qv.reading.log", { "2026-11-25": 300 });
    set("qv.reading.goal", 20);
    set(SYNC_STAMPS_KEY, { "qv.reading.goal": T });
    await syncOnce(gist, "pw", "phone", T);
    expect(gist.text).not.toContain("Hafalan");
    const phone = snapshot();

    // The desktop, used before sync: its own reading time and a bookmark.
    localStorage.clear();
    set("qv.marks", toggleInCollection(initialMarks(names), "c1", 255, T + 1));
    set("qv.reading.log", { "2026-11-25": 600 });
    set("qv.reading.goal", 5);
    const announced: string[][] = [];
    const off = onSyncApplied((keys) => announced.push(keys));
    await syncOnce(gist, "pw", "desktop", T + 2);
    off();
    const desk = sanitizeMarks(get("qv.marks"))!;
    expect(desk.pins.map((p) => p.name)).toEqual(["Tilawah", "Hafalan"]);
    expect(desk.collections[0].items.map((i) => i.id)).toEqual([255]);
    expect(statusOf(sanitizeHifdh(get("qv.hifdh"))!, 7)).toBe(2);
    // Each device's reading time stays its own; the phone's arrives as "others".
    expect(get("qv.reading.log")).toEqual({ "2026-11-25": 600 });
    expect(get("qv.reading.others")).toEqual({ phone: { "2026-11-25": 300 } });
    // The phone set the goal; the desktop never did.
    expect(get("qv.reading.goal")).toBe(20);
    expect(announced.flat()).toEqual(
      expect.arrayContaining([
        "qv.marks",
        "qv.hifdh",
        "qv.reading.others",
        "qv.reading.goal",
      ]),
    );

    // Back on the phone: the desktop's bookmark and reading time arrive.
    restore(phone);
    await syncOnce(gist, "pw", "phone", T + 3);
    expect(sanitizeMarks(get("qv.marks"))!.collections[0].items.map((i) => i.id)).toEqual(
      [255],
    );
    expect(get("qv.reading.log")).toEqual({ "2026-11-25": 300 });
    expect(get("qv.reading.others")).toEqual({ desktop: { "2026-11-25": 600 } });

    // Nothing new: nothing is written again.
    const writes = gist.writes;
    await syncOnce(gist, "pw", "phone", T + 4);
    expect(gist.writes).toBe(writes);
  });

  it("refuses the wrong passphrase without touching this device", async () => {
    const gist = memory();
    set("qv.marks", initialMarks(names));
    await syncOnce(gist, "right", "phone", T);
    localStorage.clear();
    set("qv.reading.goal", 5);
    const e = await syncOnce(gist, "wrong", "desktop", T).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(SyncError);
    expect((e as SyncError).problem).toBe("passphrase");
    expect(get("qv.marks")).toBeNull();
  });

  it("writes only what changed", () => {
    set("qv.reading.log", { "2026-11-25": 60 });
    const doc = collectLocal("phone");
    const spy = vi.fn();
    const off = onSyncApplied(spy);
    expect(applyLocal(doc, "phone")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    off();
  });
});
