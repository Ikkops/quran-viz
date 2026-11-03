import { describe, expect, it } from "vitest";
import { normalizeArabic, stripDiacritics, wordFrequency } from "./arabic";

describe("normalizeArabic", () => {
  it("strips diacritics", () => {
    expect(normalizeArabic("بِسْمِ")).toBe("بسم");
  });

  it("unifies alef variants (wasla, madda, hamza-below, hamza-above)", () => {
    expect(normalizeArabic("ٱللَّهِ")).toBe("الله");
    expect(normalizeArabic("آمن")).toBe("امن");
    expect(normalizeArabic("أَنْ إِنَّ")).toBe("ان ان");
  });

  it("removes tatweel", () => {
    expect(normalizeArabic("الـرَّحْمَٰن")).toBe("الرحمن");
  });

  it("lets diacritic-insensitive search match the Uthmani text", () => {
    const verse = normalizeArabic("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");
    expect(verse.includes("الله")).toBe(true);
    expect(verse.includes("بسم")).toBe(true);
  });
});

describe("wordFrequency (Arabic)", () => {
  it("excludes Arabic stopwords", () => {
    const cloud = wordFrequency(["مِنْ فِي مِنْ"], { arabic: true });
    const min = cloud.find((w) => w.text === "من");
    expect(min).toBeUndefined(); // stopword filtered
  });

  it("counts Arabic tokens after diacritic stripping", () => {
    const cloud = wordFrequency(["رَحْمَةٍ رَحْمَةٍ"], { arabic: true });
    expect(cloud.find((w) => w.text === "رحمة")?.value).toBe(2);
  });
});

describe("stripDiacritics", () => {
  it("leaves non-Arabic text untouched", () => {
    expect(stripDiacritics("hello world")).toBe("hello world");
  });
});
