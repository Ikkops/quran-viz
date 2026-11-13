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
import { isLatinQuery } from "../../data/searchEdition";

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
  latinEditionId,
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
  /** Translation a Latin-script query searches (data/searchEdition.ts). */
  latinEditionId?: string;
}) {
  const { t, n, meaning } = useI18n();
  const surahWord = t.common.surah;
  const [query, setQuery] = useState(initialQuery);
  const [withTranslation, setWithTranslation] = usePersistentState(
    "qv.search.translation",
    false,
  );
  const surahMap = useMemo(() => surahMapOf(surahs), [surahs]);
  // A Latin-script query ("sabar", "Musa") can only match a translation, so it
  // always searches one, in the UI language; the toggle adds the translation to
  // Arabic queries.
  const q = query.trim();
  const ref = useMemo(() => parseVerseRef(q, surahMap), [q, surahMap]);
  const latin = isLatinQuery(q) && !ref;
  const trEditionId = latin ? (latinEditionId ?? editionId) : editionId;
  const searchTr = withTranslation || latin;
  const translation = useTranslation(
    open && searchTr && trEditionId ? trEditionId : null,
  );
  // Spelling-tolerant keys, computed once per verse list.
  const keys = useMemo(() => verses.map((v) => arabicKeyWithMap(v.ar).key), [verses]);

  const qKey = searchKeyArabic(q);
  const refVerse = ref ? verses.find((v) => v.s === ref.s && v.a === ref.a) : undefined;

  const results = useMemo(() => {
    if (q.length < 2) return [];
    const tr = searchTr ? translation.data : null;
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
        surahName: s ? `${s.number}. ${s.nameEn} · ${meaning(s)}` : `${surahWord} ${v.s}`,
        translation: inTranslation ? t : undefined,
      });
    }
    return out;
  }, [q, qKey, keys, verses, surahMap, searchTr, translation.data, surahWord, meaning]);

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
      <div className="border-b border-line px-5 py-3">
        <div className="relative">
          <Search
            size={16}
            aria-hidden
            className="absolute left-3 top-3.5 text-ink-subtle"
          />
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
            className="w-full rounded-lg border border-line bg-surface py-2.5 pl-9 pr-10 text-base text-ink"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label={t.search.clear}
              className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-sunken hover:text-ink"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm text-ink-subtle">
            {q.length >= 2
              ? `${t.search.matches(`${n(results.length)}${results.length >= MAX_RESULTS ? "+" : ""}`)}${
                  searchTr && translation.loading ? t.search.loadingTr : ""
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
            className="mb-2 flex w-full items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-left text-sm font-medium text-ink hover:bg-line dark:bg-surface"
          >
            <ArrowRight size={15} aria-hidden />
            {t.search.goTo(
              `${refVerse.s}:${refVerse.a}`,
              surahMap.get(refVerse.s)?.nameEn ?? "",
            )}
            <kbd className="ml-auto font-ui text-xs text-ink-subtle">Enter</kbd>
          </button>
        )}
        {results.map(({ verse, surahName, translation: t }) => {
          const color = surahColorById(verse.s, colorMode, palette, surahMap, verse.p);
          return (
            <button
              key={verse.id}
              onClick={() => openVerse(verse)}
              className="mb-1 flex w-full items-start gap-3 rounded-lg px-2 py-2 text-right hover:bg-surface-sunken dark:hover:bg-surface"
            >
              <Badge color={color}>
                {verse.s}:{verse.a}
              </Badge>
              <div className="min-w-0 flex-1">
                <p dir="rtl" lang="ar" className="quran-text line-clamp-2 text-ink">
                  {highlightArabic(verse.ar, qKey)}
                </p>
                {t && (
                  <p className="mt-0.5 line-clamp-2 text-left text-xs text-ink-muted">
                    {highlightText(t, q)}
                  </p>
                )}
                <p className="mt-0.5 text-left text-xs text-ink-subtle">{surahName}</p>
              </div>
            </button>
          );
        })}
        {q.length >= 2 && results.length === 0 && !refVerse && (
          <p className="py-8 text-center text-sm text-ink-subtle">{t.search.none}</p>
        )}
      </div>
    </Modal>
  );
}
