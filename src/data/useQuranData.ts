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

/** `verses-cols.json` (scripts/build_data.py `verse_columns`): verses.json
 *  by column, ayah id = index + 1, `p` as {id: place}. */
export type VerseColumns = {
  [K in Exclude<keyof Verse, "id" | "p" | "ar">]: ArrayLike<number>;
} & { ar: string[]; p: Record<string, Verse["p"]> };

/** The verses from their columns: parsing arrays and building the objects
 *  in one loop takes half the time of parsing 6,236 keyed objects. */
export function versesFromColumns(c: VerseColumns): Verse[] {
  const out: Verse[] = new Array(c.s.length);
  for (let i = 0; i < out.length; i++) {
    const v: Verse = {
      id: i + 1,
      s: c.s[i],
      a: c.a[i],
      juz: c.juz[i],
      hizb: c.hizb[i],
      rub: c.rub[i],
      ruku: c.ruku[i],
      manzil: c.manzil[i],
      page: c.page[i],
      sajda: c.sajda[i] as 0 | 1,
      w: c.w[i],
      l: c.l[i],
      ar: c.ar[i],
    };
    const p = c.p[i + 1];
    if (p) v.p = p;
    out[i] = v;
  }
  return out;
}

let core: Promise<QuranData> | null = null;

/** The four core files, fetched once. App starts this as its module loads,
 *  so the download runs beside the first render instead of after it (and
 *  index.html preloads the same URLs while the page parses). */
export function loadQuranData(): Promise<QuranData> {
  core ??= Promise.all([
    getJSON<Surah[]>("surahs.json"),
    getJSON<VerseColumns>("verses-cols.json").then(versesFromColumns),
    getJSON<EditionsIndex>("editions.json"),
    getJSON<Meta>("meta.json"),
  ]).then(
    ([surahs, verses, editions, meta]) => ({
      // `name` is the display name; App re-labels it by UI language.
      surahs: surahs.map((s) => ({ ...s, nameId: s.nameId ?? s.nameEn, name: s.nameEn })),
      verses,
      editions,
      meta,
    }),
    (err: unknown) => {
      core = null; // the next mount tries again
      throw err;
    },
  );
  return core;
}

/** The core data, from `loadQuranData`. */
export function useQuranData(): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    loadQuranData().then(
      (data) => alive && setState({ data, loading: false, error: null }),
      (err: unknown) =>
        alive && setState({ data: null, loading: false, error: String(err) }),
    );
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
