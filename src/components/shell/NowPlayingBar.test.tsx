import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Surah, Verse } from "../../types/quran";
import { RecitationProvider, useRecitationContext } from "../../data/RecitationContext";
import { NowPlayingBar } from "./NowPlayingBar";

const surahs = [
  { id: 1, name: "Al-Fatiha", hasBismillah: false, letterCount: 36 },
] as Surah[];
const verses = [1, 2].map(
  (a) => ({ id: a, s: 1, a, ar: "x", w: 1, l: 1 }) as unknown as Verse,
);

// Starts recitation the way the reader would.
function PlayButton() {
  const { rec } = useRecitationContext();
  return (
    <button type="button" onClick={() => rec.play(2)}>
      start
    </button>
  );
}

function setup(readerOpen = false) {
  const onOpen = vi.fn();
  render(
    <RecitationProvider surahs={surahs} verses={verses} readerOpen={readerOpen}>
      <PlayButton />
      <NowPlayingBar surahs={surahs} verses={verses} onOpen={onOpen} />
    </RecitationProvider>,
  );
  return { onOpen, start: () => userEvent.click(screen.getByText("start")) };
}

describe("NowPlayingBar", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("qv.audio.reciter", JSON.stringify("shuraym"));
    // Only the reciter's index loads (its name).
    globalThis.fetch = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith("shuraym/index.json")
          ? {
              ok: true,
              json: () => Promise.resolve({ name: "Sa'ud ash-Shuraym", files: 3 }),
            }
          : { ok: false },
      ),
    ) as unknown as typeof fetch;
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows the playing ayah and reciter, pauses and plays, and opens the reader there", async () => {
    const { onOpen, start } = setup();
    expect(screen.queryByRole("region", { name: "Now playing" })).toBeNull();
    await start();
    const region = screen.getByRole("region", { name: "Now playing" });
    expect(region).toHaveTextContent("Al-Fatiha 1:2");
    expect(region).toHaveTextContent("Now playing · Sa'ud ash-Shuraym");
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Open in reader: Al-Fatiha 1:2, Sa'ud ash-Shuraym",
      }),
    );
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it("stops playback and goes away on close", async () => {
    const { start } = setup();
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.queryByRole("region", { name: "Now playing" })).toBeNull();
  });

  it("stays hidden while the reader is open", async () => {
    const { start } = setup(true);
    await start();
    expect(screen.queryByRole("region", { name: "Now playing" })).toBeNull();
  });
});
