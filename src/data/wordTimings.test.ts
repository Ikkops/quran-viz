import { describe, expect, it } from "vitest";
import { wordAt } from "./wordTimings";

describe("wordAt", () => {
  const flat = [0, 1, 100, 500, 1, 3, 520, 900];
  it("finds the segment being recited and holds it through pauses", () => {
    expect(wordAt(flat, 50)).toBeNull();
    expect(wordAt(flat, 300)).toEqual([0, 1]);
    expect(wordAt(flat, 510)).toEqual([0, 1]);
    expect(wordAt(flat, 600)).toEqual([1, 3]);
    expect(wordAt(flat, 5000)).toEqual([1, 3]);
    expect(wordAt(undefined, 10)).toBeNull();
  });
});
