import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { tafsirById } from "../../data/editions";

const store = vi.hoisted(() => ({
  downloadTafsir: vi.fn(),
  cancelTafsirDownload: vi.fn(),
  deleteTafsir: vi.fn(),
}));
vi.mock("../../data/tafsirStore", async (orig) => ({
  ...(await orig<typeof import("../../data/tafsirStore")>()),
  ...store,
  downloadable: () => true,
}));

import { TafsirDownloadOffer, TafsirSourceLine } from "./TafsirDownload";

const tahlili = tafsirById("id.kemenag-tahlili");

describe("TafsirDownloadOffer", () => {
  it("offers the edition with its size and starts the download", async () => {
    render(
      <TafsirDownloadOffer ed={tahlili} dl={{ have: {}, active: null, failed: null }} />,
    );
    expect(screen.getByText(/isn't on this device yet.*\(8 MB\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(store.downloadTafsir).toHaveBeenCalledWith("id.kemenag-tahlili");
  });

  it("shows progress and cancels", async () => {
    render(
      <TafsirDownloadOffer
        ed={tahlili}
        dl={{ have: {}, active: { id: tahlili.id, done: 57, total: 114 }, failed: null }}
      />,
    );
    expect(screen.getByText("Downloading… 50%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "57");
    await userEvent.click(screen.getByRole("button", { name: "Cancel download" }));
    expect(store.cancelTafsirDownload).toHaveBeenCalled();
  });

  it("says when a download stopped", () => {
    render(
      <TafsirDownloadOffer
        ed={tahlili}
        dl={{ have: {}, active: null, failed: tahlili.id }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/download stopped/);
  });
});

describe("TafsirSourceLine", () => {
  it("names the source, the publication date and a way to remove it", async () => {
    render(<TafsirSourceLine ed={tahlili} />);
    expect(screen.getByText(/revised ed\. 2004–2008/)).toBeInTheDocument();
    // A stray tap on the link must not delete the download.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.click(screen.getByRole("button", { name: "Remove from device" }));
    expect(store.deleteTafsir).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Remove from device" }));
    expect(store.deleteTafsir).toHaveBeenCalledWith("id.kemenag-tahlili");
  });
});
