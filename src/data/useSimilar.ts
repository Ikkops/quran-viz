import { useLazyJson } from "./useLazyJson";
import type { SimilarData } from "../types/quran";

/** Lazily loads (and module-caches) the QUL similar-ayah pairs, only when
 *  `enabled`. Backs the similar-verses arc diagram. */
export function useSimilar(enabled: boolean) {
  return useLazyJson<SimilarData>("similar.json", enabled);
}
