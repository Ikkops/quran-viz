import { describe, expect, it } from "vitest";
import { describeTags, lemmasOfRoot, occurrencesOf, type Lexicon } from "./words";
import { en } from "../i18n/en";

describe("describeTags", () => {
  it("words a noun's features", () => {
    expect(describeTags("N|ACT|PCPL|(VIII)|MP|GEN", en.word)).toEqual({
      pos: "Noun",
      features: ["active participle", "form VIII", "masculine", "plural", "genitive"],
    });
  });
  it("splits person, gender and number", () => {
    expect(describeTags("V|IMPF|3FS|MOOD:JUS", en.word).features).toEqual([
      "imperfect (present/future)",
      "third person",
      "feminine",
      "singular",
      "jussive",
    ]);
  });
  it("is empty without tags and skips unknown ones", () => {
    expect(describeTags("", en.word)).toEqual({ pos: null, features: [] });
    expect(describeTags("ZZ|QQQ", en.word)).toEqual({ pos: null, features: [] });
  });
});

describe("lexicon helpers", () => {
  const lex: Lexicon = {
    roots: [["كتب", "ktb", 3]],
    lemmas: [
      ["كِتَٰب", 1, 2, "book", "kitab"],
      ["مِن", 0, 9, "from", "dari"],
      ["كَتَبَ", 1, 5, "wrote", "menulis"],
    ],
  };
  it("lists a root's lemmas by frequency", () => {
    expect(lemmasOfRoot(lex, 1)).toEqual([3, 1]);
  });
  it("pairs the flat occurrences", () => {
    expect(occurrencesOf([[], [8, 1, 9, 0]], 1)).toEqual([
      [8, 1],
      [9, 0],
    ]);
    expect(occurrencesOf([[]], 5)).toEqual([]);
  });
});
