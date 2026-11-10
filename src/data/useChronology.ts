import { useLazyJson } from "./useLazyJson";
import type { ChronologyData } from "../types/quran";

/** Lazily loads (and module-caches) the curated surah chronology, only when `enabled`. */
export function useChronology(enabled: boolean) {
  return useLazyJson<ChronologyData>("chronology.json", enabled);
}
