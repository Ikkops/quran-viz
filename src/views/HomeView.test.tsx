import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuranData, Surah, Verse } from "../types/quran";
import { dayKey } from "../data/readingLog";
import { READING_LOG_KEY, resetReadingStore } from "../lib/readingStore";
import { ThemeProvider } from "../theme/ThemeContext";
import { HomeView } from "./HomeView";

const surah = (number: number, nameEn: string, nameAr: string, ayahCount: number) =>
  ({
    id: number,
    number,
    nameEn,
    nameId: nameEn,
    name: nameEn,
    nameAr,
    meaning: "",
    type: number === 2 ? "Medinan" : "Meccan",
    ayahCount,
    wordCount: ayahCount * 10,
    revelationOrder: number,
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
  meta: { juzs: [] },
} as unknown as QuranData;

function home(over: Partial<Parameters<typeof HomeView>[0]> = {}) {
  const onOpen = vi.fn();
  render(
    <ThemeProvider>
      <HomeView
        data={data}
        lastReads={[]}
        onOpen={onOpen}
        onSearch={() => {}}
        onActivity={() => {}}
        {...over}
      />
    </ThemeProvider>,
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
    const list = screen.getByRole("region", { name: "Index" });
    // The calligraphic name is drawn from the number; the Arabic name is read out.
    expect(within(list).getByText("سورة البقرة")).toBeInTheDocument();
    expect(within(list).getByRole("img", { name: "Medinan" })).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: /Al-Baqara/ }));
    expect(onOpen).toHaveBeenCalledWith({ scope: "surah", value: 2 });
  });

  it("filters by name (ignoring hyphens and case) or by number", async () => {
    home();
    const filter = screen.getByRole("searchbox");
    await userEvent.type(filter, "albaq");
    const list = screen.getByRole("region", { name: "Index" });
    expect(within(list).getByRole("button", { name: /Al-Baqara/ })).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: /Al-Faatiha/ })).toBeNull();
    await userEvent.clear(filter);
    await userEvent.type(filter, "112");
    expect(screen.getByRole("button", { name: /Al-Ikhlaas/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Al-Baqara/ })).toBeNull();
  });

  it("lists where reading last stopped and opens that ayah", async () => {
    const onOpen = home({
      lastReads: [
        { id: 2, s: 2, at: Date.now() },
        { id: 3, s: 112, at: Date.now() - 3 * 86_400_000 },
      ],
    });
    const last = screen.getByRole("region", { name: "Last read" });
    const entries = within(last).getAllByRole("button");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("Al-Baqara 2:142");
    expect(entries[0]).toHaveTextContent(/today, \d{2}:\d{2}/);
    expect(entries[1]).toHaveTextContent("3 days ago");
    await userEvent.click(entries[0]);
    expect(onOpen).toHaveBeenCalledWith({ scope: "surah", value: 2, anchor: 2 });
  });

  it("starts at Al-Fatihah for a new learner", async () => {
    const onOpen = home();
    await userEvent.click(screen.getByRole("button", { name: /Start reading/ }));
    expect(onOpen).toHaveBeenCalledWith({ scope: "surah", value: 1 });
  });

  it("shows today's reading and the streak, and opens Activity", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    localStorage.setItem(
      READING_LOG_KEY,
      JSON.stringify({ [dayKey(today)]: 6 * 60, [dayKey(yesterday)]: 12 * 60 }),
    );
    const onActivity = vi.fn();
    home({ onActivity });
    const card = screen.getByRole("button", { name: /Today: 6 min of 5 min/ });
    expect(card).toHaveTextContent("Streak: 2 days");
    await userEvent.click(card);
    expect(onActivity).toHaveBeenCalled();
  });
});
