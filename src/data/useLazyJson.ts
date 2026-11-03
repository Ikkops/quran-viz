import { useEffect, useState } from "react";
import { dataUrl } from "./base";

export interface LazyJsonState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Module-global cache: url -> parsed data. Survives across hook instances. */
const cache = new Map<string, unknown>();
/** Inflight requests: url -> promise. Dedupes parallel callers. */
const inflight = new Map<string, Promise<unknown>>();

/**
 * Lazily fetches and module-caches a static JSON file under `data/`.
 * Only fetches when `enabled` is true. The result is cached for the
 * lifetime of the page session (no eviction — these are small singleton
 * files). Reused by the per-feature hooks below.
 */
export function useLazyJson<T>(path: string, enabled = true): LazyJsonState<T> {
  const url = dataUrl(path);
  const [state, setState] = useState<LazyJsonState<T>>(() => {
    const cached = cache.get(url) as T | undefined;
    return { data: cached ?? null, loading: enabled && !cached, error: null };
  });

  useEffect(() => {
    if (!enabled) {
      setState((s) => (s.data ? s : { data: null, loading: false, error: null }));
      return;
    }
    const cached = cache.get(url) as T | undefined;
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }
    let alive = true;
    setState({ data: null, loading: true, error: null });

    let p = inflight.get(url) as Promise<T> | undefined;
    if (!p) {
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`${path}: ${r.status}`);
          return r.json() as Promise<T>;
        })
        .then((d) => {
          cache.set(url, d);
          inflight.delete(url);
          return d;
        })
        .catch((e) => {
          inflight.delete(url);
          throw e;
        });
      inflight.set(url, p);
    }
    p.then(
      (d) => alive && setState({ data: d, loading: false, error: null }),
      (e) => alive && setState({ data: null, loading: false, error: String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [enabled, url, path]);

  return state;
}
