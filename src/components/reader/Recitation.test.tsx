import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Verse } from "../../types/quran";
import { DEFAULT_RECITATION } from "../../data/recitation";
import type { Recitation } from "../../data/useRecitation";
import { MiniPlayer, type AudioDownloadPrompt } from "./Recitation";

const verses = [{ id: 1, s: 1, a: 1 }] as Verse[];
const idle: Recitation = {
  cursor: null,
  playing: false,
  error: null,
  missing: null,
  play: vi.fn(),
  toggle: vi.fn(),
  stop: vi.fn(),
  step: vi.fn(),
};
const prompt = (over: Partial<AudioDownloadPrompt> = {}): AudioDownloadPrompt => ({
  needed: { what: "Al-Baqara", size: "25 MB" },
  active: null,
  error: null,
  onStart: vi.fn(),
  onCancel: vi.fn(),
  ...over,
});

function bar(download: AudioDownloadPrompt | null, rec: Recitation = idle) {
  render(
    <MiniPlayer
      rec={rec}
      verses={verses}
      reciterName="Sa'ud ash-Shuraym"
      options={DEFAULT_RECITATION}
      onOpenOptions={() => {}}
      download={download}
    />,
  );
}

describe("MiniPlayer in the Android app", () => {
  it("offers the download, with its size, when this view isn't on the device", async () => {
    const p = prompt();
    bar(p);
    expect(screen.getByText("Al-Baqara · about 25 MB")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(p.onStart).toHaveBeenCalled();
  });

  it("shows progress and can cancel", async () => {
    const p = prompt({ active: { what: "Al-Baqara", done: 40, total: 287, waiting: 2 } });
    bar(p);
    expect(screen.getByText("Downloading Al-Baqara · 40/287")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText("2 more surahs waiting")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel download" }));
    expect(p.onCancel).toHaveBeenCalled();
  });

  it("is the normal player once the view is downloaded", () => {
    bar(prompt({ needed: null }));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("is the normal player in the browser (no download prompt)", () => {
    bar(null);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});
