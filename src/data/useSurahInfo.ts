import { useLazyJson } from "./useLazyJson";
import type { SurahInfoData } from "../types/quran";

export type InfoLang = "en" | "id";

/** Lazily loads (and module-caches) the QUL surah introductions in one
 *  language, only when `enabled`. */
export function useSurahInfo(lang: InfoLang, enabled: boolean) {
  return useLazyJson<SurahInfoData>(`surah-info-${lang}.json`, enabled);
}
