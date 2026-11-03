import { useLazyJson } from "./useLazyJson";
import type { Morphology } from "../types/quran";

/** Lazily loads (and module-caches) the corpus morphology aggregate, only
 *  when `enabled`. Returns a `LazyJsonState<Morphology>`. */
export function useMorphology(enabled: boolean) {
  return useLazyJson<Morphology>("morphology.json", enabled);
}
