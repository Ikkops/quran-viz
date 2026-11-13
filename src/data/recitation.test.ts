import { describe, expect, it } from "vitest";
import {
  RECITER_INFO,
  advance,
  audioFileName,
  ayahAudioUrl,
  estimateAudioBytes,
  formatBytes,
  surahAudioFiles,
  cursorAt,
  setRangeEnd,
  shiftRange,
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

describe("surahAudioFiles", () => {
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
    sanitizeRecitationOptions({ ayahRepeat: 3, rangeRepeat: 4, gap: 1, rate: 9 }),
  ).toEqual({ ayahRepeat: 3, rangeRepeat: 1, gap: 1, rate: 1 });
  expect(sanitizeRecitationOptions("x")).toBeUndefined();
});
