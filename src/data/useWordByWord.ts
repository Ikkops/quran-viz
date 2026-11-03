import { useLazyJson } from "./useLazyJson";
import type { WordByWordData } from "../types/quran";

/** Gloss language: English (`quran-wordbyword`) or Indonesian (QUL wbw-id,
 *  paired with QUL's own Arabic words, so word boundaries can differ). */
export type GlossLang = "en" | "id";

/** Lazily loads (and module-caches) the word-by-word Arabic+gloss data, only
 *  when `enabled`. Returns a `LazyJsonState<WordByWordData>`. */
export function useWordByWord(enabled: boolean, lang: GlossLang = "en") {
  return useLazyJson<WordByWordData>(
    lang === "id" ? "wordbyword-id.json" : "wordbyword.json",
    enabled,
  );
}
