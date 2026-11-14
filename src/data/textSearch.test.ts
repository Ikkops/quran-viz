import { describe, expect, it } from "vitest";
import { findAllArabic, findAllLatin, isAyahRef, splitAt } from "./textSearch";

describe("findAllLatin", () => {
  it("finds every occurrence, ignoring case and accents", () => {
    const t = "Allah, Maha Pengasih; allah Maha Penyayang. Ṣalāt";
    expect(findAllLatin(t, "ALLAH")).toEqual([
      [0, 5],
      [22, 27],
    ]);
    expect(findAllLatin(t, "salat")).toEqual([[44, 49]]);
    expect(findAllLatin(t, "  ")).toEqual([]);
  });
});

describe("findAllArabic", () => {
  it("matches Uthmani spelling and covers the trailing marks", () => {
    const t = "ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ";
    const [r] = findAllArabic(t, "الصلاة");
    expect(t.slice(r[0], r[1])).toBe("ٱلصَّلَوٰةَ");
    expect(findAllArabic(t, "ون")).toHaveLength(2);
    expect(findAllArabic(t, "salat")).toEqual([]);
  });
});

describe("splitAt", () => {
  it("cuts text at the ranges", () => {
    expect(
      splitAt("abcdef", [
        [1, 2],
        [4, 6],
      ]),
    ).toEqual([
      ["a", -1],
      ["b", 0],
      ["cd", -1],
      ["ef", 1],
    ]);
  });
});

it("reads an ayah reference", () => {
  expect(isAyahRef("2:255", 2, 255)).toBe(true);
  expect(isAyahRef("255", 2, 255)).toBe(true);
  expect(isAyahRef("2:25", 2, 255)).toBe(false);
});
