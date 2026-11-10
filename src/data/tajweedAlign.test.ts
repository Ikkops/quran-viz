import { describe, expect, it } from "vitest";
import { alignTajweedToWords, parseTajweed } from "./tajweed";

const text = (pieces: { text: string }[][]) =>
  pieces.map((p) => p.map((s) => s.text).join(""));

describe("alignTajweedToWords", () => {
  it("lets one item cover a phrase and keeps rule colours", () => {
    const out = alignTajweedToWords("مِن [q[قَ]بْلِكَ وَ[h[ٱ]لْءَاخِرَةِ", [
      "مِن قَبْلِكَ",
      "وَٱلْءَاخِرَةِ",
    ]);
    expect(out && text(out)).toEqual(["مِن قَبْلِكَ", "وَٱلْءَاخِرَةِ"]);
    expect(out?.[0]).toContainEqual({ text: "قَ", rule: "q" });
  });

  it("splits one written word across two items", () => {
    const out = alignTajweedToWords("أَوَلَمَّآ أَصَـٰبَتْكُم", [
      "أَوَ",
      "لَمَّآ",
      "أَصَـٰبَتْكُم",
    ]);
    expect(out && text(out)).toEqual(["أَوَ", "لَمَّآ", "أَصَـٰبَتْكُم"]);
  });

  it("joins two written words into one item", () => {
    const out = alignTajweedToWords("بَعْدَ مَا تَبَيَّنَ", ["بَعْدَمَا", "تَبَيَّنَ"]);
    expect(out && text(out)).toEqual(["بَعْدَ مَا", "تَبَيَّنَ"]);
  });

  it("keeps a leading ۞ with the first item", () => {
    const out = alignTajweedToWords("۞ إِنَّ ٱللَّهَ", ["إِنَّ", "ٱللَّهَ"]);
    expect(out && text(out)).toEqual(["۞ إِنَّ", "ٱللَّهَ"]);
  });

  it("returns null for unrelated text", () => {
    expect(alignTajweedToWords("بِسْمِ", ["قُلْ"])).toBeNull();
  });
});

// Every ayah, both gloss languages, against the real data files.
describe("alignTajweedToWords on the full dataset", () => {
  // Raw text via Vite (no Node types in this project, and a typed JSON import
  // would make tsc infer types for megabytes of data).
  const files = import.meta.glob<string>(
    "../../public/data/{tajweed,wordbyword,wordbyword-id}.json",
    { query: "?raw", import: "default", eager: true },
  );
  const load = (f: string) => JSON.parse(files[`../../public/data/${f}`]);
  const tajweed: (string | null)[] = load("tajweed.json");
  const LETTERS = /[ء-غف-يٱ-ۓۺ-ۿ]/g;
  const letterCount = (s: string) => s.match(LETTERS)?.length ?? 0;

  for (const file of ["wordbyword.json", "wordbyword-id.json"]) {
    it(`aligns every ayah of ${file} without losing or repeating letters`, () => {
      const wbw: ([string, string][] | null)[] = load(file);
      const failed: number[] = [];
      for (let id = 1; id < tajweed.length; id++) {
        const marked = tajweed[id];
        const items = wbw[id];
        if (!marked || !items) continue;
        const out = alignTajweedToWords(
          marked,
          items.map(([ar]) => ar),
        );
        const plain = parseTajweed(marked)
          .map((s) => s.text)
          .join("");
        if (
          !out ||
          out.length !== items.length ||
          letterCount(text(out).join("")) !== letterCount(plain)
        )
          failed.push(id);
      }
      expect(failed).toEqual([]);
    }, 60_000);
  }
});
