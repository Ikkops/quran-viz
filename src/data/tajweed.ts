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
