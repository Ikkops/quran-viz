/**
 * Tajweed markup parsing.
 *
 * The `quran-tajweed` edition (exported to public/data/tajweed.json) annotates
 * the Uthmani text with flat rule spans of the form `[code:n[letters]` (the
 * `:n` group index is optional), e.g.
 *   بِسْمِ [h:1[ٱ]للَّهِ [h:2[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ
 * Spans are not nested. Each single-letter `code` maps to a tajweed rule below
 * (codes/colours follow the alquran.cloud tajweed convention).
 */

export interface TajweedSegment {
  text: string;
  rule?: string; // single-letter code; undefined ⇒ plain text
}

// Tajweed tag pattern. MIRRORS `TAJWEED_TAG` in scripts/build_data.py — keep
// them in sync if the edition's markup format changes.
const TAG = /\[([a-z]+)(?::\d+)?\[([^\]]*)\]/g;

export function parseTajweed(s: string): TajweedSegment[] {
  const out: TajweedSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ text: m[2], rule: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/**
 * Split tajweed-annotated text into whitespace-delimited words, each kept as a
 * list of coloured segments (a rule span can carry across a word's letters).
 * Used to colour word-by-word display, where the Arabic is shown per token.
 */
export function splitTajweedWords(marked: string): TajweedSegment[][] {
  const words: TajweedSegment[][] = [];
  let current: TajweedSegment[] = [];
  for (const seg of parseTajweed(marked)) {
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) {
        if (current.length) words.push(current);
        current = [];
      } else {
        current.push({ text: part, rule: seg.rule });
      }
    }
  }
  if (current.length) words.push(current);
  return words;
}

// Arabic letters (no harakat, Quranic marks, tatweel or ۞) and the alef
// variants unified before letters are compared.
const LETTER = /[\u0621-\u063A\u0641-\u064A\u0671-\u06D3\u06FA-\u06FF]/;
const ALEF_VARIANT = /[\u0671\u0622\u0623\u0625\u0672]/;
const letterKey = (c: string) => (ALEF_VARIANT.test(c) ? "\u0627" : c);

/** Letter positions in `text` and their comparison keys. */
function letters(text: string): { pos: number[]; keys: string[] } {
  const pos: number[] = [];
  const keys: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (LETTER.test(text[i])) {
      pos.push(i);
      keys.push(letterKey(text[i]));
    }
  }
  return { pos, keys };
}

/** For each index of `b`, the index of `a` it is matched to by a longest
 *  common subsequence (or -1). Identical sequences short-circuit. */
function matchLetters(a: string[], b: string[]): { match: Int32Array; common: number } {
  const n = a.length;
  const m = b.length;
  const match = new Int32Array(m).fill(-1);
  if (n === m && a.every((c, i) => c === b[i])) {
    for (let j = 0; j < m; j++) match[j] = j;
    return { match, common: m };
  }
  // dp[i][j] = LCS length of a[i..] and b[j..], row-major in one array.
  const w = m + 1;
  const dp = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i * w + j] =
        a[i] === b[j]
          ? dp[(i + 1) * w + j + 1] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      match[j] = i;
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
    else j++;
  }
  return { match, common: dp[0] };
}

/** The segments covering `text.slice(start, end)`, clipped at both ends. */
function sliceSegments(segs: TajweedSegment[], start: number, end: number) {
  const out: TajweedSegment[] = [];
  let at = 0;
  for (const seg of segs) {
    const from = Math.max(start, at);
    const to = Math.min(end, at + seg.text.length);
    if (to > from) out.push({ text: seg.text.slice(from - at, to - at), rule: seg.rule });
    at += seg.text.length;
  }
  return out;
}

/**
 * Cut tajweed-annotated text into one coloured piece per word-by-word item.
 *
 * Word-by-word items don't map 1:1 onto the tajweed text's whitespace words:
 * an English gloss can cover a phrase ("مِن قَبْلِكَ"), a word can be split
 * (أَوَ | لَمَّآ) or two joined (بَعْدَمَا), the Indonesian data is spelt
 * slightly differently, and the tajweed text keeps standalone ۞ marks. So the
 * two are aligned on their letters, and each item's piece ends where its last
 * letter's match does (at the following space when there is one, so harakat
 * and pause marks stay with their word). Returns null when the texts don't
 * align well enough; callers then show the items uncoloured.
 */
export function alignTajweedToWords(
  marked: string,
  words: string[],
): TajweedSegment[][] | null {
  if (words.length === 0) return null;
  const segs = parseTajweed(marked);
  const plain = segs.map((s) => s.text).join("");
  const taj = letters(plain);
  const wbwKeys: string[] = [];
  const bounds: number[] = []; // wbw letter index where each item starts
  for (const word of words) {
    bounds.push(wbwKeys.length);
    wbwKeys.push(...letters(word).keys);
  }
  if (taj.keys.length === 0 || wbwKeys.length === 0) return null;
  const { match, common } = matchLetters(taj.keys, wbwKeys);
  // Allow spelling differences (ٲ vs dagger alif, ٮ vs ى, an extra ء): up to
  // 10% of the letters, and at least 3 so short ayahs aren't rejected.
  const longest = Math.max(taj.keys.length, wbwKeys.length);
  if (common < longest - Math.max(3, 0.1 * longest) || common < 0.5 * longest)
    return null;

  // Text offset where item k starts (k = 0 → start of text).
  const cuts: number[] = [0];
  for (let k = 1; k < words.length; k++) {
    const b = bounds[k];
    let p = -1;
    for (let j = b - 1; j >= 0 && p < 0; j--) p = match[j];
    let q = -1;
    for (let j = b; j < wbwKeys.length && q < 0; j++) q = match[j];
    let cut: number;
    if (q < 0) cut = plain.length;
    else {
      const gapStart = p < 0 ? 0 : taj.pos[p] + 1;
      const gapEnd = taj.pos[q];
      const space = plain.slice(gapStart, gapEnd).search(/\s/);
      cut = space >= 0 ? gapStart + space : gapEnd;
    }
    cuts.push(Math.max(cut, cuts[k - 1]));
  }
  cuts.push(plain.length);

  const out: TajweedSegment[][] = [];
  for (let k = 0; k < words.length; k++) {
    let start = cuts[k];
    let end = cuts[k + 1];
    while (start < end && /\s/.test(plain[start])) start++;
    while (end > start && /\s/.test(plain[end - 1])) end--;
    if (!LETTER.test(plain.slice(start, end))) return null; // an item got no letters
    out.push(sliceSegments(segs, start, end));
  }
  return out;
}

export interface TajweedRule {
  name: string;
  color: string;
}

/** code → { rule name, colour }. Grouped by family for a readable legend. */
export const RULE_COLORS: Record<string, TajweedRule> = {
  // Madd (prolongation), short → long
  n: { name: "Natural prolongation (Madd Ṭabīʿī)", color: "#f59e0b" },
  p: { name: "Permissible prolongation (Madd Jāʾiz)", color: "#fb923c" },
  o: { name: "Obligatory prolongation — separate (Munfaṣil)", color: "#fb7185" },
  c: { name: "Obligatory prolongation — joined (Muttaṣil)", color: "#f43f5e" },
  m: { name: "Necessary prolongation (Madd Lāzim)", color: "#dc2626" },
  // Ghunnah / idghām (nasalization & merging)
  g: { name: "Ghunnah (nasalization)", color: "#16a34a" },
  a: { name: "Idghām with ghunnah", color: "#22c55e" },
  u: { name: "Idghām without ghunnah", color: "#6b7280" },
  d: { name: "Idghām (labial, mīm)", color: "#4b5563" },
  b: { name: "Idghām (mutajānisayn / mutaqāribayn)", color: "#374151" },
  // Ikhfāʾ / iqlāb / qalqalah
  f: { name: "Ikhfāʾ (hiding)", color: "#0ea5e9" },
  w: { name: "Ikhfāʾ (labial, mīm)", color: "#38bdf8" },
  i: { name: "Iqlāb (conversion)", color: "#8b5cf6" },
  q: { name: "Qalqalah (echo)", color: "#14b8a6" },
  // Silent / connecting
  h: { name: "Hamzat al-Waṣl (silent connecting hamza)", color: "#9ca3af" },
  s: { name: "Silent (not pronounced)", color: "#cbd5e1" },
  l: { name: "Lām Shamsiyyah (assimilated lām)", color: "#94a3b8" },
};

/** Ordered list for the legend (groups kept together). */
export const TAJWEED_LEGEND: { code: string; name: string; color: string }[] = [
  "n",
  "p",
  "o",
  "c",
  "m",
  "g",
  "a",
  "u",
  "d",
  "b",
  "f",
  "w",
  "i",
  "q",
  "h",
  "s",
  "l",
].map((code) => ({ code, ...RULE_COLORS[code] }));
