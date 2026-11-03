import { describe, expect, it } from "vitest";
import { parseTajweed, splitTajweedWords } from "./tajweed";

describe("splitTajweedWords", () => {
  it("splits a plain string into one segment per word", () => {
    const words = splitTajweedWords("اللَّهُ الرَّحْمَٰنِ");
    expect(words).toHaveLength(2);
    expect(words[0][0]).toEqual({ text: "اللَّهُ", rule: undefined });
  });

  it("carries the rule onto each segment within a ruled span", () => {
    const words = splitTajweedWords("بِسْمِ [h:1[ٱ]للَّهِ");
    // "بِسْمِ" plain, then "ٱ" ruled (h), then "للَّهِ" plain
    expect(words[0][0]).toEqual({ text: "بِسْمِ", rule: undefined });
    const hamzaWord = words.find((w) => w.some((s) => s.rule === "h"));
    expect(hamzaWord?.[0]).toEqual({ text: "ٱ", rule: "h" });
  });

  it("reconstructs the original text when rejoined", () => {
    const src = "بِسْمِ [h:1[ٱ]للَّهِ [n[ـٰ]نِ";
    const words = splitTajweedWords(src);
    const rejoined = words.map((w) => w.map((s) => s.text).join("")).join(" ");
    // plain text recovered (markup removed)
    expect(rejoined.replace(/\s+/g, "")).toBe("بِسْمِٱللَّهِـٰنِ");
  });

  it("handles a string with no markup", () => {
    expect(splitTajweedWords("الٓمٓ")).toEqual([[{ text: "الٓمٓ", rule: undefined }]]);
  });
});

describe("parseTajweed (extra)", () => {
  it("preserves whitespace between segments", () => {
    const segs = parseTajweed("a [h[bc]d");
    expect(segs.map((s) => s.text).join("")).toBe("a bcd");
  });
});
