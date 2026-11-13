import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuranData, Surah, Verse } from "../types/quran";
import { dayKey } from "../data/readingLog";
import { READING_LOG_KEY, resetReadingStore } from "../lib/readingStore";
import { HomeView } from "./HomeView";

const surah = (number: number, nameEn: string, nameAr: string, ayahCount: number) =>
  ({
    id: number,
    number,
    nameEn,
    nameAr,
    meaning: "",
    type: number === 2 ? "Medinan" : "Meccan",
    ayahCount,
  }) as Surah;
const data = {
  surahs: [
    surah(1, "Al-Faatiha", "سورة الفاتحة", 7),
    surah(2, "Al-Baqara", "سورة البقرة", 286),
    surah(112, "Al-Ikhlaas", "سورة الإخلاص", 4),
  ],
  verses: [
    { id: 1, s: 1, a: 1, juz: 1 },
    { id: 2, s: 2, a: 142, juz: 2 },
    { id: 3, s: 112, a: 1, juz: 30 },
  ] as Verse[],
} as QuranData;

function home(over: Partial<Parameters<typeof HomeView>[0]> = {}) {
  const onOpen = vi.fn();
  render(
    <HomeView
      data={data}
      lastRead={null}
      onOpen={onOpen}
      onSearch={() => {}}
      {...over}
    />,
  );
  return onOpen;
}

beforeEach(() => {
  localStorage.clear();
  resetReadingStore();
});

describe("HomeView", () => {
  it("lists the surahs and opens one", async () => {
    const onOpen = home();
    const list = screen.getByRole("region", { name: "Surahs" });
    expect(within(list).getAllByRole("button")).toHaveLength(3);
    // The Arabic name drops its leading "سورة".
    expect(within(list).getByText("البقرة")).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: /Al-Baqara/ }));
    expect(onOpen).toHaveBeenCalledWith({ scope: "surah", value: 2 });
  });

  it("filters by name (ignoring hyphens and case) or by number", async () => {
    home();
    const filter = screen.getByRole("searchbox");
    await userEvent.type(filter, "albaq");
    const list = screen.getByRole("region", { name: "Surahs" });
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    await userEvent.clear(filter);
    await userEvent.type(filter, "11");
    expect(within(list).getByRole("button", { name: /Al-Ikhlaas/ })).toBeInTheDocument();
    expect(within(list).getAllByRole("button")).toHaveLength(1);
  });

  it("continues from the last-read ayah", async () => {
    const lastRead = { scope: "surah", value: 2, anchor: 2 } as const;
    const onOpen = home({ lastRead, lastReadId: 2 });
    const go = screen.getByRole("button", { name: /Continue reading/ });
    expect(go).toHaveTextContent("Al-Baqara 2:142");
    await userEvent.click(go);
    expect(onOpen).toHaveBeenCalledWith(lastRead);
  });

  it("starts at Al-Fatihah for a new learner", async () => {
    const onOpen = home();
    await userEvent.click(screen.getByRole("button", { name: /Start reading/ }));
    expect(onOpen).toHaveBeenCalledWith({ scope: "surah", value: 1 });
  });

  it("opens a juz from the juz index", async () => {
    const onOpen = home();
    await userEvent.click(screen.getByRole("button", { name: "Juz" }));
    await userEvent.click(screen.getByRole("button", { name: /Juz 2/ }));
    expect(onOpen).toHaveBeenCalledWith({ scope: "juz", value: 2 });
  });

  it("shows today's reading and the streak, and the activity page behind it", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    localStorage.setItem(
      READING_LOG_KEY,
      JSON.stringify({ [dayKey(today)]: 6 * 60, [dayKey(yesterday)]: 12 * 60 }),
    );
    home();
    const card = screen.getByRole("button", { name: /Today: 6 min of 5 min/ });
    expect(card).toHaveTextContent("Streak: 2 days");
    await userEvent.click(card);
    const page = screen.getByRole("region", { name: "Reading activity" });
    expect(within(page).getByText("18 min")).toBeInTheDocument(); // total
    expect(within(page).getByRole("button", { name: "Week" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(within(page).getByRole("button", { name: "Year" }));
    expect(within(page).getByText(String(today.getFullYear()))).toBeInTheDocument();
  });
});
