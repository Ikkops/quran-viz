import { describe, expect, it } from "vitest";
import { maskWord, maskedParts, type WordMask } from "./hifdh";

describe("maskWord", () => {
  it("hides everything at the last level", () => {
    expect(maskWord("ٱلْحَمْدُ", "hidden", true)).toEqual(["", "ٱلْحَمْدُ"]);
  });

  it("keeps only the ayah's first word", () => {
    expect(maskWord("ٱلْحَمْدُ", "first-word", true)).toEqual(["ٱلْحَمْدُ", ""]);
    expect(maskWord("لِلَّهِ", "first-word", false)).toEqual(["", "لِلَّهِ"]);
  });

  it("keeps the first letter with its marks", () => {
    // lam + kasra, then the rest
    expect(maskWord("لِلَّهِ", "first-letter", false)).toEqual(["لِ", "لَّهِ"]);
    // alef wasla carries no mark
    expect(maskWord("ٱلْحَمْدُ", "first-letter", true)).toEqual(["ٱ", "لْحَمْدُ"]);
    // shadda and fatha both stay with the letter
    expect(maskWord("رَّبِّ", "first-letter", false)).toEqual(["رَّ", "بِّ"]);
  });

  it("keeps a sign before the first letter", () => {
    const [show, hide] = maskWord("۞ إِنَّ", "first-letter", true);
    expect(show).toBe("۞ إِ");
    expect(hide).toBe("نَّ");
  });

  it("puts the parts back together", () => {
    for (const w of ["ٱلرَّحْمَٰنِ", "مَٰلِكِ", "۞ وَإِذَا", "صۤ"]) {
      const [show, hide] = maskWord(w, "first-letter", false);
      expect(show + hide).toBe(w);
    }
  });
});

describe("maskedParts", () => {
  const mask: WordMask = {
    level: "hidden",
    ayahShown: (id) => id === 2,
    wordShown: (id, w) => id === 1 && w === 3,
    stumbled: () => false,
  };

  it("hides nothing without a mask", () => {
    expect(maskedParts(null, 1, 0, "قُلْ")).toEqual(["قُلْ", ""]);
  });

  it("shows a revealed ayah and a peeked word", () => {
    expect(maskedParts(mask, 2, 0, "قُلْ")).toEqual(["قُلْ", ""]);
    expect(maskedParts(mask, 1, 3, "قُلْ")).toEqual(["قُلْ", ""]);
    expect(maskedParts(mask, 1, 2, "قُلْ")).toEqual(["", "قُلْ"]);
  });
});
