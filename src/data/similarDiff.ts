// Where two look-alike ayahs (mutashabihat) differ, word by word.

// Pause marks, the rub' sign and the sajdah sign ride on a word but are not
// part of its wording.
const SIGNS = /[ۖ-ۜ۞۩\s]/g;
const key = (w: string) => w.replace(SIGNS, "");

/**
 * For each word of `a` and of `b`, whether it is outside their longest common
 * run of words (true = this word differs). Vowel marks count: two words that
 * differ only in a haraka are different words to someone reciting.
 */
export function diffWords(
  a: readonly string[],
  b: readonly string[],
): { a: boolean[]; b: boolean[] } {
  const ka = a.map(key);
  const kb = b.map(key);
  // lcs[i][j]: length of the longest common subsequence of ka[i..] and kb[j..].
  const lcs = Array.from({ length: ka.length + 1 }, () =>
    new Array<number>(kb.length + 1).fill(0),
  );
  for (let i = ka.length - 1; i >= 0; i--)
    for (let j = kb.length - 1; j >= 0; j--)
      lcs[i][j] =
        ka[i] === kb[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const da = ka.map(() => true);
  const db = kb.map(() => true);
  let i = 0;
  let j = 0;
  while (i < ka.length && j < kb.length) {
    if (ka[i] === kb[j]) {
      da[i++] = false;
      db[j++] = false;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  return { a: da, b: db };
}
