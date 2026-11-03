import { describe, expect, it } from "vitest";
import { groupTranslations, isRtl, langName, editionByIdentifier } from "./editions";
import type { EditionsIndex } from "../types/quran";

const index: EditionsIndex = {
  default: "en.sahih",
  editions: [
    {
      identifier: "en.sahih",
      language: "en",
      name: "Sahih International",
      englishName: "Sahih International",
      type: "translation",
      count: 6236,
    },
    {
      identifier: "en.pickthall",
      language: "en",
      name: "Pickthall",
      englishName: "Pickthall",
      type: "translation",
      count: 6236,
    },
    {
      identifier: "ar.muyassar",
      language: "ar",
      name: "Al-Muyassar",
      englishName: "Al-Muyassar",
      type: "tafsir",
      count: 6236,
    },
    {
      identifier: "fr.hamidullah",
      language: "fr",
      name: "Hamidullah",
      englishName: "Hamidullah",
      type: "translation",
      count: 6236,
    },
  ],
};

describe("isRtl", () => {
  it("flags RTL languages", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("fa")).toBe(true);
    expect(isRtl("ur")).toBe(true);
  });
  it("passes LTR languages", () => {
    expect(isRtl("en")).toBe(false);
    expect(isRtl("fr")).toBe(false);
  });
});

describe("langName", () => {
  it("returns the human name for known codes", () => {
    expect(langName("en")).toBe("English");
    expect(langName("ar")).toBe("Arabic");
  });
  it("upper-cases unknown codes", () => {
    expect(langName("xx")).toBe("XX");
  });
});

describe("groupTranslations", () => {
  it("groups translations by language, English first", () => {
    const groups = groupTranslations(index);
    expect(groups[0].language).toBe("en");
    expect(groups[0].editions).toHaveLength(2);
    // excludes tafsir
    expect(groups.find((g) => g.language === "ar")).toBeUndefined();
  });
  it("sorts editions within a group by englishName", () => {
    const groups = groupTranslations(index);
    const en = groups[0];
    expect(en.editions.map((e) => e.identifier)).toEqual(["en.pickthall", "en.sahih"]);
  });
});

describe("editionByIdentifier", () => {
  it("looks up an edition", () => {
    expect(editionByIdentifier(index, "en.sahih")?.name).toBe("Sahih International");
  });
  it("returns undefined for unknown", () => {
    expect(editionByIdentifier(index, "nope")).toBeUndefined();
  });
});
