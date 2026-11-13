import { describe, expect, it } from "vitest";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import {
  DOWNLOADED_TAFSIR_PATHS,
  TAFSIR_EDITIONS,
  tafsirFiles,
  editionByIdentifier,
  groupTranslations,
  isRtl,
  langName,
} from "./editions";
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

describe("TAFSIR_EDITIONS", () => {
  // File names only (lazy globs load nothing): every tafsir needs the data
  // its kind is read from.
  const translations = Object.keys(
    import.meta.glob("../../public/data/translations/*.json"),
  );
  const grouped = Object.keys(import.meta.glob("../../public/data/tafsir/*/*.json"));

  it("has unique ids", () => {
    const ids = TAFSIR_EDITIONS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const t of TAFSIR_EDITIONS) {
    it(`${t.id} has ${t.kind === "ayah" ? "a translation file" : "114 surah files"}`, () => {
      if (t.kind === "ayah") {
        expect(translations).toContain(`../../public/data/translations/${t.id}.json`);
      } else {
        const files = grouped.filter((f) =>
          f.startsWith(`../../public/data/tafsir/${t.id}/`),
        );
        const surahs = files.map((f) => Number(f.split("/").pop()!.replace(".json", "")));
        expect(surahs.sort((a, b) => a - b)).toEqual(
          Array.from({ length: 114 }, (_, i) => i + 1),
        );
      }
    });
  }

  // The size the download offer quotes stays close to the real files.
  for (const t of TAFSIR_EDITIONS.filter((x) => x.download)) {
    it(`${t.id} quotes its download size`, () => {
      const bytes = tafsirFiles(t).reduce(
        (sum, f) => sum + statSync(resolve(__dirname, "../../public/data", f)).size,
        0,
      );
      expect(Math.abs(bytes - t.download!.bytes) / bytes).toBeLessThan(0.05);
    });
  }

  it("leaves only downloadable editions out of the app", () => {
    expect(DOWNLOADED_TAFSIR_PATHS).toEqual([
      "translations/id.jalalayn.json",
      "tafsir/id.kemenag-wajiz",
      "tafsir/id.kemenag-tahlili",
    ]);
  });
});
