import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { QuranData } from "../../types/quran";
import { initialMarks, type Marks } from "../../lib/marks";
import { MarksPanel } from "./MarksPanel";

const data = { verses: [], surahs: [] } as unknown as QuranData;
const mine = initialMarks({ pin: "Tilawah", collection: "Favourites" });
const choose = (text: string) =>
  fireEvent.change(screen.getByLabelText("Restore from a backup"), {
    target: { files: [new File([text], "backup.json", { type: "application/json" })] },
  });

it("restores a backup after a confirm, and refuses a file that isn't one", async () => {
  const onMarks = vi.fn<(m: Marks) => void>();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<MarksPanel data={data} marks={mine} onMarks={onMarks} onOpen={() => {}} />);

  choose("not a backup");
  expect(await screen.findByRole("status")).toHaveTextContent(/isn't a bookmarks backup/);
  expect(onMarks).not.toHaveBeenCalled();

  const saved: Marks = {
    pins: [{ id: "p1", name: "Hifz", color: "#2563EB", ayah: 255, at: 1 }],
    collections: [],
  };
  // What the file holds goes through the same checks as stored marks.
  choose(JSON.stringify({ ...saved, pins: [...saved.pins, { id: "p2", name: "" }] }));
  await waitFor(() => expect(onMarks).toHaveBeenCalledWith(saved));
});
