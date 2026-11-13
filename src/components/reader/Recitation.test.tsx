import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Verse } from "../../types/quran";
import { DEFAULT_RECITATION } from "../../data/recitation";
import type { Recitation } from "../../data/useRecitation";
import { MiniPlayer, type AudioDownloadPrompt } from "./Recitation";

const verses = [
  { id: 1, s: 1, a: 1 },
  { id: 2, s: 1, a: 2 },
  { id: 3, s: 1, a: 3 },
] as Verse[];
const clockAt = { id: null, t: 0, rev: 0 };
const idle: Recitation = {
  cursor: null,
  playing: false,
  error: null,
  missing: null,
  play: vi.fn(),
  toggle: vi.fn(),
  stop: vi.fn(),
  step: vi.fn(),
  restart: vi.fn(),
  seek: vi.fn(),
  clock: { subscribe: () => () => {}, get: () => clockAt },
  lengthOf: () => 10,
};
const prompt = (over: Partial<AudioDownloadPrompt> = {}): AudioDownloadPrompt => ({
  needed: { what: "Al-Baqara", size: "25 MB" },
  active: null,
  error: null,
  onStart: vi.fn(),
  onCancel: vi.fn(),
  ...over,
});

function bar(
  download: AudioDownloadPrompt | null,
  rec: Recitation = idle,
  over: Partial<Parameters<typeof MiniPlayer>[0]> = {},
) {
  render(
    <MiniPlayer
      rec={rec}
      verses={verses}
      reciter="shuraym"
      reciterName="Sa'ud ash-Shuraym"
      options={DEFAULT_RECITATION}
      onOptions={() => {}}
      range={{ from: 1, to: 3 }}
      onRange={() => {}}
      roomy
      onOpenOptions={() => {}}
      download={download}
      {...over}
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

describe("MiniPlayer controls", () => {
  it("shows the range's length on the seek bar and seeks into the right ayah", () => {
    bar(null);
    const seek = screen.getByRole("slider", { name: "Position in the range" });
    // Three ayahs of 10 s each.
    expect(seek).toHaveAttribute("max", "30");
    expect(seek).toHaveAttribute("aria-valuetext", "0:00 of 0:30");
    fireEvent.change(seek, { target: { value: "14" } });
    fireEvent.pointerUp(seek);
    expect(idle.seek).toHaveBeenCalledWith(2, 4);
  });

  it("moves the ends of the range with − and +", async () => {
    const onRange = vi.fn();
    bar(null, idle, { onRange });
    await userEvent.click(
      screen.getByRole("button", { name: 'Move "From" one ayah later' }),
    );
    expect(onRange).toHaveBeenLastCalledWith({ from: 2, to: 3 });
    await userEvent.click(
      screen.getByRole("button", { name: 'Move "To" one ayah earlier' }),
    );
    expect(onRange).toHaveBeenLastCalledWith({ from: 1, to: 2 });
  });

  it("steps the ayah repeat on each press and shows it as on", async () => {
    const onOptions = vi.fn();
    bar(null, idle, { onOptions });
    const off = screen.getByRole("button", { name: "Repeat each ayah: none" });
    expect(off).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(off);
    expect(onOptions).toHaveBeenCalledWith({ ...DEFAULT_RECITATION, ayahRepeat: 2 });
  });

  it("marks repeat as on, with its count, and wraps from ∞ back to none", async () => {
    const onOptions = vi.fn();
    bar(null, idle, { onOptions, options: { ...DEFAULT_RECITATION, ayahRepeat: 0 } });
    const on = screen.getByRole("button", { name: "Repeat each ayah: ∞" });
    expect(on).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(on);
    expect(onOptions).toHaveBeenCalledWith({ ...DEFAULT_RECITATION, ayahRepeat: 1 });
  });

  it("restarts the ayah that is loaded", async () => {
    const rec = {
      ...idle,
      cursor: { id: 2, ayahPass: 0, rangePass: 0, basmalah: false },
    };
    bar(null, rec);
    await userEvent.click(screen.getByRole("button", { name: "Start this ayah again" }));
    expect(rec.restart).toHaveBeenCalled();
  });
});
