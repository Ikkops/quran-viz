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

/** Uthmani dagger alif (U+0670): after waw (صلوٰة) or alef maqsura (علىٰ) it
 *  replaces/duplicates that letter; elsewhere it is a written alef (سمٰوٰت). */
function resolveDaggerAlif(text: string): string {
  return text
    .replace(/\u0648\u0670/g, "\u0627") // وٰ -> ا
    .replace(/\u0649\u0670/g, "\u0649") // ىٰ -> ى
    .replace(/\u0670/g, "\u0627"); // ٰ -> ا
}

/** Readable undiacritized form of a Uthmani word, for display (word cloud):
 *  dagger alif written out, harakat stripped, alef-wasla as plain alef. */
export function displayArabic(text: string): string {
  return stripDiacritics(resolveDaggerAlif(text)).replace(/\u0671/g, "\u0627");
}

const DIACRITIC_CHAR = new RegExp(DIACRITICS.source);
const UNIFY: Record<string, string> = {
  "\u0671": "\u0627", // ٱ
  "\u0622": "\u0627", // آ
  "\u0623": "\u0627", // أ
  "\u0625": "\u0627", // إ
  "\u0624": "\u0648", // ؤ -> و
  "\u0626": "\u064A", // ئ -> ي
  "\u0649": "\u064A", // ى -> ي
  "\u0629": "\u0647", // ة -> ه
};

/** The spelling-tolerant key of `text` plus, for each key character, the
 *  index of the source character it came from (for highlighting matches). */
export function arabicKeyWithMap(text: string): { key: string; map: number[] } {
  let key = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if ((c === "\u0648" || c === "\u0649") && next === "\u0670") {
      // وٰ -> ا ; ىٰ -> ي
      key += c === "\u0648" ? "\u0627" : "\u064A";
      map.push(i);
      i++;
      continue;
    }
    if (c === "\u0670") {
      key += "\u0627";
      map.push(i);
      continue;
    }
    if (c === "\u0640" || DIACRITIC_CHAR.test(c)) continue;
    key += UNIFY[c] ?? c;
    map.push(i);
  }
  return { key, map };
}

/** Spelling-tolerant matching key: dagger alif written out, diacritics
 *  stripped, alef/hamza seats unified, ى -> ي, ة -> ه, tatweel removed.
 *  Apply it to both the text and the query, so `صلاة` matches `ٱلصَّلَوٰةَ`,
 *  `الذي` matches `ٱلَّذِى`, and `شيء` matches `شَىْءٍ`. */
export function searchKeyArabic(text: string): string {
  return arabicKeyWithMap(text).key;
}

/** Source-string [start, end) of the first match of `qKey` (already keyed)
 *  in `text`, extended over trailing diacritics; null when absent. */
export function findArabicMatch(text: string, qKey: string): [number, number] | null {
  if (!qKey) return null;
  const { key, map } = arabicKeyWithMap(text);
  const idx = key.indexOf(qKey);
  if (idx < 0) return null;
  let end = map[idx + qKey.length - 1] + 1;
  while (end < text.length && (DIACRITIC_CHAR.test(text[end]) || text[end] === "\u0640"))
    end++;
  return [map[idx], end];
}

// Particles, pronouns and their common prefixed forms, excluded from the
// Arabic word cloud. Written plainly and keyed with searchKeyArabic, so they
// match the Uthmani text (ٱلَّذِينَ, فِى, عَلَىٰ…).
const ARABIC_STOPWORDS = new Set(
  `من في ما لا ان على الى عن هو هي هم هما نحن انت انتم انا اني انه انها انهم انكم انك
  ثم قد لقد ولقد كان كانوا يكون تكون كنتم كنت الذين والذين الذي التي اللذين اللاتي
  بما به بها بهم لهم لكم لنا له لها لك لي منه منها منهم منكم فيه فيها فيهم عليه عليها
  عليهم عليكم عليك اليه اليهم اليك الينا اذا فاذا واذا اذ واذ او ام كل بل يا ايها
  يايها ذلك ذلكم كذلك هذا هذه هولاء اولئك تلك الا الا ومن وما وان ولا فلا وهو وهم
  فان فمن فما لو ولو لم لن حتى هل اما انما كما مما عما مع لكن ولكن عند ليس اي ثمه
  ذالك ذالكم كذالك هاذا هاذه هاولاء أولائك وأولائك ياأيها ولاكن لاكن فلما لما لمن ألم
  وكان وقال بعد قبل دون عنهم بين بينهم بعض غير فقد لعلكم وإنا للذين إذا وإذ إذ ثم`
    .split(/\s+/)
    .filter(Boolean)
    .map(searchKeyArabic),
);

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
  "would",
  "had",
  "been",
  "one",
  "made",
  "except",
  "among",
  "over",
  "before",
  "after",
  "about",
  "any",
  "only",
  "most",
  "like",
  "other",
  "might",
  "does",
  "how",
  "until",
  "out",
  "every",
  "within",
  "between",
  "should",
  "can",
  "could",
  "never",
  "ever",
  "also",
  "more",
  "such",
  "very",
  "even",
  "himself",
  "themselves",
  "yourselves",
  "here",
  "me",
  "my",
  "i",
  "am",
  "let",
  "certainly",
  "surely",
  "while",
  "because",
  "whoever",
  "whatever",
  "thus",
  "nor",
  "therein",
  "two",
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
  // Arabic: count by matching key, show the most frequent surface form.
  const forms = new Map<string, Map<string, number>>();
  const stop = opts.arabic ? ARABIC_STOPWORDS : ENGLISH_STOPWORDS;
  for (const raw of texts) {
    if (!raw) continue;
    if (opts.arabic) {
      for (const tok of raw.split(/\s+/)) {
        const shown = displayArabic(tok).replace(/[^\u0621-\u064A]/g, "");
        const key = searchKeyArabic(shown);
        if (key.length < 2 || stop.has(key)) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        const f = forms.get(key) ?? new Map<string, number>();
        f.set(shown, (f.get(shown) ?? 0) + 1);
        forms.set(key, f);
      }
      continue;
    }
    for (const tok of raw
      .toLowerCase()
      .replace(/[^a-z\s']/g, " ")
      .split(/\s+/)) {
      const w = tok.replace(/^'+|'+$/g, "");
      if (w.length < 3 || stop.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const shownForm = (key: string) => {
    const f = forms.get(key);
    if (!f) return key;
    return [...f.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  return [...counts.entries()]
    .map(([key, value]) => ({ text: opts.arabic ? shownForm(key) : key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, opts.limit ?? 100);
}
