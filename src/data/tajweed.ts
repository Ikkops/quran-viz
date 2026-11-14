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
  /** Colour on the day theme's paper, leaf and gutter. */
  color: string;
  /** Colour on the night theme's. */
  dark: string;
}

/** code → { rule name, colours }. Grouped by family for a readable legend:
 *  madd runs amber → deep red, ghunnah is green, idghām cool grey, ikhfāʾ
 *  blue, and letters that aren't pronounced warm grey. Every colour keeps at
 *  least 4.5:1 against all three surfaces of its theme (`tajweed.test.ts`).
 *
 *  What each code marks was checked against the edition itself: `c` is always
 *  mīm sākinah before bāʾ (ikhfāʾ shafawī), `w` mīm into mīm (idghām shafawī),
 *  `d` د→ت / ت→ط / ذ→ظ (mutajānisayn), `b` ل→ر / ق→ك (mutaqāribayn), `o` a
 *  long vowel before hamza in the word or the next, `p` a long vowel before a
 *  stop. */
export const RULE_COLORS: Record<string, TajweedRule> = {
  // Madd (prolongation), short → long
  n: { name: "Natural prolongation (Madd Ṭabīʿī)", color: "#9A5200", dark: "#FBBF24" },
  p: {
    name: "Prolongation at a stop (Madd ʿĀriḍ li-s-Sukūn)",
    color: "#B93A08",
    dark: "#FB923C",
  },
  o: {
    name: "Prolongation before hamza (Madd Wājib / Munfaṣil)",
    color: "#BE185D",
    dark: "#FDA4AF",
  },
  m: { name: "Necessary prolongation (Madd Lāzim)", color: "#7F1D1D", dark: "#F26060" },
  // Ghunnah / idghām (nasalization & merging)
  g: { name: "Ghunnah (nasalization)", color: "#137A39", dark: "#4ADE80" },
  a: { name: "Idghām with ghunnah", color: "#47750C", dark: "#A3E635" },
  u: { name: "Idghām without ghunnah", color: "#5F6878", dark: "#9CA3AF" },
  w: { name: "Idghām Shafawī (mīm into mīm)", color: "#4B5563", dark: "#B8BEC9" },
  d: { name: "Idghām Mutajānisayn", color: "#374151", dark: "#D1D5DB" },
  b: { name: "Idghām Mutaqāribayn", color: "#334155", dark: "#CBD5E1" },
  // Ikhfāʾ / iqlāb / qalqalah
  f: { name: "Ikhfāʾ (hiding)", color: "#0369A1", dark: "#38BDF8" },
  c: { name: "Ikhfāʾ Shafawī (mīm before bāʾ)", color: "#1D4ED8", dark: "#93C5FD" },
  i: { name: "Iqlāb (conversion)", color: "#7C3AED", dark: "#A78BFA" },
  q: { name: "Qalqalah (echo)", color: "#0F766E", dark: "#2DD4BF" },
  // Silent / connecting
  h: {
    name: "Hamzat al-Waṣl (silent connecting hamza)",
    color: "#6E6660",
    dark: "#A8A29E",
  },
  s: { name: "Silent (not pronounced)", color: "#80644F", dark: "#C4A88E" },
  l: { name: "Lām Shamsiyyah (assimilated lām)", color: "#57534E", dark: "#D6D3D1" },
};

/** Ordered list for the legend (groups kept together). */
export const TAJWEED_LEGEND: ({ code: string } & TajweedRule)[] = [
  "n",
  "p",
  "o",
  "m",
  "g",
  "a",
  "u",
  "w",
  "d",
  "b",
  "f",
  "c",
  "i",
  "q",
  "h",
  "s",
  "l",
].map((code) => ({ code, ...RULE_COLORS[code] }));

/** One real example per rule for the Tajweed rules page: the reference and the
 *  word(s) in the edition's own markup, only that rule's span kept. Taken from
 *  `tajweed.json` (Al-Fātiḥah first, then Juz ʿAmma), never typed by hand. */
export const TAJWEED_EXAMPLES: Record<string, { ref: string; marked: string }> = {
  n: { ref: "1:1", marked: "ٱلرَّحْمَ[n[ـٰ]نِ" },
  p: { ref: "1:1", marked: "ٱلرَّح[p[ِي]مِ" },
  o: { ref: "78:1", marked: "يَتَس[o[َا]ٓءَلُونَ" },
  m: { ref: "1:7", marked: "ٱلضّ[m[َا]ٓلِّينَ" },
  g: { ref: "78:1", marked: "عَ[g[مّ]َ" },
  a: { ref: "78:13", marked: "سِرَا[a[جًا و]َهَّاجًا" },
  u: { ref: "78:36", marked: "مّ[u[ِن ر]َّبِّكَ" },
  w: { ref: "83:4", marked: "أَنَّه[w[ُم م]َّبْعُوثُونَ" },
  d: { ref: "109:4", marked: "عَبَ[d[د]تُّمْ" },
  b: { ref: "4:158", marked: "بَ[b[ل] رَّفَعَهُ" },
  f: { ref: "78:12", marked: "سَبْ[f[عًا ش]ِدَادًا" },
  c: { ref: "79:14", marked: "ه[c[ُم ب]ِٱلسَّاهِرَةِ" },
  i: { ref: "80:16", marked: "كِرَا[i[مِۭ ب]َرَرَةٍ" },
  q: { ref: "78:6", marked: "نَ[q[جْ]عَلِ" },
  h: { ref: "1:1", marked: "[h[ٱ]للَّهِ" },
  s: { ref: "78:27", marked: "كَانُو[s[اْ]" },
  l: { ref: "1:1", marked: "ٱ[l[ل]رَّحْمَـٰنِ" },
};

/** The colour of a rule code in the current theme (undefined for unknown codes). */
export function tajweedColor(rule: string, dark: boolean): string | undefined {
  const r = RULE_COLORS[rule];
  return r && (dark ? r.dark : r.color);
}
