// Arabic text utilities: diacritic stripping and word-frequency for clouds.

// Harakat, tanwin, superscript alef, Quranic annotation marks, tatweel.
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g;

export function stripDiacritics(text: string): string {
  return text.replace(DIACRITICS, "");
}

/** Normalize Arabic for matching/searching: strip diacritics, unify alef
 *  variants (wasla ٱ U+0671, madda آ, dagger alif), and remove tatweel.
 *  Per CLAUDE.md: any prefix/text matching on Arabic must normalize alef
 *  variants first or it silently misclassifies. */
export function normalizeArabic(text: string): string {
  return stripDiacritics(text)
    .replace(/[\u0671\u0622\u0623\u0625]/g, "\u0627") // ٱ آ أ إ -> ا
    .replace(/\u0640/g, ""); // tatweel
}

// Common Arabic particles / pronouns to exclude from the Arabic word cloud.
const ARABIC_STOPWORDS = new Set([
  "من",
  "في",
  "ما",
  "لا",
  "ان",
  "إن",
  "أن",
  "على",
  "إلى",
  "الى",
  "عن",
  "هو",
  "هي",
  "هم",
  "ثم",
  "قد",
  "كان",
  "كانوا",
  "الذين",
  "الذي",
  "التي",
  "بما",
  "به",
  "لهم",
  "لكم",
  "لنا",
  "اذا",
  "إذا",
  "او",
  "أو",
  "كل",
  "بل",
  "يا",
  "ها",
  "ذلك",
  "هذا",
  "هذه",
  "الا",
  "إلا",
  "عليهم",
  "ومن",
  "وما",
  "وان",
  "ولا",
  "فلا",
  "وهو",
  "انا",
  "إنا",
  "اللذين",
]);

const ENGLISH_STOPWORDS = new Set([
  "the",
  "and",
  "of",
  "to",
  "in",
  "is",
  "that",
  "they",
  "for",
  "you",
  "your",
  "will",
  "with",
  "not",
  "have",
  "has",
  "are",
  "be",
  "but",
  "who",
  "from",
  "their",
  "them",
  "him",
  "his",
  "her",
  "she",
  "we",
  "us",
  "our",
  "it",
  "its",
  "as",
  "on",
  "by",
  "or",
  "an",
  "a",
  "if",
  "all",
  "do",
  "did",
  "done",
  "were",
  "was",
  "what",
  "when",
  "which",
  "this",
  "those",
  "these",
  "then",
  "there",
  "than",
  "into",
  "unto",
  "upon",
  "shall",
  "may",
  "are",
  "no",
  "yes",
  "o",
  "indeed",
  "verily",
  "say",
  "said",
  "those",
  "whom",
  "so",
  "ye",
  "thee",
  "thou",
  "thy",
  "hath",
  "doth",
  "lo",
]);

export interface CloudWord {
  text: string;
  value: number;
}

export function wordFrequency(
  texts: Iterable<string>,
  opts: { arabic: boolean; limit?: number },
): CloudWord[] {
  const counts = new Map<string, number>();
  const stop = opts.arabic ? ARABIC_STOPWORDS : ENGLISH_STOPWORDS;
  for (const raw of texts) {
    if (!raw) continue;
    const cleaned = opts.arabic
      ? stripDiacritics(raw)
      : raw.toLowerCase().replace(/[^a-z\s']/g, " ");
    for (const tok of cleaned.split(/\s+/)) {
      const w = tok.trim();
      if (w.length < (opts.arabic ? 2 : 3)) continue;
      if (stop.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, opts.limit ?? 100);
}
