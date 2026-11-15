import { describe, expect, it } from "vitest";
import { ayahInView, shouldFollow } from "./ayahInView";

const band = { top: 100, bottom: 600 };

describe("ayahInView", () => {
  it("counts a row by its top, or when it covers the band", () => {
    expect(ayahInView([{ top: 120, bottom: 900 }], band, true)).toBe(true);
    expect(ayahInView([{ top: 0, bottom: 900 }], band, true)).toBe(true);
    // Only the tail of a long row (its tafsir) shows: the Arabic is gone.
    expect(ayahInView([{ top: 0, bottom: 400 }], band, true)).toBe(false);
    expect(ayahInView([{ top: 650, bottom: 900 }], band, true)).toBe(false);
  });

  it("counts words when one of them sits in the band", () => {
    const words = [
      { top: 40, bottom: 80 },
      { top: 560, bottom: 620 },
    ];
    expect(ayahInView(words, band, false)).toBe(true);
    // Half hidden under the head, half below the bottom: not readable.
    expect(ayahInView([{ top: 70, bottom: 120 }], band, false)).toBe(false);
    expect(ayahInView([{ top: 590, bottom: 640 }], band, false)).toBe(false);
  });

  it("is not in view when nothing is rendered", () => {
    expect(ayahInView([], band, false)).toBe(false);
    expect(ayahInView([], band, true)).toBe(false);
  });
});

describe("shouldFollow", () => {
  it("scrolls only to an ayah out of view while the learner was following", () => {
    expect(shouldFollow(true, true)).toBe(false);
    expect(shouldFollow(false, true)).toBe(true);
    expect(shouldFollow(false, null)).toBe(true);
    expect(shouldFollow(false, false)).toBe(false);
  });
});
