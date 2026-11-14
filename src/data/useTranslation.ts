import { useEffect, useMemo, useState } from "react";
import type { TranslationData } from "../types/quran";
import { dataFileUrl } from "./tafsirStore";

/** Maximum number of editions to keep in memory. Each translation file is
 *  ~1.3 MB on average; 24 caps the cache near ~30 MB. Least-recently-inserted
 *  editions are evicted (good enough — users rarely flip back through many). */
const MAX_CACHE = 24;
const cache = new Map<string, TranslationData>();
const inflight = new Map<string, Promise<TranslationData>>();

function remember(identifier: string, data: TranslationData): void {
  cache.set(identifier, data);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export function loadTranslation(identifier: string): Promise<TranslationData> {
  const cached = cache.get(identifier);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(identifier);
  if (existing) return existing;

  const p = dataFileUrl(`translations/${identifier}.json`)
    .then((url) => fetch(url))
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${identifier}: ${res.status}`);
      return res.json() as Promise<TranslationData>;
    })
    .then((data) => {
      remember(identifier, data);
      inflight.delete(identifier);
      return data;
    })
    .catch((err) => {
      inflight.delete(identifier);
      throw err;
    });
  inflight.set(identifier, p);
  return p;
}

interface State {
  data: TranslationData | null;
  loading: boolean;
  error: string | null;
}

/** Lazily loads (and caches) a single edition by identifier. */
export function useTranslation(identifier: string | null): State {
  const [state, setState] = useState<State>({
    data: identifier ? (cache.get(identifier) ?? null) : null,
    loading: !!identifier && !cache.has(identifier),
    error: null,
  });

  useEffect(() => {
    if (!identifier) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const cached = cache.get(identifier);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }
    let alive = true;
    setState({ data: null, loading: true, error: null });
    loadTranslation(identifier)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch(
        (err) => alive && setState({ data: null, loading: false, error: String(err) }),
      );
    return () => {
      alive = false;
    };
  }, [identifier]);

  return state;
}

/** Several editions at once (the reader's extra translations and tafsirs):
 *  one state per identifier, in the same order. */
export function useTranslations(identifiers: string[]): State[] {
  const key = identifiers.join("|");
  const [states, setStates] = useState<Record<string, State>>({});
  useEffect(() => {
    let alive = true;
    for (const id of identifiers) {
      if (cache.has(id)) continue;
      setStates((s) => ({ ...s, [id]: { data: null, loading: true, error: null } }));
      loadTranslation(id)
        .then(
          (data) =>
            alive &&
            setStates((s) => ({ ...s, [id]: { data, loading: false, error: null } })),
        )
        .catch(
          (err) =>
            alive &&
            setStates((s) => ({
              ...s,
              [id]: { data: null, loading: false, error: String(err) },
            })),
        );
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // The same array until something loads, so callers can memoise on it.
  return useMemo(
    () =>
      identifiers.map((id) => {
        const hit = cache.get(id);
        if (hit) return { data: hit, loading: false, error: null };
        return states[id] ?? { data: null, loading: true, error: null };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, states],
  );
}
