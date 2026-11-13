import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EditionsIndex, Surah, Verse } from "../../types/quran";
import { resolvePalette, type Palette } from "../../theme/palettes";

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
    measure: () => {},
  }),
}));

import { ReaderView } from "./ReaderView";

// Stub fetch: return empty arrays for any translation file so the hook
// resolves without a real network. The reader also lazy-loads tajweed /
// wordbyword when their toggles are on; keep those off for this test.
beforeEach(() => {
  localStorage.clear();
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
    revelationOrder: 1,
    exceptions: 0,
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

const palette: Palette = resolvePalette("lapis", false);

function renderReader(overrides?: Partial<Parameters<typeof ReaderView>[0]>) {
  return render(
    <ReaderView
      target={{ scope: "surah", value: 1 }}
      surahs={surahs}
      verses={verses}
      editions={editions}
      edition="en.sahih"
      onEditionChange={() => {}}
      colorMode="type"
      palette={palette}
      arabicScale={1}
      onArabicScale={() => {}}
      onNavigate={() => {}}
      onClose={() => {}}
      bookmarks={[]}
      onBookmarks={() => {}}
      {...overrides}
    />,
  );
}

describe("ReaderView", () => {
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
    await user.click(screen.getByRole("button", { name: /Search in this view/i }));
    const input = screen.getByPlaceholderText(/Search/i);
    await user.type(input, "الحمد");
    // 1:2 contains "ٱلْحَمْدُ" which normalizes to "الحمد"
    expect(screen.getByText("1:2")).toBeInTheDocument();
    expect(screen.queryByText("1:1")).not.toBeInTheDocument();
  });

  it("shows the empty state when no verses match", async () => {
    const user = userEvent.setup();
    renderReader();
    await user.click(screen.getByRole("button", { name: /Search in this view/i }));
    await user.type(screen.getByPlaceholderText(/Search/i), "zzzzzz");
    expect(screen.getByText(/No ayahs match/i)).toBeInTheDocument();
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

  it("remembers display options and the intro language across reopen", async () => {
    const user = userEvent.setup();
    const first = renderReader();
    await user.click(screen.getByRole("button", { name: /Reader settings/i }));
    await user.click(screen.getByRole("switch", { name: /Transliteration/i }));
    await user.click(screen.getByRole("button", { name: /About this surah/i }));
    await user.click(screen.getByRole("button", { name: "Indonesia" }));
    first.unmount();

    renderReader();
    await user.click(screen.getByRole("button", { name: /Reader settings/i }));
    const translit = screen.getByRole("switch", { name: /Transliteration/i });
    expect(translit).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("qv.reader.infoLang")).toBe('"id"');
    await user.click(screen.getByRole("button", { name: /About this surah/i }));
    expect(screen.getByRole("button", { name: "Indonesia" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("bookmarks a verse through onBookmarks and shows bookmarked state", async () => {
    const onBookmarks = vi.fn();
    const { unmount } = renderReader({ onBookmarks });
    await userEvent.click(screen.getAllByRole("button", { name: "Bookmark ayah" })[0]);
    expect(onBookmarks).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, note: "" }),
    ]);
    unmount();
    renderReader({ bookmarks: [{ id: 1, note: "opening", at: 1 }] });
    expect(screen.getByRole("button", { name: "Remove bookmark" })).toBeInTheDocument();
    expect(screen.getByText("Note: opening")).toBeInTheDocument();
  });

  it("copies Arabic + reference and reports success or failure honestly", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderReader();
    await userEvent.click(screen.getAllByRole("button", { name: "More actions" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Copy ayah text" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(verses[0].ar));
    expect(writeText.mock.calls[0][0]).toMatch(/— Al-Fatiha 1:1$/);
    expect(await screen.findByText("Copied text")).toBeInTheDocument();

    writeText.mockRejectedValueOnce(new Error("denied"));
    await userEvent.click(screen.getAllByRole("button", { name: "More actions" })[1]);
    await userEvent.click(screen.getByRole("button", { name: "Copy ayah text" }));
    expect(await screen.findByText("Copy failed")).toBeInTheDocument();
  });
});
