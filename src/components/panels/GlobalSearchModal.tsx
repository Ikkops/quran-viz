import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import type { Surah, Verse } from "../../types/quran";
import { surahMapOf } from "../../data/selectors";
import { arabicKeyWithMap, findArabicMatch, searchKeyArabic } from "../../data/arabic";
import { parseVerseRef } from "../../data/refs";
import { useTranslation } from "../../data/useTranslation";
import { usePersistentState } from "../../lib/usePersistentState";
import type { Palette } from "../../theme/palettes";
import { surahColorById, type ColorMode, type ReaderTarget } from "../charts/common";
import { Badge, Modal, ModalHeader, Toggle } from "../ui";
import { useI18n } from "../../i18n/I18nContext";

const MAX_RESULTS = 200;
const MARK = "rounded bg-amber-200/70 px-0.5 dark:bg-amber-500/30";

/** Highlight the first spelling-tolerant match of `qKey` within Uthmani `text`. */
function highlightArabic(text: string, qKey: string): ReactNode {
  const m = findArabicMatch(text, qKey);
  if (!m) return text;
  return (
    <>
      {text.slice(0, m[0])}
      <mark className={MARK}>{text.slice(m[0], m[1])}</mark>
      {text.slice(m[1])}
    </>
  );
}

/** Highlight the first case-insensitive match of `q` in a translation. */
function highlightText(text: string, q: string): ReactNode {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className={MARK}>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

interface Result {
  verse: Verse;
  surahName: string;
  /** Translation text when the match is (also) in the translation. */
  translation?: string;
}

export function GlobalSearchModal({
  open,
  onClose,
  verses,
  surahs,
  colorMode,
  palette,
  onOpenReader,
  initialQuery = "",
  editionId,
}: {
  open: boolean;
  onClose: () => void;
  verses: Verse[];
  surahs: Surah[];
  colorMode: ColorMode;
  palette: Palette;
  onOpenReader: (t: ReaderTarget) => void;
  /** Pre-filled query (e.g. a word clicked in the word cloud). */
  initialQuery?: string;
  /** Translation searched when "Also search translation" is on. */
  editionId?: string;
}) {
  const { t, n } = useI18n();
  const surahWord = t.common.surah;
  const [query, setQuery] = useState(initialQuery);
  const [withTranslation, setWithTranslation] = usePersistentState(
    "qv.search.translation",
    false,
  );
  const surahMap = useMemo(() => surahMapOf(surahs), [surahs]);
  const translation = useTranslation(
    open && withTranslation && editionId ? editionId : null,
  );
  // Spelling-tolerant keys, computed once per verse list.
  const keys = useMemo(() => verses.map((v) => arabicKeyWithMap(v.ar).key), [verses]);

  const q = query.trim();
  const qKey = searchKeyArabic(q);
  const ref = useMemo(() => parseVerseRef(q, surahMap), [q, surahMap]);
  const refVerse = ref ? verses.find((v) => v.s === ref.s && v.a === ref.a) : undefined;

  const results = useMemo(() => {
    if (q.length < 2) return [];
    const tr = withTranslation ? translation.data : null;
    const lower = q.toLowerCase();
    const out: Result[] = [];
    for (let i = 0; i < verses.length && out.length < MAX_RESULTS; i++) {
      const v = verses[i];
      const inArabic = qKey.length >= 2 && keys[i].includes(qKey);
      const t = tr?.[v.id] ?? undefined;
      const inTranslation = !!t && t.toLowerCase().includes(lower);
      if (!inArabic && !inTranslation) continue;
      const s = surahMap.get(v.s);
      out.push({
        verse: v,
        surahName: s ? `${s.number}. ${s.nameEn}` : `${surahWord} ${v.s}`,
        translation: inTranslation ? t : undefined,
      });
    }
    return out;
  }, [q, qKey, keys, verses, surahMap, withTranslation, translation.data, surahWord]);

  const openVerse = (v: Verse) => {
    onOpenReader({ scope: "surah", value: v.s, anchor: v.id });
    onClose();
  };
  const onEnter = () => {
    if (refVerse) openVerse(refVerse);
    else if (results[0]) openVerse(results[0].verse);
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl" ariaLabel={t.search.title}>
      <ModalHeader title={t.search.title} onClose={onClose} />
      <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              }
            }}
            placeholder={t.search.placeholder}
            aria-label={t.search.queryAria}
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label={t.search.clear}
              className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            {q.length >= 2
              ? `${t.search.matches(`${n(results.length)}${results.length >= MAX_RESULTS ? "+" : ""}`)}${
                  withTranslation && translation.loading ? t.search.loadingTr : ""
                }`
              : t.search.hint}
          </p>
          {editionId && (
            <Toggle
              checked={withTranslation}
              onChange={setWithTranslation}
              label={t.search.alsoTr}
            />
          )}
        </div>
      </div>
      <div className="max-h-[calc(55*var(--zvh))] overflow-y-auto px-3 py-2">
        {refVerse && (
          <button
            onClick={() => openVerse(refVerse)}
            className="mb-2 flex w-full items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowRight size={15} />
            {t.search.goTo(
              `${refVerse.s}:${refVerse.a}`,
              surahMap.get(refVerse.s)?.nameEn ?? "",
            )}
            <span className="ml-auto text-xs text-slate-400">Enter</span>
          </button>
        )}
        {results.map(({ verse, surahName, translation: t }) => {
          const color = surahColorById(verse.s, colorMode, palette, surahMap, verse.p);
          return (
            <button
              key={verse.id}
              onClick={() => openVerse(verse)}
              className="mb-1 flex w-full items-start gap-3 rounded-lg px-2 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Badge color={color}>
                {verse.s}:{verse.a}
              </Badge>
              <div className="min-w-0 flex-1">
                <p
                  dir="rtl"
                  className="quran-text truncate text-slate-800 dark:text-slate-100"
                >
                  {highlightArabic(verse.ar, qKey)}
                </p>
                {t && (
                  <p className="mt-0.5 line-clamp-2 text-left text-xs text-slate-600 dark:text-slate-300">
                    {highlightText(t, q)}
                  </p>
                )}
                <p className="mt-0.5 text-left text-[11px] text-slate-400">{surahName}</p>
              </div>
            </button>
          );
        })}
        {q.length >= 2 && results.length === 0 && !refVerse && (
          <p className="py-8 text-center text-sm text-slate-400">{t.search.none}</p>
        )}
      </div>
    </Modal>
  );
}
