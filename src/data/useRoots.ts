import { useLazyJson } from "./useLazyJson";
import type { RootEntry } from "../types/quran";

/** Lazily loads (and module-caches) every corpus root with its occurrences,
 *  only when `enabled`. Backs the root explorer. */
export function useRoots(enabled: boolean) {
  return useLazyJson<RootEntry[]>("roots.json", enabled);
}
