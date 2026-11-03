import { describe, expect, it } from "vitest";
import { stripDiacritics, wordFrequency } from "./arabic";
import { boxStats, histogram, mean } from "./stats";
import { enrichVerses } from "./enrich";
import { categorizeOpening } from "./fawatih";
import { parseTajweed } from "./tajweed";
import type { Verse } from "../types/quran";

describe("arabic", () => {
  it("strips diacritics", () => {
    expect(stripDiacritics("بِسْمِ")).toBe("بسم");
    expect(stripDiacritics("ٱلْحَمْدُ").length).toBeLessThan("ٱلْحَمْدُ".length);
  });

  it("counts word frequency excluding stopwords", () => {
    const cloud = wordFrequency(["the light light of of of"], { arabic: false });
    expect(cloud.find((w) => w.text === "light")?.value).toBe(2);
    expect(cloud.find((w) => w.text === "the")).toBeUndefined(); // stopword
  });
});

describe("stats", () => {
  it("computes box stats", () => {
    const s = boxStats([1, 2, 3, 4, 5]);
    expect(s.min).toBe(1);
    expect(s.median).toBe(3);
    expect(s.max).toBe(5);
  });

  it("buckets a histogram", () => {
    const h = histogram([1, 2, 6, 7], 5);
    expect(h[0]).toMatchObject({ label: "1-5", count: 2 });
    expect(h[1]).toMatchObject({ label: "6-10", count: 2 });
  });

  it("means", () => {
    expect(mean([2, 4, 6])).toBe(4);
  });
});

describe("enrich", () => {
  it("accumulates global and per-juz totals", () => {
    const verses: Verse[] = [
      {
        id: 1,
        s: 1,
        a: 1,
        juz: 1,
        hizb: 1,
        rub: 1,
        ruku: 1,
        manzil: 1,
        page: 1,
        sajda: 0,
        w: 4,
        l: 19,
        ar: "",
      },
      {
        id: 2,
        s: 1,
        a: 2,
        juz: 1,
        hizb: 1,
        rub: 1,
        ruku: 1,
        manzil: 1,
        page: 1,
        sajda: 0,
        w: 4,
        l: 17,
        ar: "",
      },
      {
        id: 3,
        s: 2,
        a: 1,
        juz: 2,
        hizb: 5,
        rub: 5,
        ruku: 1,
        manzil: 1,
        page: 2,
        sajda: 0,
        w: 1,
        l: 3,
        ar: "",
      },
    ];
    const e = enrichVerses(verses);
    expect(e[1].cumulGlobalW).toBe(8);
    expect(e[1].cumulJuzW).toBe(8);
    expect(e[2].cumulGlobalW).toBe(9);
    expect(e[2].cumulJuzW).toBe(1); // juz reset
  });
});

describe("fawatih", () => {
  it("classifies surahs by opening category", () => {
    expect(categorizeOpening(2)).toBe("Muqatta'at");
    expect(categorizeOpening(1)).toBe("Praise & Glorification");
    expect(categorizeOpening(112)).toBe("Direct Command (Amr)");
    expect(categorizeOpening(91)).toBe("Divine Oath (Qasam)");
    expect(categorizeOpening(110)).toBe("Condition / Event (Idha)");
    expect(categorizeOpening(2000)).toBe("Statement / Narrative"); // default
  });
});

describe("tajweed", () => {
  it("splits markup into plain + ruled segments without losing text", () => {
    const segs = parseTajweed("بِسْمِ [h:1[ٱ]للَّهِ");
    expect(segs[0]).toEqual({ text: "بِسْمِ " });
    expect(segs.find((s) => s.rule === "h")?.text).toBe("ٱ");
    expect(segs.map((s) => s.text).join("")).toBe("بِسْمِ ٱللَّهِ");
  });

  it("returns one plain segment when there is no markup", () => {
    expect(parseTajweed("الٓمٓ")).toEqual([{ text: "الٓمٓ" }]);
  });
});
