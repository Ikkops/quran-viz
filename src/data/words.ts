// Per-word data (`words/<surah>.json`, `lexicon.json`, `lexicon-occ.json`,
// from the ETL): transliteration, English and Indonesian meanings, and the
// Quranic Arabic Corpus grammar of each word, in the app's own words
// (`splitWords`). Used for word meanings in the mushaf and the word details.

import { useEffect, useState } from "react";
import { dataUrl } from "./base";
import { useLazyJson } from "./useLazyJson";

/** [transliteration, English, Indonesian, tags, lemma, root]: tags are the
 *  corpus part of speech and features ("N|M|GEN"); lemma and root are
 *  1-based into the lexicon, 0 when the word has none. */
export type WordInfo = [string, string, string, string, number, number];
/** One surah: per ayah (index = ayah number − 1), per word. */
export type SurahWords = WordInfo[][];

export interface Lexicon {
  /** [Arabic letters, Buckwalter, occurrences] */
  roots: [string, string, number][];
  /** [vowelled Arabic, root (1-based, 0 = none), occurrences, English, Indonesian] */
  lemmas: [string, number, number, string, string][];
}
/** Per lemma (index 0 unused): flat [ayah id, word (0-based), …]. */
export type LexiconOcc = number[][];

const cache = new Map<number, SurahWords>();
const inflight = new Map<number, Promise<SurahWords>>();

export function loadSurahWords(surah: number): Promise<SurahWords> {
  const hit = cache.get(surah);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(surah);
  if (!p) {
    p = fetch(dataUrl(`words/${surah}.json`))
      .then((r) => {
        if (!r.ok) throw new Error(`words/${surah}.json: ${r.status}`);
        return r.json() as Promise<SurahWords>;
      })
      .then((d) => {
        cache.set(surah, d);
        return d;
      })
      .finally(() => inflight.delete(surah));
    inflight.set(surah, p);
  }
  return p;
}

/** The word data of the given surahs (each once loaded); `null` surahs list
 *  loads nothing. Returns a lookup by ayah (surah, ayah number). */
export function useSurahWords(
  surahs: number[] | null,
): (surah: number, ayah: number) => WordInfo[] | undefined {
  const key = surahs ? surahs.join(",") : "";
  const [, bump] = useState(0);
  useEffect(() => {
    if (!surahs) return;
    let alive = true;
    for (const s of surahs)
      if (!cache.has(s))
        loadSurahWords(s).then(
          () => alive && bump((n) => n + 1),
          () => undefined,
        );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (s, a) => cache.get(s)?.[a - 1];
}

export const useLexicon = (enabled: boolean) =>
  useLazyJson<Lexicon>("lexicon.json", enabled);
export const useLexiconOcc = (enabled: boolean) =>
  useLazyJson<LexiconOcc>("lexicon-occ.json", enabled);

/** The gloss of a word in the reader's gloss language. */
export const glossOf = (w: WordInfo, lang: "en" | "id") => (lang === "id" ? w[2] : w[1]);

// ── Grammar in words ──

export interface MorphWords {
  pos: Record<string, string>;
  feat: Record<string, string>;
  person: (n: number) => string;
}

/** A word's corpus tags as a part of speech and plain features, worded by
 *  the UI dictionary (`t.word`). Unknown tags are left out. */
export function describeTags(
  tags: string,
  w: MorphWords,
): { pos: string | null; features: string[] } {
  const parts = tags.split("|").filter(Boolean);
  if (!parts.length) return { pos: null, features: [] };
  const [head, ...rest] = parts;
  const features: string[] = [];
  const add = (k: string) => {
    const x = w.feat[k];
    if (x && !features.includes(x)) features.push(x);
  };
  for (let i = 0; i < rest.length; i++) {
    const x = rest[i];
    if ((x === "ACT" || x === "PASS") && rest[i + 1] === "PCPL") {
      add(x === "ACT" ? "ACT_PCPL" : "PASS_PCPL");
      i++;
      continue;
    }
    const form = /^\(([IVX]+)\)$/.exec(x);
    if (form) {
      features.push(w.feat.form.replace("{n}", form[1]));
      continue;
    }
    if (x.startsWith("MOOD:")) {
      add(`MOOD_${x.slice(5)}`);
      continue;
    }
    if (x.startsWith("SP:")) {
      add(`SP_${x.slice(3)}`);
      continue;
    }
    // Person, gender and number: "3MS", "MP", "2D", "FS", "M".
    const png = /^([123])?([MF])?([SDP])?$/.exec(x);
    if (png && (png[1] || png[2] || png[3])) {
      if (png[1]) features.push(w.person(Number(png[1])));
      if (png[2]) add(png[2]);
      if (png[3]) add(`num_${png[3]}`);
      continue;
    }
    add(x);
  }
  return { pos: w.pos[head] ?? null, features };
}

/** Every [ayah id, word] where a lemma occurs. */
export function occurrencesOf(occ: LexiconOcc, lemma: number): [number, number][] {
  const flat = occ[lemma] ?? [];
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
}

/** The lemmas derived from a root, most frequent first. */
export function lemmasOfRoot(lex: Lexicon, root: number): number[] {
  const out: number[] = [];
  lex.lemmas.forEach((l, i) => {
    if (l[1] === root) out.push(i + 1);
  });
  return out.sort((a, b) => lex.lemmas[b - 1][2] - lex.lemmas[a - 1][2]);
}
