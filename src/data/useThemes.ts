import { useLazyJson } from "./useLazyJson";
import type { ThemesData } from "../types/quran";

/** Lazily loads (and module-caches) the QUL section themes, only when `enabled`:
 *  QUL's English headings, or their Indonesian translation. */
export function useThemes(enabled: boolean, lang: "en" | "id" = "en") {
  return useLazyJson<ThemesData>(
    lang === "id" ? "themes-id.json" : "themes.json",
    enabled,
  );
}
