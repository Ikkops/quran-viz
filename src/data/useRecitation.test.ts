import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRecitation } from "./useRecitation";
import { DEFAULT_RECITATION } from "./recitation";
import type { Verse } from "../types/quran";

vi.mock("./mediaControls", () => ({
  showNowPlaying: () => {},
  clearNowPlaying: () => {},
  bindMediaControls: () => () => {},
}));

const verses = [1, 2, 3].map(
  (a) => ({ id: a, s: 1, a, ar: "x", w: 1, l: 1 }) as unknown as Verse,
);

describe("useRecitation", () => {
  it("plays on by itself once the missing surah is downloaded", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const opts = (have: boolean) => ({
      reciter: "shuraym",
      enabled: true,
      verses,
      range: { from: 1, to: 3 },
      options: DEFAULT_RECITATION,
      needsBasmalah: () => false,
      base: "/audio/",
      available: () => have,
    });
    const { result, rerender } = renderHook((p) => useRecitation(p), {
      initialProps: opts(false),
    });
    act(() => result.current.play(2));
    expect(result.current.missing).toBe(2);
    expect(result.current.cursor).toBeNull();
    // The download finished: the device now has the surah.
    rerender(opts(true));
    expect(result.current.missing).toBeNull();
    expect(result.current.cursor?.id).toBe(2);
    expect(result.current.playing).toBe(true);
  });

  it("forgets the missing ayah when stopped", () => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const base = {
      reciter: "shuraym",
      enabled: true,
      verses,
      range: { from: 1, to: 3 },
      options: DEFAULT_RECITATION,
      needsBasmalah: () => false,
      base: "/audio/",
    };
    const { result, rerender } = renderHook((p) => useRecitation(p), {
      initialProps: { ...base, available: () => false },
    });
    act(() => result.current.play(1));
    act(() => result.current.stop());
    rerender({ ...base, available: () => true });
    expect(result.current.cursor).toBeNull();
  });
});

describe("useRecitation sleep timer", () => {
  afterEach(() => vi.useRealTimers());

  // Two surahs: 1:1–1:2 are ids 1–2, 2:1–2:2 are ids 3–4.
  const twoSurahs = [
    [1, 1],
    [1, 2],
    [2, 1],
    [2, 2],
  ].map(([s, a], i) => ({ id: i + 1, s, a, ar: "x", w: 1, l: 1 }) as unknown as Verse);

  function setup() {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const { result } = renderHook(() =>
      useRecitation({
        reciter: "shuraym",
        enabled: true,
        verses: twoSurahs,
        range: { from: 1, to: 4 },
        options: DEFAULT_RECITATION,
        needsBasmalah: () => false,
        base: "/audio/",
      }),
    );
    const end = () =>
      act(
        () =>
          void (
            play.mock.contexts[play.mock.contexts.length - 1] as HTMLMediaElement
          ).dispatchEvent(new Event("ended")),
      );
    return { result, end, pause };
  }

  it("pauses at the first ayah boundary after the deadline, then turns off", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { result, end } = setup();
    act(() => result.current.play(1));
    act(() => result.current.setSleep(15));
    expect(result.current.sleep).toEqual({ choice: 15, at: 15 * 60_000 });
    end(); // before the deadline: plays on
    expect(result.current.cursor?.id).toBe(2);
    expect(result.current.playing).toBe(true);
    vi.setSystemTime(16 * 60_000); // the deadline passes mid-ayah: it finishes
    expect(result.current.playing).toBe(true);
    end();
    expect(result.current.playing).toBe(false);
    expect(result.current.cursor?.id).toBe(2);
    expect(result.current.sleep).toBeNull();
    // A normal pause: play carries on with the next ayah.
    act(() => result.current.toggle());
    expect(result.current.cursor?.id).toBe(3);
    expect(result.current.playing).toBe(true);
  });

  it("pauses after the last ayah of the surah that was playing", () => {
    const { result, end } = setup();
    act(() => result.current.play(1));
    act(() => result.current.setSleep("surah"));
    expect(result.current.sleep).toEqual({ choice: "surah", surah: 1 });
    end();
    expect(result.current.playing).toBe(true);
    end(); // 1:2, the surah's last ayah
    expect(result.current.playing).toBe(false);
    expect(result.current.cursor?.id).toBe(2);
    expect(result.current.sleep).toBeNull();
  });

  it("set before anything plays, takes the surah that starts", () => {
    const { result, end } = setup();
    act(() => result.current.setSleep("surah"));
    act(() => result.current.play(3));
    expect(result.current.sleep).toEqual({ choice: "surah", surah: 2 });
    end();
    end();
    expect(result.current.playing).toBe(false);
  });
});
