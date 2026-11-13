import type { Verse } from "../../types/quran";
import type { ReaderScope } from "../charts/common";
import { TAFSIR_EDITIONS } from "../../data/editions";
import type { GlossLang } from "../../data/useWordByWord";
import type { InfoLang } from "../../data/useSurahInfo";
import { persisted, usePersistentState } from "../../lib/usePersistentState";
import {
  DEFAULT_RECITATION,
  RECITERS,
  sanitizeRecitationOptions,
} from "../../data/recitation";

/** The Verse field each scope is keyed by. */
const SCOPE_FIELD: Record<ReaderScope, keyof Verse> = {
  surah: "s",
  manzil: "manzil",
  juz: "juz",
  hizb: "hizb",
  rub: "rub",
  ruku: "ruku",
  page: "page",
};

export function scopeField(v: Verse, scope: ReaderScope): number {
  return v[SCOPE_FIELD[scope]] as number;
}

export const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

/** How the reader lays out its ayahs. */
export type ReaderMode = "ayah" | "mushaf" | "compare";
export const READER_MODES: readonly ReaderMode[] = ["ayah", "mushaf", "compare"];

/** Tabs of the "Konteks ayat" panel. */
export type ContextTab = "tafsir" | "words" | "asbab" | "similar" | "roots";
export const CONTEXT_TABS: readonly ContextTab[] = [
  "tafsir",
  "words",
  "asbab",
  "similar",
  "roots",
];

/** Clipboard fallback for contexts where the async API is missing or denied
 *  (embedded webviews, plain-HTTP hosts). Returns whether it worked. */
export function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Write `text` to the clipboard; resolves to whether it worked. */
export function copyToClipboard(text: string): Promise<boolean> {
  const viaAsync = navigator.clipboard?.writeText(text);
  if (!viaAsync) return Promise.resolve(legacyCopy(text));
  return viaAsync.then(
    () => true,
    () => legacyCopy(text),
  );
}

// Persisted reader preferences (localStorage keys + validators).
const K = "qv.reader.";
const LANGS = ["en", "id"] as const;
const tafsirIds = TAFSIR_EDITIONS.map((t) => t.id);
const SCALE = persisted.number(0.5, 2);

/** Every remembered reader preference, in one place. */
export function useReaderPrefs() {
  const useBool = (key: string, init: boolean) =>
    usePersistentState(K + key, init, persisted.bool);
  const [showTranslit, setShowTranslit] = useBool("translit", false);
  const [showTafsir, setShowTafsir] = useBool("tafsir", false);
  const [showTajweed, setShowTajweed] = useBool("tajweed", false);
  const [showWords, setShowWords] = useBool("words", false);
  const [showThemes, setShowThemes] = useBool("themes", false);
  const [showAsbab, setShowAsbab] = useBool("asbab", false);
  const [showAudio, setShowAudio] = useBool("audio", true);
  const [showContext, setShowContext] = useBool("context", true);
  const [glossLang, setGlossLang] = usePersistentState<GlossLang>(
    K + "glossLang",
    "en",
    persisted.oneOf(LANGS),
  );
  const [infoLang, setInfoLang] = usePersistentState<InfoLang>(
    K + "infoLang",
    "en",
    persisted.oneOf(LANGS),
  );
  const [tafsirEdition, setTafsirEdition] = usePersistentState(
    K + "tafsirEdition",
    TAFSIR_EDITIONS[0].id,
    persisted.oneOf(tafsirIds),
  );
  const [translationScale, setTranslationScale] = usePersistentState(
    K + "translationScale",
    1,
    SCALE,
  );
  const [mode, setMode] = usePersistentState<ReaderMode>(
    K + "mode",
    "ayah",
    persisted.oneOf(READER_MODES),
  );
  const [contextTab, setContextTab] = usePersistentState<ContextTab>(
    K + "contextTab",
    "tafsir",
    persisted.oneOf(CONTEXT_TABS),
  );
  const [audioOpts, setAudioOpts] = usePersistentState(
    "qv.audio.options",
    DEFAULT_RECITATION,
    sanitizeRecitationOptions,
  );
  const [reciterPref, setReciter] = usePersistentState<string>(
    "qv.audio.reciter",
    RECITERS[0],
    persisted.oneOf(RECITERS),
  );
  return {
    showTranslit,
    setShowTranslit,
    showTafsir,
    setShowTafsir,
    showTajweed,
    setShowTajweed,
    showWords,
    setShowWords,
    showThemes,
    setShowThemes,
    showAsbab,
    setShowAsbab,
    showAudio,
    setShowAudio,
    showContext,
    setShowContext,
    glossLang,
    setGlossLang,
    infoLang,
    setInfoLang,
    tafsirEdition,
    setTafsirEdition,
    translationScale,
    setTranslationScale,
    mode,
    setMode,
    contextTab,
    setContextTab,
    audioOpts,
    setAudioOpts,
    reciterPref,
    setReciter,
  };
}

export type ReaderPrefs = ReturnType<typeof useReaderPrefs>;

/** Verses grouped into runs of one mushaf page (the scope may cut the first
 *  and last page short). */
export function groupByPage(verses: Verse[]): Verse[][] {
  const out: Verse[][] = [];
  for (const v of verses) {
    const last = out[out.length - 1];
    if (last && last[0].page === v.page) last.push(v);
    else out.push([v]);
  }
  return out;
}

/** Division boundaries crossed between `prev` and `v`, outermost first. */
export function boundaryLabels(
  prev: Verse | null,
  v: Verse,
  label: Record<"manzil" | "juz" | "hizb" | "rub" | "ruku" | "page", string>,
): string[] {
  const out: string[] = [];
  const keys = ["manzil", "juz", "hizb", "rub", "ruku", "page"] as const;
  for (const k of keys) if (!prev || prev[k] !== v[k]) out.push(`${label[k]} ${v[k]}`);
  return out;
}
