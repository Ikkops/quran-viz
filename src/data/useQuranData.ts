import { useEffect, useState } from "react";
import type { EditionsIndex, Meta, QuranData, Surah, Verse } from "../types/quran";
import { BASE } from "./base";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

interface State {
  data: QuranData | null;
  loading: boolean;
  error: string | null;
}

/** Loads the four core JSON files once on mount. */
export function useQuranData(): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    Promise.all([
      getJSON<Surah[]>("surahs.json"),
      getJSON<Verse[]>("verses.json"),
      getJSON<EditionsIndex>("editions.json"),
      getJSON<Meta>("meta.json"),
    ])
      .then(([surahs, verses, editions, meta]) => {
        if (!alive) return;
        setState({
          data: { surahs, verses, editions, meta },
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setState({ data: null, loading: false, error: String(err) });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
