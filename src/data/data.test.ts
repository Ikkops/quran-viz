import { describe, expect, it } from "vitest";
import { stripDiacritics, wordFrequency } from "./arabic";
import { boxStats, histogram, mean } from "./stats";
import { categorizeOpening } from "./fawatih";
import { parseTajweed } from "./tajweed";

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
    // The longest value closes the last bar: no empty one after it.
    expect(histogram([3, 10], 5)).toHaveLength(2);
  });

  it("means", () => {
    expect(mean([2, 4, 6])).toBe(4);
  });
});

describe("fawatih", () => {
  it("classifies surahs by opening category", () => {
    expect(categorizeOpening(2)).toBe("Muqatta'at");
    expect(categorizeOpening(1)).toBe("Praise & Glorification");
    expect(categorizeOpening(112)).toBe("Direct Command (Amr)");
    expect(categorizeOpening(91)).toBe("Divine Oath (Qasam)");
    expect(categorizeOpening(110)).toBe("Condition / Event (Idha)");
    // al-Suyuti: 10 surahs open with a call (nida'), 7 with a condition (shart).
    expect(categorizeOpening(63)).toBe("Condition / Event (Idha)");
    expect(categorizeOpening(73)).toBe("Call (Nida')");
    expect(categorizeOpening(74)).toBe("Call (Nida')");
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
