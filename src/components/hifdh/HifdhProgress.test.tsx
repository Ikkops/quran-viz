import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuranData, Surah, Verse } from "../../types/quran";
import { emptyHifdh, setStatus } from "../../lib/hifdh";
import { HifdhProgress } from "./HifdhProgress";

const surah = (id: number, name: string) =>
  ({ id, number: id, name, nameAr: "", nameEn: name, nameId: name }) as unknown as Surah;
// Surah 1: ayahs 1–4 (juz 1); surah 2: ayahs 5–10, juz 1 until ayah 7, then juz 2.
const verses = Array.from(
  { length: 10 },
  (_, i): Verse =>
    ({
      id: i + 1,
      s: i < 4 ? 1 : 2,
      a: i < 4 ? i + 1 : i - 3,
      juz: i < 7 ? 1 : 2,
    }) as Verse,
);
const data = {
  surahs: [surah(1, "Al-Fatihah"), surah(2, "Al-Baqarah")],
  verses,
} as unknown as QuranData;

describe("HifdhProgress", () => {
  it("lists started surahs by name and shows the rest on request", () => {
    const h = setStatus(setStatus(emptyHifdh(), 1, 2, 2), 3, 3, 3);
    render(<HifdhProgress data={data} hifdh={h} onOpen={() => {}} />);
    expect(screen.getByText("30% of the Qur'an memorised")).toBeInTheDocument();
    const row = screen.getByRole("button", {
      name: "Al-Fatihah: 75% memorised, 3 of 4 ayahs · 1 need review",
    });
    expect(within(row).getByText("3 of 4 ayahs · 1 need review")).toBeInTheDocument();
    expect(screen.queryByText("Al-Baqarah")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show all 2" }));
    expect(screen.getByText("Al-Baqarah")).toBeInTheDocument();
  });

  it("names each juz's ayah range and opens a cell in the reader", () => {
    const onOpen = vi.fn();
    const h = setStatus(emptyHifdh(), 8, 8, 1);
    render(<HifdhProgress data={data} hifdh={h} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Juz" }));
    expect(screen.getByText("Al-Baqarah 4 – Al-Baqarah 6")).toBeInTheDocument();
    fireEvent.click(
      screen.getByTitle("Juz 1, Al-Fatihah 1 – Al-Baqarah 3: 0% memorised, 0 of 7 ayahs"),
    );
    expect(onOpen).toHaveBeenCalledWith({ scope: "juz", value: 1 });
  });
});
