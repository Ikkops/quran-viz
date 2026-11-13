import { describe, expect, it } from "vitest";
import type { Verse } from "../types/quran";
import {
  ayahAt,
  ayahInNextRow,
  buildMapLayout,
  REVEAL_FADE,
  revealAlpha,
  revealStarts,
} from "./mushafMap";

const v = (id: number, juz: number, l: number): Verse =>
  ({ id, s: 1, a: id, juz, l, w: 1 }) as Verse;

// Juz 1: ayahs 1–3 (letters 10, 20, 10 = 40); juz 2: ayahs 4–5 (10, 10 = 20).
const verses = [v(1, 1, 10), v(2, 1, 20), v(3, 1, 10), v(4, 2, 10), v(5, 2, 10)];

describe("buildMapLayout", () => {
  const L = buildMapLayout(verses);
  it("makes one row per juz, sized against the longest", () => {
    expect(L.rows.map((r) => [r.n, r.first, r.last, r.length])).toEqual([
      [1, 1, 3, 1],
      [2, 4, 5, 0.5],
    ]);
  });
  it("gives each ayah a span proportional to its letters", () => {
    expect([L.x0[2], L.x1[2]]).toEqual([0.25, 0.75]);
    expect([L.row[5], L.x0[5], L.x1[5]]).toEqual([1, 0.25, 0.5]);
  });
  it("finds the ayah under a position, clamping at the ends", () => {
    expect(ayahAt(L, 0, 0.1)).toBe(1);
    expect(ayahAt(L, 0, 0.5)).toBe(2);
    expect(ayahAt(L, 0, 0.8)).toBe(3);
    expect(ayahAt(L, 1, 0.9)).toBe(5);
    expect(ayahAt(L, 1, -1)).toBe(4);
  });
  it("moves between rows at the same position", () => {
    expect(ayahInNextRow(L, 2, 1)).toBe(5);
    expect(ayahInNextRow(L, 4, -1)).toBe(1);
    expect(ayahInNextRow(L, 1, -1)).toBe(1);
  });
});

describe("reveal", () => {
  // Surah 96 was revealed first, surah 2 late, surah 1 fifth; 999 has no order.
  const order: Record<number, number> = { 96: 1, 1: 5, 2: 87 };
  const vs = [
    { id: 1, s: 1 },
    { id: 2, s: 2 },
    { id: 3, s: 96 },
    { id: 4, s: 999 },
  ] as Verse[];
  const starts = revealStarts(vs, (s) => order[s]);

  it("starts each surah by its revelation order, unknowns last", () => {
    expect(starts[3]).toBe(0);
    expect(starts[1]).toBeGreaterThan(starts[3]);
    expect(starts[2]).toBeGreaterThan(starts[1]);
    expect(starts[4]).toBeCloseTo(1 - REVEAL_FADE);
  });

  it("fades each ayah in and ends fully shown", () => {
    expect(revealAlpha(0.5, 0.4)).toBe(0);
    expect(revealAlpha(0.5, 0.5 + REVEAL_FADE / 2)).toBeCloseTo(0.5);
    for (let id = 1; id <= 4; id++) expect(revealAlpha(starts[id], 1)).toBe(1);
  });
});
