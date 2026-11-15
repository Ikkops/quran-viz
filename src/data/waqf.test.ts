import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WAQF_SIGNS } from "./waqf";

const verses: { ar: string }[] = JSON.parse(
  readFileSync(resolve(__dirname, "../../public/data/verses.json"), "utf8"),
);

/** Occurrences of a sign, counted the way `waqf.ts` explains. */
function count(char: string): number {
  if (char === "\u06DB") {
    // Muʿānaqah: one per pair; every ayah with dots has exactly two.
    const perAyah = verses.map((v) => v.ar.split(char).length - 1).filter(Boolean);
    expect(perAyah.every((k) => k === 2)).toBe(true);
    return perAyah.length;
  }
  // Pause marks stand alone after a space; U+06DC inside a word (over ص) is not saktah.
  return verses.reduce(
    (sum, v) => sum + (v.ar.match(new RegExp(` ${char}`, "g"))?.length ?? 0),
    0,
  );
}

describe("stop signs", () => {
  it.each(WAQF_SIGNS.map((s) => [s.key, s] as const))(
    "%s count matches the text",
    (_k, s) => {
      expect(count(s.char)).toBe(s.count);
    },
  );

  it("never write a pause mark (other than U+06DC) inside a word", () => {
    for (const v of verses) expect(v.ar).not.toMatch(/[^ ][\u06D6-\u06DB]/);
  });
});
