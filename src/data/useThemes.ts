import { useLazyJson } from "./useLazyJson";
import type { ThemesData } from "../types/quran";

/** Lazily loads (and module-caches) the QUL section themes, only when `enabled`. */
export function useThemes(enabled: boolean) {
  return useLazyJson<ThemesData>("themes.json", enabled);
}
