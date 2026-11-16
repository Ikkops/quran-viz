import { emptyHifdh } from "../lib/hifdh";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuranData, Surah, Verse } from "../types/quran";
import { addDays, dayKey } from "../data/readingLog";
import { KHATAM_KEY } from "../lib/khatam";
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
        hifdh={emptyHifdh()}
        onHifdhPlan={() => {}}
        marks={{ pins: [], collections: [] }}
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

  it("marks the tapped surah as pressed and opens it at once", async () => {
    const onOpen = home();
    const list = screen.getByRole("region", { name: "Index" });
    const row = within(list).getByRole("button", { name: /Al-Baqara/ });
    expect(row).not.toHaveAttribute("data-pressed");
    await userEvent.click(row);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(row).toHaveAttribute("data-pressed");
    const other = within(list).getByRole("button", { name: /Al-Faatiha/ });
    expect(other).not.toHaveAttribute("data-pressed");
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

  it("shows the pins and saved ayahs of a last-read surah on its card", () => {
    home({
      lastReads: [
        { id: 2, s: 2, at: Date.now() },
        { id: 3, s: 112, at: Date.now() },
      ],
      marks: {
        pins: [
          { id: "p1", name: "Tilawah", color: "#2563EB", ayah: 2, at: 0 },
          { id: "p2", name: "Unplaced", color: "#15803D", ayah: null, at: 0 },
        ],
        collections: [
          {
            id: "c1",
            name: "Fav",
            color: "#B7791F",
            items: [{ id: 2, note: "", at: 0 }],
          },
        ],
      },
    });
    const [baqara, ikhlas] = within(
      screen.getByRole("region", { name: "Last read" }),
    ).getAllByRole("button");
    expect(baqara).toHaveAccessibleName(/Pin at ayah 142, 1 ayah in collections/);
    expect(ikhlas).not.toHaveTextContent(/Pin|collection/);
    expect(ikhlas.querySelector("svg")).toBeNull();
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

  it("shows today's khatam pages when a target is set, and opens the last read", async () => {
    const today = dayKey(new Date());
    localStorage.setItem(
      KHATAM_KEY,
      JSON.stringify({ start: today, end: addDays(today, 9), from: 1 }),
    );
    const onOpen = home({ lastReads: [{ id: 2, s: 2, at: Date.now() }] });
    // Verse 2 has no page in this fixture, so the position is page 1: 603 pages over 10 days.
    const row = screen.getByRole("button", { name: /Today: 61 pages/ });
    expect(row).toHaveTextContent("On schedule");
    await userEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith({ scope: "surah", value: 2, anchor: 2 });
  });

  it("shows no khatam row without a target", () => {
    home();
    expect(screen.queryByRole("button", { name: /pages/ })).toBeNull();
  });

  it("resets sort, filter and layout but keeps the search", async () => {
    home();
    await userEvent.type(screen.getByRole("searchbox"), "al");
    await userEvent.click(screen.getByRole("button", { name: "Sort and filter" }));
    expect(screen.queryByRole("button", { name: "Reset controls" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Cards/ }));
    await userEvent.click(screen.getByRole("button", { name: "Reset controls" }));
    expect(screen.getByRole("button", { name: /List/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Reset controls" })).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("al");
  });
});
