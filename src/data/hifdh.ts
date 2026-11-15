// Hafalan mode: how much of each word the reader shows while the learner
// recites from memory.

/** How much stays visible, from most to least. */
export const HIFDH_LEVELS = ["first-word", "first-letter", "hidden"] as const;
export type HifdhLevel = (typeof HIFDH_LEVELS)[number];

// Marks that sit on a letter (harakat, the dagger alif, the Qur'anic small
// signs) and the tatweel that carries some of them.
const MARK = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/;
const LETTER = /[ء-غف-يٮ-ۓ]/;

/**
 * Split `word` into the part to show and the part to hide. `first` says it is
 * the ayah's first word, which "first-word" keeps whole; "first-letter" keeps
 * each word's first letter with its marks (and any sign before it, such as ۞).
 */
export function maskWord(
  word: string,
  level: HifdhLevel,
  first: boolean,
): [show: string, hide: string] {
  if (level === "hidden") return ["", word];
  if (level === "first-word") return first ? [word, ""] : ["", word];
  let i = 0;
  while (i < word.length && !LETTER.test(word[i])) i++;
  if (i >= word.length) return [word, ""];
  i++;
  while (i < word.length && MARK.test(word[i])) i++;
  return [word.slice(0, i), word.slice(i)];
}

/** What the reader needs to draw (and uncover) hidden words. */
export interface WordMask {
  level: HifdhLevel;
  /** The whole ayah was revealed. */
  ayahShown: (id: number) => boolean;
  /** This one word (index from 0) was peeked at. */
  wordShown: (id: number, w: number) => boolean;
  /** The learner has stumbled on this word before. */
  stumbled: (id: number, w: number) => boolean;
}

/** The visible and hidden parts of word `w` (from 0) of ayah `id`; nothing is
 *  hidden without a mask, in a revealed ayah, or for a peeked word. */
export function maskedParts(
  mask: WordMask | null | undefined,
  id: number,
  w: number,
  word: string,
): [show: string, hide: string] {
  if (!mask || mask.ayahShown(id) || mask.wordShown(id, w)) return [word, ""];
  return maskWord(word, mask.level, w === 0);
}
