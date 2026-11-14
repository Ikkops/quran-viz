import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MARK_COLORS, initialMarks, movePin } from "../../lib/marks";
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
    nameId: "Al-Fatiha",
    name: "Al-Fatiha",
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
      marks={initialMarks({ pin: "Tilawah", collection: "Favourites" })}
      onMarks={() => {}}
      {...overrides}
    />,
  );
}

describe("ReaderView", () => {
  it("renders the surah title and one row per ayah, none highlighted", () => {
    renderReader();
    expect(screen.getByText(/Al-Fatiha/)).toBeInTheDocument();
    const first = screen.getByRole("article", { name: "1:1" });
    expect(screen.getByRole("article", { name: "1:2" })).toBeInTheDocument();
    // The marker is the ayah number alone.
    expect(
      within(first).getAllByRole("button", { name: /context/i })[0],
    ).toHaveTextContent(/^1$/);
    expect(first.className).not.toMatch(/bg-surface-sunken/);
  });

  it("highlights the ayah a link names", () => {
    renderReader({ target: { scope: "surah", value: 1, anchor: 2 } });
    expect(screen.getByRole("article", { name: "1:2" }).className).toMatch(
      /bg-surface-sunken/,
    );
    expect(screen.getByRole("article", { name: "1:1" }).className).not.toMatch(
      /bg-surface-sunken/,
    );
  });

  it("renders the Arabic text of each verse", () => {
    renderReader();
    // Each word is its own span (tappable for its details).
    const ar = screen.getAllByText(
      (_, el) => el?.tagName === "P" && el.getAttribute("lang") === "ar",
    );
    expect(ar.some((el) => el.textContent?.startsWith("بِسْمِ ٱللَّهِ"))).toBe(true);
  });

  it("marks every Arabic hit, counts them and steps between them", async () => {
    const user = userEvent.setup();
    renderReader();
    await user.click(screen.getByRole("button", { name: /Search in this view/i }));
    // "ٱللَّهِ" in 1:1 and "لِلَّهِ" in 1:2 both hold "لله".
    await user.type(screen.getByPlaceholderText(/Find a word/i), "لله");
    expect(screen.getByRole("status")).toHaveTextContent("1/2");
    // Both ayahs stay; the first hit is the current one.
    expect(screen.getByRole("article", { name: "1:1" })).toBeInTheDocument();
    const marks = document.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveAttribute("data-match-current", "true");
    await user.click(screen.getByRole("button", { name: "Next match" }));
    expect(screen.getByRole("status")).toHaveTextContent("2/2");
    expect(document.querySelectorAll("mark")[1]).toHaveAttribute(
      "data-match-current",
      "true",
    );
    await user.click(screen.getByPlaceholderText(/Find a word/i));
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("1/2");
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    renderReader();
    await user.click(screen.getByRole("button", { name: /Search in this view/i }));
    await user.type(screen.getByPlaceholderText(/Find a word/i), "zzzzzz");
    expect(screen.getByRole("status")).toHaveTextContent("0 found");
    expect(screen.getByRole("button", { name: "Next match" })).toBeDisabled();
  });

  it("continues to the next surah from the end of the text", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderReader({ onNavigate });
    await user.click(screen.getByRole("button", { name: /Continue to Surah 2/i }));
    expect(onNavigate).toHaveBeenCalledWith({ scope: "surah", value: 2 });
  });

  it("switches the division from settings and stays on the ayah", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderReader({ onNavigate, target: { scope: "surah", value: 1, anchor: 2 } });
    await user.click(screen.getByRole("button", { name: /Reader settings/i }));
    await user.click(screen.getByRole("combobox", { name: /Read by/ }));
    await user.click(screen.getByRole("option", { name: "Juz" }));
    expect(onNavigate).toHaveBeenCalledWith({ scope: "juz", value: 1, anchor: 2 });
    expect(localStorage.getItem("qv.reader.scope")).toBe('"juz"');
  });

  it("opens the tajweed rules from settings instead of a legend", async () => {
    const user = userEvent.setup();
    renderReader();
    await user.click(screen.getByRole("button", { name: /Reader settings/i }));
    await user.click(screen.getByRole("switch", { name: /Tajweed/i }));
    expect(screen.queryByText("Ghunnah (nasalization)")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tajweed rules" }));
    const sheet = screen.getByRole("dialog", { name: "Tajweed rules" });
    expect(
      within(sheet).getByText("Ikhfāʾ Shafawī (mīm before bāʾ)"),
    ).toBeInTheDocument();
  });

  it("goes to a chosen ayah from the title's sheet", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderReader({ onNavigate });
    await user.click(screen.getByRole("button", { name: /Al-Fatiha/ }));
    const sheet = screen.getByRole("dialog", { name: "Go to" });
    const ayahs = within(sheet).getByRole("listbox", { name: "Ayah" });
    await user.click(within(ayahs).getByRole("option", { name: "2" }));
    await user.click(within(sheet).getByRole("button", { name: "Go to Al-Fatiha 1:2" }));
    expect(onNavigate).toHaveBeenCalledWith({ scope: "surah", value: 1, anchor: 2 });
  });

  it("switches between ayahs and mushaf pages with one button", async () => {
    const user = userEvent.setup();
    renderReader();
    await user.click(screen.getByRole("button", { name: /Switch to/i }));
    expect(localStorage.getItem("qv.reader.mode")).toBe('"mushaf"');
    await user.click(screen.getByRole("button", { name: /Switch to/i }));
    expect(localStorage.getItem("qv.reader.mode")).toBe('"ayah"');
  });

  it("remembers display options and the intro language across reopen", async () => {
    const user = userEvent.setup();
    const first = renderReader();
    await user.click(screen.getByRole("button", { name: /Reader settings/i }));
    await user.click(screen.getByRole("switch", { name: /Transliteration/i }));
    await user.click(screen.getByRole("button", { name: /Al-Fatiha/ }));
    await user.click(screen.getByRole("button", { name: /About this surah/i }));
    await user.click(screen.getByRole("button", { name: "Indonesia" }));
    first.unmount();

    renderReader();
    await user.click(screen.getByRole("button", { name: /Reader settings/i }));
    const translit = screen.getByRole("switch", { name: /Transliteration/i });
    expect(translit).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("qv.reader.infoLang")).toBe('"id"');
    await user.click(screen.getByRole("button", { name: /Al-Fatiha/ }));
    await user.click(screen.getByRole("button", { name: /About this surah/i }));
    expect(screen.getByRole("button", { name: "Indonesia" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("pins an ayah and files it in a collection through onMarks", async () => {
    const user = userEvent.setup();
    const onMarks = vi.fn();
    const start = initialMarks({ pin: "Tilawah", collection: "Favourites" });
    const { unmount } = renderReader({ onMarks, marks: start });
    await user.click(screen.getAllByRole("button", { name: "Pin this ayah" })[1]);
    await user.click(
      within(screen.getByRole("dialog", { name: /Pin Al-Fatiha 1:2/ })).getByRole(
        "button",
        { name: /Tilawah/ },
      ),
    );
    expect(onMarks.mock.calls[0][0].pins[0]).toMatchObject({ ayah: 2 });
    unmount();

    onMarks.mockClear();
    renderReader({ onMarks, marks: movePin(start, "p1", 2) });
    expect(screen.getByRole("button", { name: "Pinned: Tilawah" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Save to a collection" })[0]);
    const sheet = screen.getByRole("dialog", { name: /Save Al-Fatiha 1:1/ });
    await user.click(within(sheet).getByRole("checkbox", { name: /Favourites/ }));
    expect(onMarks.mock.calls[0][0].collections[0].items[0]).toMatchObject({ id: 1 });
    // A new collection takes the ayah with it.
    await user.click(within(sheet).getByRole("button", { name: "New collection" }));
    await user.type(
      within(sheet).getByRole("textbox", { name: "Collection name" }),
      "Doa",
    );
    await user.click(within(sheet).getByRole("button", { name: "Save" }));
    const last = onMarks.mock.calls[onMarks.mock.calls.length - 1][0];
    const made = last.collections[last.collections.length - 1];
    expect(made).toMatchObject({ name: "Doa", items: [{ id: 1 }] });
    expect(MARK_COLORS).toContain(made.color);
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
