/**
 * Stop signs (tanda waqaf) for the Tajweed rules page, from the firmest stop
 * to the firmest "go on", then the two rare ones. `count` is how often each
 * occurs in the app's Uthmani text (`verses.json` `ar`); `waqf.test.ts`
 * recounts it and fails if the text changes.
 *
 * - Muʿānaqah (∴) dots come in pairs (always two in one ayah here): `count`
 *   is pairs, 12 marks = 6 pairs.
 * - U+06DC (small high seen) is also written over ص inside a word to note it
 *   may be read as س (يَبْصُۜطُ 2:245, بَصْۜطَةً 7:69). Only a standalone mark,
 *   after a space, is a saktah: 5 of the 7 (18:1, 36:52, 69:28, 75:27, 83:14).
 */
export interface WaqfSign {
  /** Key into `t.waqf.signs`. */
  key: string;
  /** The mark itself (a combining character: draw it on a base, e.g. NBSP). */
  char: string;
  /** Disc tint: rubric for the firm signs, illumination for the rest. */
  tone: "rubric" | "illumination";
  count: number;
}

export const WAQF_SIGNS: WaqfSign[] = [
  { key: "lazim", char: "\u06D8", tone: "rubric", count: 22 },
  { key: "qili", char: "\u06D7", tone: "illumination", count: 603 },
  { key: "jaiz", char: "\u06DA", tone: "illumination", count: 1972 },
  { key: "sili", char: "\u06D6", tone: "illumination", count: 1682 },
  { key: "la", char: "\u06D9", tone: "rubric", count: 68 },
  { key: "muanaqah", char: "\u06DB", tone: "illumination", count: 6 },
  { key: "saktah", char: "\u06DC", tone: "illumination", count: 5 },
];
