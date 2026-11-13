export type RevelationType = "Meccan" | "Medinan";

export interface Surah {
  id: number;
  number: number;
  nameAr: string;
  nameEn: string;
  meaning: string;
  type: RevelationType;
  ayahCount: number;
  wordCount: number;
  letterCount: number;
  sajdaCount: number;
  firstPage: number;
  lastPage: number;
  firstJuz: number;
  lastJuz: number;
  /** True when ayah 1 carried a basmala we stripped (render it above verse 1).
   *  False for Al-Fatiha (basmala is verse 1) and At-Tawbah (none). */
  hasBismillah: boolean;
  /** Rank in the standard (Egyptian) revelation order, 1 = Al-'Alaq. */
  revelationOrder: number;
  /** Ayahs whose traditional place differs from the surah's (see Verse.p). */
  exceptions: number;
}

/** Where an ayah was revealed. "Hijra" = en route during the migration. */
export type AyahPlace = RevelationType | "Hijra";

/** Core verse record. Short keys mirror verses.json to keep the file small. */
export interface Verse {
  id: number; // global ayah id 1..6236
  s: number; // surah id
  a: number; // ayah number within surah
  juz: number;
  hizb: number; // 1–60
  rub: number; // rub' al-hizb quarter index, 1–240
  ruku: number; // ruku' (thematic section), global 1–558 (from QUL)
  manzil: number; // manzil (seven-day recitation division), 1–7 (from QUL)
  page: number;
  sajda: 0 | 1;
  w: number; // word count
  l: number; // letter count
  ar: string; // Uthmani Arabic text
  /** Set only when the ayah's traditional place differs from its surah's
   *  classification (mushaf-header exceptions; scholars differ). */
  p?: AyahPlace;
}

/** Verse augmented with cumulative running totals (global + per-juz). */
export interface EnrichedVerse extends Verse {
  cumulGlobalW: number;
  cumulGlobalV: number;
  cumulGlobalL: number;
  cumulJuzW: number;
  cumulJuzV: number;
  cumulJuzL: number;
}

export type EditionType = "translation" | "transliteration" | "tafsir";

export interface Edition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  type: EditionType;
  count: number;
}

export interface EditionsIndex {
  default: string;
  editions: Edition[];
}

export interface JuzRange {
  n: number;
  nameAr: string;
  start: number;
  end: number;
}

export interface HizbRange {
  n: number;
  juz: number;
  nameAr: string;
  start: number;
  end: number;
}

export interface Meta {
  generatedAt: string;
  source: string;
  totals: {
    surahs: number;
    ayahs: number;
    pages: number;
    juzs: number;
    hizbs: number;
    rukus: number;
    manzils: number;
    sajdas: number;
    words: number;
    letters: number;
  };
  classification: Record<string, number>;
  /** Ayah-level split (Meccan / Medinan / Hijra) using the per-ayah places. */
  classificationByAyah: Record<string, number>;
  juzs: JuzRange[];
  hizbs: HizbRange[];
  countMethod: string;
}

/** Translation file: array indexed by ayah id (position 0 unused). */
export type TranslationData = (string | null)[];

/** tajweed.json: ayah-id-indexed array of inline-rule-markup strings
 *  (e.g. `بِسْمِ [h:1[ٱ]للَّهِ`). Position 0 unused. */
export type TajweedData = (string | null)[];

/** wordbyword.json: per ayah, an array of [arabic, english gloss] word pairs.
 *  Indexed by ayah id (position 0 unused). */
export type WordByWordData = ([string, string][] | null)[];

export interface RootDatum {
  ar: string; // root letters in Arabic (e.g. "كتب")
  bw: string; // Buckwalter form (e.g. "ktb")
  gloss: string; // a representative English gloss
  count: number;
}

export interface PosDatum {
  tag: string; // corpus POS tag (e.g. "N")
  label: string; // readable label (e.g. "Noun")
  count: number;
}

/** morphology.json: global aggregates from the Quranic Arabic Corpus edition. */
export interface Morphology {
  totalSegments: number;
  distinctRoots: number;
  roots: RootDatum[]; // top roots, descending
  pos: PosDatum[]; // all POS tags, descending
}

/** roots.json: every corpus root with the ayah id of each occurrence (an ayah
 *  repeats when the root occurs in it more than once). Sorted by frequency. */
export interface RootEntry {
  ar: string;
  bw: string;
  gloss: string;
  v: number[];
}

/** similar.json: undirected similar-ayah pairs from QUL, as
 *  [ayahIdA, ayahIdB, score 0–100, matched word count], with A < B. */
export interface SimilarData {
  source: string;
  pairs: [number, number, number, number][];
}

/** themes.json: QUL section themes (English) as [first ayah id, last ayah id,
 *  theme], in mushaf order. */
export type ThemesData = [number, number, string][];

/** topics.json: the curated topic tree as a flat list, parents before
 *  children. Category nodes have keys like "sejarah.nabi"; topic nodes are
 *  "t<QUL id>" (QUL duplicates merged). Built by scripts/topics.py. */
export interface TopicNode {
  k: string;
  en: string; // English name
  id: string; // Indonesian name
  p: number; // parent index, -1 for a top category
  ar?: string; // Arabic name
  desc?: string; // short English description
  v?: number[]; // ayah ids the node tags itself (descendants not included)
}

/** surah-info-<lang>.json: plain-text introduction per surah (index = surah
 *  number, position 0 unused); paragraphs are separated by blank lines. */
export type SurahInfoData = (string | null)[];

/** asbab.json: verified asbab al-nuzul (Arabic), as [first ayah id, last ayah
 *  id, narrations]. */
/** A label in both UI languages (dataset content picked by `lang`). */
export interface Bilingual {
  en: string;
  id: string;
}

export interface ChronoEvent {
  label: Bilingual;
  when: Bilingual;
}

/** A period of the revelation timeline (scripts/data/surah_chronology.json). */
export interface ChronoPeriod {
  id: string;
  phase: RevelationType;
  label: Bilingual;
  when: Bilingual;
  /** Approximate Common Era years, e.g. "623–624". */
  ce: string;
  events: ChronoEvent[];
}

/** How a surah's period was dated: a verified asbab narration, the sirah
 *  tradition, or only its band in the Egyptian revelation order. */
export type ChronoBasis = "asbab" | "sirah" | "urutan";

export interface ChronoEntry {
  period: string;
  /** Index into the period's events. */
  event?: number;
  basis: ChronoBasis;
  /** Hijri years over which a long surah was revealed. */
  span?: [number, number];
  refs?: string[];
  typeNote?: string;
}

export interface ChronologyData {
  periods: ChronoPeriod[];
  /** Keyed by surah id. */
  surahs: Record<string, ChronoEntry>;
}

export interface AsbabData {
  source: string;
  items: [number, number, string[]][];
}

export interface QuranData {
  surahs: Surah[];
  verses: Verse[];
  editions: EditionsIndex;
  meta: Meta;
}
