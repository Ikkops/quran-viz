import { useLazyJson } from "./useLazyJson";
import type { AsbabData } from "../types/quran";

/** Lazily loads (and module-caches) the verified asbab al-nuzul, only when `enabled`. */
export function useAsbab(enabled: boolean) {
  return useLazyJson<AsbabData>("asbab.json", enabled);
}
