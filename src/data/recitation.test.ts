import { describe, expect, it } from "vitest";
import {
  RECITER_INFO,
  advance,
  audioFileName,
  ayahAudioUrl,
  clipOf,
  estimateAudioBytes,
  formatBytes,
  outsideRange,
  surahAudioFiles,
  cursorAt,
  gapSeconds,
  setRangeEnd,
  shiftRange,
  sleepDue,
  sleepMinutesLeft,
  sleepTimerFor,
  chainPreview,
  setFinished,
  type Cursor,
  type LoopOptions,
  type LoopRange,
} from "./recitation";

const none = () => false;
const once: LoopOptions = { ayahRepeat: 1, rangeRepeat: 1 };

/** Play from the range start until done; returns the ids heard (b = basmalah). */
function run(
  range: LoopRange,
  opts: LoopOptions,
  needs: (id: number) => boolean = none,
  limit = 50,
): string[] {
  const heard: string[] = [];
  let cur: Cursor | null = cursorAt(range.from, needs);
  while (cur && heard.length < limit) {
    heard.push(cur.basmalah ? `b${cur.id}` : String(cur.id));
    cur = advance(cur, range, opts, needs);
  }
  return heard;
}

describe("advance", () => {
  it("plays a range once, then stops", () => {
    expect(run({ from: 3, to: 5 }, once)).toEqual(["3", "4", "5"]);
  });

  it("repeats each ayah, then the range", () => {
    expect(run({ from: 1, to: 2 }, { ayahRepeat: 2, rangeRepeat: 2 })).toEqual([
      "1",
      "1",
      "2",
      "2",
      "1",
      "1",
      "2",
      "2",
    ]);
  });

  it("loops forever when rangeRepeat is 0", () => {
    expect(run({ from: 1, to: 2 }, { ayahRepeat: 1, rangeRepeat: 0 }, none, 5)).toEqual([
      "1",
      "2",
      "1",
      "2",
      "1",
    ]);
  });

  it("plays the basmalah once before ayah 1, not on ayah repeats", () => {
    const needs = (id: number) => id === 8; // 2:1
    expect(run({ from: 8, to: 9 }, { ayahRepeat: 2, rangeRepeat: 1 }, needs)).toEqual([
      "b8",
      "8",
      "8",
      "9",
      "9",
    ]);
  });

  it("applies a range changed mid-play without restarting the current ayah", () => {
    // Playing 12 of 10–20 when the range shrinks to 10–13.
    const range: LoopRange = { from: 10, to: 13 };
    const opts = { ayahRepeat: 1, rangeRepeat: 0 };
    let cur: Cursor | null = cursorAt(12, none);
    cur = advance(cur, range, opts, none)!;
    expect(cur.id).toBe(13);
    cur = advance(cur, range, opts, none)!;
    expect(cur).toMatchObject({ id: 10, rangePass: 1 });
  });

  it("wraps to the new start when the range moves past the cursor", () => {
    const opts = { ayahRepeat: 1, rangeRepeat: 0 };
    expect(advance(cursorAt(5, none), { from: 30, to: 40 }, opts, none)?.id).toBe(30);
    expect(advance(cursorAt(50, none), { from: 30, to: 40 }, opts, none)?.id).toBe(30);
  });
});

describe("range edits", () => {
  it("shiftRange clamps and keeps from <= to", () => {
    expect(shiftRange({ from: 5, to: 6 }, "from", 3, 100)).toEqual({ from: 8, to: 8 });
    expect(shiftRange({ from: 5, to: 6 }, "to", -4, 100)).toEqual({ from: 2, to: 2 });
    expect(shiftRange({ from: 1, to: 6 }, "from", -1, 100)).toEqual({ from: 1, to: 6 });
    expect(shiftRange({ from: 1, to: 100 }, "to", 1, 100)).toEqual({ from: 1, to: 100 });
  });

  it("setRangeEnd moves the other end when they cross", () => {
    expect(setRangeEnd({ from: 5, to: 9 }, "from", 12)).toEqual({ from: 12, to: 12 });
    expect(setRangeEnd({ from: 5, to: 9 }, "to", 3)).toEqual({ from: 3, to: 3 });
  });
});

it("ayahAudioUrl pads surah and ayah", () => {
  expect(ayahAudioUrl("shuraym", 2, 7)).toMatch(/audio\/shuraym\/002007\.mp3$/);
});

it("ayahAudioUrl uses the device folder when given one", () => {
  expect(
    ayahAudioUrl("yasser", 114, 6, "https://localhost/_capacitor_file_/d/audio/"),
  ).toBe("https://localhost/_capacitor_file_/d/audio/yasser/114006.mp3");
});

describe("clipOf", () => {
  const at = (id: number, basmalah = false): Cursor => ({
    id,
    ayahPass: 0,
    rangePass: 0,
    basmalah,
  });
  // Ayahs 1–3 cut mid-pause, the rest zero; then per surah a basmalah:
  // surah 7's after a 30 s announcement, surah 2's inside ayah 1.
  const clips = new Array<number>(2 * (6236 + 114)).fill(0);
  clips.splice(0, 6, 34000, 39000, 39000, 45500, 45500, 51000);
  clips.splice(2 * (6236 + 6), 2, 30000, 33800);
  clips.splice(2 * (6236 + 1), 2, 0, 300);

  it("plays per-ayah files whole, the basmalah from 001001.mp3", () => {
    expect(clipOf(at(2), "r", { s: 1, a: 2 }, "/a/")).toEqual({
      src: "/a/r/001002.mp3",
      from: 0,
      to: null,
    });
    expect(clipOf(at(2, true), "r", { s: 1, a: 2 }, "/a/")?.src).toBe("/a/r/001001.mp3");
  });

  it("plays a whole-surah reciter's ayah as its slice of the surah file", () => {
    expect(clipOf(at(2), "r", { s: 7, a: 2 }, "/a/", clips)).toEqual({
      src: "/a/r/007.mp3",
      from: 39,
      to: 45.5,
    });
    // The basmalah is its own slice, skipping what the file opens with.
    expect(clipOf(at(1, true), "r", { s: 7, a: 1 }, "/a/", clips)).toEqual({
      src: "/a/r/007.mp3",
      from: 30,
      to: 33.8,
    });
  });

  it("has no basmalah when its slice is too short to hold one", () => {
    expect(clipOf(at(1, true), "r", { s: 2, a: 1 }, "/a/", clips)).toBeNull();
  });
});

describe("surahAudioFiles", () => {
  it("is the one SSS.mp3 for a whole-surah reciter", () => {
    expect(surahAudioFiles(2, 286, true, true)).toEqual(["002.mp3"]);
  });

  it("lists every ayah, with the basmalah first when it is recited", () => {
    expect(surahAudioFiles(112, 4, true)).toEqual([
      "001001.mp3",
      "112001.mp3",
      "112002.mp3",
      "112003.mp3",
      "112004.mp3",
    ]);
  });
  it("adds no basmalah to At-Tawbah or to Al-Fatihah (its first ayah is it)", () => {
    expect(surahAudioFiles(9, 2, false)).toEqual(["009001.mp3", "009002.mp3"]);
    expect(surahAudioFiles(1, 7, true)).toHaveLength(7);
    expect(surahAudioFiles(1, 7, true)[0]).toBe(audioFileName(1, 1));
  });
});

it("estimates a download by word share and formats it", () => {
  expect(estimateAudioBytes("shuraym", 41004, 82008)).toBeCloseTo(
    RECITER_INFO.shuraym.bytes / 2,
  );
  expect(estimateAudioBytes("shuraym", 10, 0)).toBe(0);
  expect(formatBytes(25_400_000)).toBe("25 MB");
  expect(formatBytes(120_000)).toBe("1 MB");
  expect(formatBytes(1_495_802_496)).toBe("1.5 GB");
});

it("sanitizeRecitationOptions drops values that are no longer choices", async () => {
  const { sanitizeRecitationOptions } = await import("./recitation");
  expect(
    sanitizeRecitationOptions({ ayahRepeat: 3, rangeRepeat: 7, gap: 1, rate: 9 }),
  ).toEqual({
    ayahRepeat: 3,
    rangeRepeat: 1,
    gap: 1,
    rate: 1,
    chain: false,
    setRepeat: 1,
    window: 0,
    setPause: 0,
  });
  expect(sanitizeRecitationOptions("x")).toBeUndefined();
});

describe("repeat button", () => {
  it("cycles none, 1×, 2×, 3×, 5×, 11×, ∞ and back", async () => {
    const { nextRepeat, repeatBadge } = await import("./recitation");
    const seen: string[] = [];
    let plays = 1;
    for (let i = 0; i < 8; i++) {
      seen.push(repeatBadge(plays));
      plays = nextRepeat(plays);
    }
    expect(seen).toEqual(["", "1×", "2×", "3×", "5×", "11×", "∞", ""]);
  });
  it("starts over from a value that is no longer a choice", async () => {
    const { nextRepeat } = await import("./recitation");
    expect(nextRepeat(7)).toBe(1);
  });
});

describe("seek bar maths", () => {
  it("formats playing time", async () => {
    const { formatClock } = await import("./recitation");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65.4)).toBe("1:05");
    expect(formatClock(3727)).toBe("1:02:07");
  });
  it("finds the ayah and offset for a time in the range", async () => {
    const { locateInRange } = await import("./recitation");
    expect(locateInRange([10, 20, 5], 100, 0)).toEqual({ id: 100, offset: 0 });
    expect(locateInRange([10, 20, 5], 100, 12)).toEqual({ id: 101, offset: 2 });
    // Past the end: the last ayah, just before it finishes.
    expect(locateInRange([10, 20, 5], 100, 99)).toEqual({ id: 102, offset: 4.75 });
  });
  it("estimates an ayah's length from the set's size, bitrate and letter share", async () => {
    const { estimateAyahSeconds } = await import("./recitation");
    const total = (RECITER_INFO.shuraym.bytes * 8) / 64_000;
    expect(estimateAyahSeconds("shuraym", 50, 100)).toBeCloseTo(total / 2);
    expect(estimateAyahSeconds("nobody", 50, 100)).toBe(0);
  });
});

describe("outsideRange", () => {
  it("is true only past either end", () => {
    const r = { from: 10, to: 12 };
    expect(outsideRange(9, r)).toBe(true);
    expect(outsideRange(10, r)).toBe(false);
    expect(outsideRange(12, r)).toBe(false);
    expect(outsideRange(13, r)).toBe(true);
  });
});

describe("chain mode", () => {
  const chain = (ayahRepeat: number, rangeRepeat = 1): LoopOptions => ({
    ayahRepeat,
    rangeRepeat,
    chain: true,
  });

  it("repeats each new ayah, then joins everything so far", () => {
    expect(run({ from: 1, to: 3 }, chain(2)).join(" ")).toBe("1 1 2 2 1 2 3 3 1 2 3");
  });

  it("replays the whole range for each range repeat", () => {
    expect(run({ from: 5, to: 6 }, chain(1, 3)).join(" ")).toBe("5 6 5 6 5 6 5 6");
  });

  it("is the plain loop for a single ayah", () => {
    expect(run({ from: 7, to: 7 }, chain(2))).toEqual(["7", "7"]);
  });

  it("starts the chain again from an ayah that was jumped to", () => {
    const heard: number[] = [];
    let cur: Cursor | null = cursorAt(3, none);
    while (cur) {
      heard.push(cur.id);
      cur = advance(cur, { from: 1, to: 4 }, chain(1), none);
    }
    expect(heard.join(" ")).toBe("3 1 2 3 4 1 2 3 4");
  });

  it("plays the set several times and moves the window, as in the demo", () => {
    // New ayah 3 plays, the set twice, a window of 5 (ayahs 1–6).
    const o: LoopOptions = { ...chain(3), setRepeat: 2, window: 5 };
    expect(chainPreview(o, 6).map((g) => g.join(" "))).toEqual([
      "1 1 1",
      "2 2 2",
      "1 2 1 2",
      "3 3 3",
      "1 2 3 1 2 3",
      "4 4 4",
      "1 2 3 4 1 2 3 4",
      "5 5 5",
      "1 2 3 4 5 1 2 3 4 5",
      "6 6 6",
      "1 2 3 4 5 6 1 2 3 4 5 6",
      // Restarting from the new window.
      "2 2 2",
      "3 3 3",
      "2 3 2 3",
      "4 4 4",
      "2 3 4 2 3 4",
      "5 5 5",
      "2 3 4 5 2 3 4 5",
      "6 6 6",
      "2 3 4 5 6 2 3 4 5 6",
    ]);
  });

  it("keeps the window moving past it", () => {
    const o: LoopOptions = { ...chain(1), window: 2 };
    expect(run({ from: 1, to: 4 }, o).join(" ")).toBe(
      "1 2 1 2 3 1 2 3 2 3 2 3 4 2 3 4 3 4 3 4",
    );
  });

  it("names the set that just finished, for the pause after it", () => {
    const o: LoopOptions = { ...chain(1), setRepeat: 2 };
    const r = { from: 1, to: 3 };
    const done: string[] = [];
    let cur: Cursor | null = cursorAt(1, none);
    while (cur) {
      const nxt = advance(cur, r, o, none);
      const set = setFinished(cur, nxt, r, o);
      if (set) done.push(`${set.from}-${set.to}`);
      cur = nxt;
    }
    // After ayah 1 alone and after 1–2; the last set ends playback.
    expect(done).toEqual(["1-1", "1-2"]);
    expect(setFinished(cursorAt(2, none), cursorAt(3, none), r, once)).toBeNull();
  });

  it("plays the basmalah each time the joining pass reaches the surah's start", () => {
    const needs = (id: number) => id === 8;
    expect(run({ from: 8, to: 9 }, chain(1), needs).join(" ")).toBe("b8 8 9 b8 8 9");
  });
});

describe("gapSeconds", () => {
  it("keeps a fixed gap", () => {
    expect(gapSeconds(2, 10, 1)).toBe(2);
    expect(gapSeconds(0, 10, 1)).toBe(0);
  });
  it("matches the ayah's length as it was played", () => {
    expect(gapSeconds(-1, 10, 1)).toBe(10);
    expect(gapSeconds(-1.5, 10, 1.25)).toBe(12);
  });
  it("is nothing while the length is unknown", () => {
    expect(gapSeconds(-1, NaN, 1)).toBe(0);
  });
});

describe("sleep timer", () => {
  // Surah 1 is ayahs 1–3, surah 2 is ayahs 4–6.
  const vs = [1, 1, 1, 2, 2, 2].map((s) => ({ s }));
  const all: LoopRange = { from: 1, to: 6 };
  const at = (id: number, ayahPass = 0): Cursor => ({
    id,
    ayahPass,
    rangePass: 0,
    basmalah: false,
  });

  it("turns a choice into a deadline or a surah", () => {
    expect(sleepTimerFor(0, 1000, 1)).toBeNull();
    expect(sleepTimerFor(15, 1000, 1)).toEqual({ choice: 15, at: 1000 + 15 * 60_000 });
    expect(sleepTimerFor("surah", 1000, 2)).toEqual({ choice: "surah", surah: 2 });
  });

  it("stops a minute timer at the first ayah boundary after the deadline", () => {
    const t = { choice: 15, at: 10_000 } as const;
    expect(sleepDue(t, 9_999, at(2), at(3), vs, all, once)).toBe(false);
    expect(sleepDue(t, 10_000, at(2), at(3), vs, all, once)).toBe(true);
    // Not between the basmalah and its ayah.
    expect(sleepDue(t, 20_000, { ...at(4), basmalah: true }, at(4), vs, all, once)).toBe(
      false,
    );
  });

  it("stops at the end of the surah, after the last ayah's repeats", () => {
    const t = { choice: "surah", surah: 1 } as const;
    expect(sleepDue(t, 0, at(2), at(3), vs, all, once)).toBe(false);
    expect(sleepDue(t, 0, at(3), at(4), vs, all, once)).toBe(true);
    const thrice = { ayahRepeat: 3, rangeRepeat: 1 };
    expect(sleepDue(t, 0, at(3, 0), at(3, 1), vs, all, thrice)).toBe(false);
    expect(sleepDue(t, 0, at(3, 2), at(4), vs, all, thrice)).toBe(true);
    // Another surah's last ayah does not count.
    expect(sleepDue(t, 0, at(6), null, vs, all, once)).toBe(false);
  });

  it("is not defeated by a looping range or endless ayah repeats", () => {
    const t = { choice: "surah", surah: 1 } as const;
    const loop = { ayahRepeat: 1, rangeRepeat: 0 };
    // The range ends inside the surah and wraps forever: stop at its end.
    expect(sleepDue(t, 0, at(2), at(1), vs, { from: 1, to: 2 }, loop)).toBe(true);
    expect(sleepDue(t, 0, at(1), at(2), vs, { from: 1, to: 2 }, loop)).toBe(false);
    // Each ayah forever never reaches the end: stop after this one.
    const forever = { ayahRepeat: 0, rangeRepeat: 1 };
    expect(sleepDue(t, 0, at(1), at(1, 1), vs, all, forever)).toBe(true);
  });

  it("counts whole minutes left, never below 1", () => {
    expect(sleepMinutesLeft(24 * 60_000, 0)).toBe(24);
    expect(sleepMinutesLeft(23 * 60_000 + 1, 0)).toBe(24);
    expect(sleepMinutesLeft(0, 5000)).toBe(1);
  });
});
