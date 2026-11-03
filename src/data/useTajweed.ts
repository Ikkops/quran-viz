import { useLazyJson } from "./useLazyJson";
import type { TajweedData } from "../types/quran";

export type { TajweedData };

/** Lazily loads (and module-caches) the tajweed-annotated Arabic, only when
 *  `enabled`. Returns a `LazyJsonState<TajweedData>`. */
export function useTajweed(enabled: boolean) {
  return useLazyJson<TajweedData>("tajweed.json", enabled);
}
