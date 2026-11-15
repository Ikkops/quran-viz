import { describe, expect, it } from "vitest";
import { diffWords } from "./similarDiff";

const marks = (flags: boolean[]) => flags.map((f) => (f ? "x" : ".")).join("");

describe("diffWords", () => {
  it("marks nothing in identical ayahs", () => {
    const w = ["فَبِأَيِّ", "ءَالَآءِ", "رَبِّكُمَا", "تُكَذِّبَانِ"];
    const d = diffWords(w, w);
    expect(marks(d.a)).toBe("....");
    expect(marks(d.b)).toBe("....");
  });

  it("marks a replaced word on both sides", () => {
    const d = diffWords(["a", "b", "c", "d"], ["a", "x", "c", "d"]);
    expect(marks(d.a)).toBe(".x..");
    expect(marks(d.b)).toBe(".x..");
  });

  it("marks words only one ayah has", () => {
    const d = diffWords(["a", "b", "c"], ["a", "c", "d", "e"]);
    expect(marks(d.a)).toBe(".x.");
    expect(marks(d.b)).toBe("..xx");
  });

  it("ignores pause marks but not vowel marks", () => {
    expect(marks(diffWords(["قُلْ ۖ"], ["قُلْ"]).a)).toBe(".");
    expect(marks(diffWords(["يَعْلَمُونَ"], ["تَعْلَمُونَ"]).a)).toBe("x");
    expect(marks(diffWords(["ٱلْكِتَٰبَ"], ["ٱلْكِتَٰبِ"]).a)).toBe("x");
  });
});
