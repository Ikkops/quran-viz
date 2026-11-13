import { useLazyJson } from "./useLazyJson";
import type { TopicNode } from "../types/quran";

/** Lazily loads (and module-caches) the curated topic tree, only when `enabled`. */
export function useTopics(enabled: boolean) {
  return useLazyJson<TopicNode[]>("topics.json", enabled);
}
