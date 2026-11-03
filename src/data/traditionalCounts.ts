/** Classical/traditional scholarly counts of the Quran's words and letters.
 *
 *  These are *curated published figures*, NOT computed from the digital text.
 *  Classical counting uses conventions that differ from whitespace-tokenising the
 *  Uthmani text (e.g. joined particles count as one word, letters counted by
 *  traditional rules), so no digital tokenisation reproduces them — see
 *  `meta.countMethod`. Sources themselves vary by a few hundred; the figures
 *  below are among the most commonly quoted (the count widely attributed to the
 *  early reciters / Kufan tradition). They are shown alongside our computed
 *  totals so users can see both, not as a correction to ours. */
export const TRADITIONAL_COUNT = {
  words: 77439,
  letters: 323671,
} as const;
