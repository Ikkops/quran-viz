import { describe, expect, it } from "vitest";
import {
  displayArabic,
  findArabicMatch,
  normalizeArabic,
  searchKeyArabic,
  stripDiacritics,
  wordFrequency,
} from "./arabic";

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

describe("searchKeyArabic", () => {
  const has = (text: string, q: string) =>
    searchKeyArabic(text).includes(searchKeyArabic(q));

  it("matches plain spelling against Uthmani spelling", () => {
    expect(has("وَيُقِيمُونَ ٱلصَّلَوٰةَ", "صلاة")).toBe(true);
    expect(has("خَلَقَ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضَ", "السماوات")).toBe(true);
    expect(has("ٱلَّذِى خَلَقَ", "الذي")).toBe(true);
    expect(has("عَلَىٰ كُلِّ شَىْءٍ قَدِيرٌ", "شيء")).toBe(true);
    expect(has("عَلَىٰ كُلِّ شَىْءٍ", "على")).toBe(true);
  });

  it("unifies hamza seats", () => {
    expect(has("ٱلْمُؤْمِنُونَ", "المومنون")).toBe(true);
    expect(has("أَنزَلْنَا", "انزلنا")).toBe(true);
  });

  it("does not match unrelated words", () => {
    expect(has("ٱلصَّلَوٰةَ", "زكاة")).toBe(false);
  });
});

describe("displayArabic", () => {
  it("writes the dagger alif out and drops harakat", () => {
    expect(displayArabic("ٱلسَّمَٰوَٰتِ")).toBe("السماوات");
    expect(displayArabic("ٱلصَّلَوٰةَ")).toBe("الصلاة");
    expect(displayArabic("عَلَىٰ")).toBe("على");
  });
});

describe("wordFrequency (Uthmani text)", () => {
  it("filters Uthmani-spelled particles and shows readable forms", () => {
    const cloud = wordFrequency(
      ["ٱلَّذِينَ فِى ٱلسَّمَٰوَٰتِ عَلَىٰ ٱلَّذِى", "فِى ٱلسَّمَٰوَٰتِ"],
      { arabic: true },
    );
    expect(cloud.map((w) => w.text)).toEqual(["السماوات"]);
    expect(cloud[0].value).toBe(2);
  });
});

describe("wordFrequency (English)", () => {
  it("drops common function words", () => {
    const cloud = wordFrequency(["they would had been one made mercy mercy"], {
      arabic: false,
    });
    expect(cloud).toEqual([{ text: "mercy", value: 2 }]);
  });
});

describe("findArabicMatch", () => {
  it("maps a keyed match back onto the Uthmani text", () => {
    const text = "وَيُقِيمُونَ ٱلصَّلَوٰةَ";
    const m = findArabicMatch(text, searchKeyArabic("صلاة"));
    expect(m).not.toBeNull();
    expect(text.slice(...m!)).toBe("صَّلَوٰةَ");
  });
  it("returns null when absent", () => {
    expect(findArabicMatch("بِسْمِ", searchKeyArabic("زكاة"))).toBeNull();
  });
});
