import { useEffect, useState } from "react";
import { dataFileUrl } from "./tafsirStore";
import type { GroupedTafsirRow } from "./sections";

/** `<ident>/<surah>` -> parsed rows. Per-surah files are small (≤ ~0.7 MB). */
const cache = new Map<string, GroupedTafsirRow[]>();
const inflight = new Map<string, Promise<GroupedTafsirRow[]>>();

function loadSurah(ident: string, surah: number): Promise<GroupedTafsirRow[]> {
  const key = `${ident}/${surah}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = dataFileUrl(`tafsir/${key}.json`)
    .then((url) => fetch(url))
    .then((r) => {
      if (!r.ok) throw new Error(`tafsir/${key}.json: ${r.status}`);
      return r.json() as Promise<GroupedTafsirRow[]>;
    })
    .then((rows) => {
      cache.set(key, rows);
      inflight.delete(key);
      return rows;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });
  inflight.set(key, p);
  return p;
}

export interface GroupedTafsirState {
  /** Surah number -> its passages. Only surahs in `surahIds` are present. */
  data: Map<number, GroupedTafsirRow[]> | null;
  loading: boolean;
  error: string | null;
}

/** Lazily loads a passage-grouped tafsir (`tafsir/<ident>/<surah>.json`) for
 *  just the surahs in view. Pass `ident = null` to load nothing. */
export function useGroupedTafsir(
  ident: string | null,
  surahIds: number[],
): GroupedTafsirState {
  const key = ident ? `${ident}|${surahIds.join(",")}` : "";
  const [state, setState] = useState<GroupedTafsirState>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!ident || surahIds.length === 0) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let alive = true;
    setState({ data: null, loading: true, error: null });
    Promise.all(surahIds.map((s) => loadSurah(ident, s).then((r) => [s, r] as const)))
      .then(
        (entries) =>
          alive && setState({ data: new Map(entries), loading: false, error: null }),
      )
      .catch((e) => alive && setState({ data: null, loading: false, error: String(e) }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
