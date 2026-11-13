import { describe, expect, it } from "vitest";
import type { Edition } from "../types/quran";
import { isLatinQuery, searchEditionFor } from "./searchEdition";

const ed = (identifier: string, language: string): Edition => ({
  identifier,
  language,
  name: identifier,
  englishName: identifier,
  type: "translation",
  count: 6236,
});
const EDITIONS = [
  ed("en.sahih", "en"),
  ed("id.indonesian", "id"),
  ed("id.kemenag-qul", "id"),
];

describe("isLatinQuery", () => {
  it("detects Latin-script queries", () => {
    expect(isLatinQuery("sabar")).toBe(true);
    expect(isLatinQuery("Musa")).toBe(true);
    expect(isLatinQuery("صبر")).toBe(false);
    expect(isLatinQuery("2:255")).toBe(false);
    expect(isLatinQuery("sabar صبر")).toBe(false);
  });
});

describe("searchEditionFor", () => {
  it("keeps the reader's edition when it matches the UI language", () => {
    expect(searchEditionFor("id", "id.indonesian", EDITIONS)).toBe("id.indonesian");
    expect(searchEditionFor("en", "en.sahih", EDITIONS)).toBe("en.sahih");
  });

  it("switches to the UI language's preferred edition", () => {
    expect(searchEditionFor("id", "en.sahih", EDITIONS)).toBe("id.kemenag-qul");
  });

  it("falls back to the first edition in the language, then the reader's", () => {
    const noKemenag = [ed("en.sahih", "en"), ed("id.indonesian", "id")];
    expect(searchEditionFor("id", "en.sahih", noKemenag)).toBe("id.indonesian");
    expect(searchEditionFor("fr", "en.sahih", EDITIONS)).toBe("en.sahih");
  });
});
