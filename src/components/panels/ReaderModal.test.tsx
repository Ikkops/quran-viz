import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EditionsIndex, Surah, Verse } from "../../types/quran";
import type { Palette } from "../../theme/palettes";

// jsdom has no layout, so @tanstack/react-virtual sees a 0-height scroll
// container and renders zero items. Stub the hook to render every row.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 140,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 140,
        size: 140,
        key: i,
      })),
    scrollToIndex: () => {},
    measureElement: () => {},
  }),
}));

import { ReaderModal } from "./ReaderModal";

// Stub fetch: return empty arrays for any translation file so the hook
// resolves without a real network. The reader also lazy-loads tajweed /
// wordbyword when their toggles are on; keep those off for this test.
beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [null],
  }) as unknown as typeof fetch;
});

const surahs: Surah[] = [
  {
    id: 1,
    number: 1,
    nameAr: "الفاتحة",
    nameEn: "Al-Fatiha",
    meaning: "The Opening",
    type: "Meccan",
    ayahCount: 2,
    wordCount: 8,
    letterCount: 36,
    sajdaCount: 0,
    firstPage: 1,
    lastPage: 1,
    firstJuz: 1,
    lastJuz: 1,
    hasBismillah: false,
  },
];

const verses: Verse[] = [
  {
    id: 1,
    s: 1,
    a: 1,
    juz: 1,
    hizb: 1,
    rub: 1,
    ruku: 1,
    manzil: 1,
    page: 1,
    sajda: 0,
    w: 4,
    l: 19,
    ar: "بِسْمِ ٱللَّهِ",
  },
  {
    id: 2,
    s: 1,
    a: 2,
    juz: 1,
    hizb: 1,
    rub: 1,
    ruku: 1,
    manzil: 1,
    page: 1,
    sajda: 0,
    w: 4,
    l: 17,
    ar: "ٱلْحَمْدُ لِلَّهِ",
  },
];

const editions: EditionsIndex = {
  default: "en.sahih",
  editions: [
    {
      identifier: "en.sahih",
      language: "en",
      name: "Sahih",
      englishName: "Sahih International",
      type: "translation",
      count: 6236,
    },
  ],
};

const palette: Palette = {
  name: "Emerald",
  primary: "#10b981",
  pie: ["#10b981", "#8b5cf6"],
};

function renderReader(overrides?: Partial<Parameters<typeof ReaderModal>[0]>) {
  return render(
    <ReaderModal
      target={{ scope: "surah", value: 1 }}
      surahs={surahs}
      verses={verses}
      editions={editions}
      edition="en.sahih"
      onEditionChange={() => {}}
      colorMode="type"
      palette={palette}
      onNavigate={() => {}}
      onClose={() => {}}
      {...overrides}
    />,
  );
}

describe("ReaderModal", () => {
  it("renders the surah title and verse badges", () => {
    renderReader();
    expect(screen.getByText(/Al-Fatiha/)).toBeInTheDocument();
    expect(screen.getByText("1:1")).toBeInTheDocument();
    expect(screen.getByText("1:2")).toBeInTheDocument();
  });

  it("renders the Arabic text of each verse", () => {
    renderReader();
    expect(screen.getByText("بِسْمِ ٱللَّهِ")).toBeInTheDocument();
  });

  it("filters verses by Arabic search (diacritic-insensitive)", async () => {
    const user = userEvent.setup();
    renderReader();
    const input = screen.getByPlaceholderText(/Search/i);
    await user.type(input, "الحمد");
    // 1:2 contains "ٱلْحَمْدُ" which normalizes to "الحمد"
    expect(screen.getByText("1:2")).toBeInTheDocument();
    expect(screen.queryByText("1:1")).not.toBeInTheDocument();
  });

  it("shows the empty state when no verses match", async () => {
    const user = userEvent.setup();
    renderReader();
    await user.type(screen.getByPlaceholderText(/Search/i), "zzzzzz");
    expect(screen.getByText(/No verses match/i)).toBeInTheDocument();
  });

  it("calls onNavigate with the next surah on Next", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderReader({ onNavigate });
    await user.click(screen.getByRole("button", { name: /Next Surah/i }));
    expect(onNavigate).toHaveBeenCalledWith({ scope: "surah", value: 2 });
  });

  it("jumps to a typed scope value on Enter", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderReader({ onNavigate });
    const jump = screen.getByRole("textbox", { name: /Jump to Surah/i });
    await user.clear(jump);
    await user.type(jump, "18{Enter}");
    expect(onNavigate).toHaveBeenCalledWith({ scope: "surah", value: 18 });
  });

  it("clamps an out-of-range jump to the scope maximum", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderReader({ onNavigate });
    const jump = screen.getByRole("textbox", { name: /Jump to Surah/i });
    await user.clear(jump);
    await user.type(jump, "999{Enter}");
    expect(onNavigate).toHaveBeenCalledWith({ scope: "surah", value: 114 });
  });

  it("ignores a non-numeric jump and reverts the field", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderReader({ onNavigate });
    const jump = screen.getByRole<HTMLInputElement>("textbox", {
      name: /Jump to Surah/i,
    });
    await user.clear(jump);
    await user.type(jump, "abc{Enter}");
    expect(onNavigate).not.toHaveBeenCalled();
    expect(jump.value).toBe("1");
  });
});
