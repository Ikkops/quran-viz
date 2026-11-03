import { useLazyJson } from "./useLazyJson";
import type { Topic } from "../types/quran";

/** Lazily loads (and module-caches) the QUL topics with their ayahs, only when `enabled`. */
export function useTopics(enabled: boolean) {
  return useLazyJson<Topic[]>("topics.json", enabled);
}
