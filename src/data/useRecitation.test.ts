import { describe, expect, it, vi } from "vitest";
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
