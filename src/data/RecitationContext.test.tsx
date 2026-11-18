import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import type { Surah, Verse } from "../types/quran";
import { RecitationProvider, useRecitationContext } from "./RecitationContext";
import type { Recitation } from "./useRecitation";

// The Android app, with the download store faked: `have` is what is on the device.
const store = vi.hoisted(() => ({
  have: {} as Record<number, number>,
  downloadSurahs: vi.fn(),
}));
vi.mock("./audioStore", () => ({
  isNativeApp: () => true,
  downloadSurahs: store.downloadSurahs,
  useAudioDownloads: () => ({
    downloaded: { shuraym: store.have },
    queue: [],
    active: null,
    error: null,
    base: "/audio/",
  }),
}));
vi.mock("./mediaControls", () => ({
  showNowPlaying: () => {},
  clearNowPlaying: () => {},
  bindMediaControls: () => () => {},
}));

// Surah 1 is ids 1–2, surah 2 ids 3–4.
const surahs = [1, 2].map((id) => ({
  id,
  name: `S${id}`,
  ayahCount: 2,
  hasBismillah: false,
  letterCount: 10,
})) as unknown as Surah[];
const verses = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
].map(([s, a], i) => ({ id: i + 1, s, a, ar: "x", w: 1, l: 1 }) as unknown as Verse);

let rec: Recitation;
// The reader showing both surahs.
function Reader() {
  const ctx = useRecitationContext();
  useEffect(() => {
    rec = ctx.rec;
  });
  const { setScopeRange } = ctx;
  useEffect(() => setScopeRange({ from: 1, to: 4 }), [setScopeRange]);
  return null;
}
const tree = () => (
  <RecitationProvider surahs={surahs} verses={verses} readerOpen>
    <Reader />
  </RecitationProvider>
);

describe("RecitationProvider in the Android app", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("qv.audio.reciter", JSON.stringify("shuraym"));
    store.have = {};
    store.downloadSurahs.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("Play downloads the range's missing surahs, played one first, and plays once all are in", () => {
    const { rerender } = render(tree());
    expect(store.downloadSurahs).not.toHaveBeenCalled();
    act(() => rec.play(3));
    expect(store.downloadSurahs).toHaveBeenCalledWith("shuraym", [
      { surah: 2, ayahCount: 2, hasBismillah: false },
      { surah: 1, ayahCount: 2, hasBismillah: false },
    ]);
    expect(rec.playing).toBe(false);
    // Surah 2 is in, surah 1 still downloading: Play keeps waiting.
    store.have = { 2: 100 };
    rerender(tree());
    expect(rec.playing).toBe(false);
    expect(rec.missing).toBe(3);
    store.have = { 1: 100, 2: 100 };
    rerender(tree());
    expect(rec.cursor?.id).toBe(3);
    expect(rec.playing).toBe(true);
  });

  it("asks first when the confirm setting is on", () => {
    localStorage.setItem("qv.audio.confirmDownload", "true");
    render(tree());
    act(() => rec.play(3));
    expect(store.downloadSurahs).not.toHaveBeenCalled();
    expect(rec.missing).toBe(3);
  });
});
