import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowRight,
  Bookmark as BookmarkIcon,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  Info,
  Link2,
  Search,
  Settings,
  StickyNote,
  X,
} from "lucide-react";
import type { EditionsIndex, Surah, Verse } from "../../types/quran";
import { READER_SCOPES, SCOPE_MAX, surahColorById } from "../charts/common";
import type { ColorMode, ReaderScope, ReaderTarget } from "../charts/common";
import { useTranslation } from "../../data/useTranslation";
import { useTajweed } from "../../data/useTajweed";
import { useWordByWord, type GlossLang } from "../../data/useWordByWord";
import { useThemes } from "../../data/useThemes";
import { useAsbab } from "../../data/useAsbab";
import { useSurahInfo, type InfoLang } from "../../data/useSurahInfo";
import {
  asbabByFirstAyah,
  tafsirGroupAt,
  tafsirGroupLookup,
  themeHeadingAt,
  themeIndexById,
} from "../../data/sections";
import { useGroupedTafsir } from "../../data/useGroupedTafsir";
import { persisted, usePersistentState } from "../../lib/usePersistentState";
import {
  parseTajweed,
  RULE_COLORS,
  alignTajweedToWords,
  TAJWEED_LEGEND,
} from "../../data/tajweed";
import type { TajweedSegment } from "../../data/tajweed";
import {
  TAFSIR_EDITIONS,
  tafsirById,
  TRANSLITERATION_EDITION,
} from "../../data/editions";
import { surahMapOf } from "../../data/selectors";
import { normalizeArabic } from "../../data/arabic";
import type { Palette } from "../../theme/palettes";
import { Badge, cx, Modal, SegmentedControl, Select, Slider, Toggle } from "../ui";
import { EditionSelect } from "./EditionSelect";
import { BookmarkList } from "./BookmarkList";
import { setBookmarkNote, toggleBookmark, type Bookmark } from "../../lib/bookmarks";
import { useI18n } from "../../i18n/I18nContext";

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

function scopeField(v: Verse, scope: ReaderScope): number {
  return v[SCOPE_FIELD[scope]] as number;
}

/** Clipboard fallback for contexts where the async API is missing or denied
 *  (embedded webviews, plain-HTTP hosts). Returns whether it worked. */
function legacyCopy(text: string): boolean {
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

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

// Persisted reader preferences (localStorage keys + validators).
const K = "qv.reader.";
const LANGS = ["en", "id"] as const;
const tafsirIds = TAFSIR_EDITIONS.map((t) => t.id);
const SCALE = persisted.number(0.5, 2);
const WIDTH = (raw: unknown) => (raw === null ? null : persisted.number(0.2, 1)(raw));

export function ReaderModal({
  target,
  surahs,
  verses,
  editions,
  edition,
  onEditionChange,
  colorMode,
  palette,
  arabicScale,
  onArabicScale,
  onNavigate,
  onClose,
  bookmarks,
  onBookmarks,
}: {
  target: ReaderTarget;
  surahs: Surah[];
  verses: Verse[];
  editions: EditionsIndex;
  edition: string;
  onEditionChange: (id: string) => void;
  colorMode: ColorMode;
  palette: Palette;
  /** Global Arabic text scale (theme setting, persisted there). */
  arabicScale: number;
  onArabicScale: (s: number) => void;
  onNavigate: (t: ReaderTarget) => void;
  onClose: () => void;
  /** Bookmarked ayahs (owned by App, persisted). */
  bookmarks: Bookmark[];
  onBookmarks: (b: Bookmark[]) => void;
}) {
  const i18n = useI18n();
  const { t, n } = i18n;
  const SCOPE_LABEL = t.scope;
  const SCOPE_OPTIONS = READER_SCOPES.map((s) => ({ value: s, label: t.scope[s] }));
  const [showTranslit, setShowTranslit] = usePersistentState(
    K + "translit",
    false,
    persisted.bool,
  );
  const [showTafsir, setShowTafsir] = usePersistentState(
    K + "tafsir",
    false,
    persisted.bool,
  );
  const [showTajweed, setShowTajweed] = usePersistentState(
    K + "tajweed",
    false,
    persisted.bool,
  );
  const [showWords, setShowWords] = usePersistentState(
    K + "words",
    false,
    persisted.bool,
  );
  const [glossLang, setGlossLang] = usePersistentState<GlossLang>(
    K + "glossLang",
    "en",
    persisted.oneOf(LANGS),
  );
  const [showThemes, setShowThemes] = usePersistentState(
    K + "themes",
    false,
    persisted.bool,
  );
  const [showAsbab, setShowAsbab] = usePersistentState(
    K + "asbab",
    false,
    persisted.bool,
  );
  // Ayah ids whose asbab narrations are expanded.
  const [openAsbab, setOpenAsbab] = useState<Set<number>>(() => new Set());
  const [showInfo, setShowInfo] = useState(false);
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
  const [width, setWidth] = usePersistentState<number | null>(K + "width", null, WIDTH);
  const [query, setQuery] = useState("");
  // Last copy action, for the inline "Copied" / "Copy failed" note.
  const [copied, setCopied] = useState<{
    id: number;
    ok: boolean;
    what: "text" | "link";
  } | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const [translationScale, setTranslationScale] = usePersistentState(
    K + "translationScale",
    1,
    SCALE,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(false);
  const navSettledRef = useRef(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  // `${glossLang}:${ayahId}` -> tajweed pieces per word-by-word item (static data).
  const alignCache = useRef(new Map<string, TajweedSegment[][] | null>());
  const tajweedState = useTajweed(showTajweed);
  const wordByWordState = useWordByWord(showWords, glossLang);
  const themesState = useThemes(showThemes);
  const asbabState = useAsbab(showAsbab);
  const infoState = useSurahInfo(infoLang, showInfo && target.scope === "surah");
  const tajweed = tajweedState.data;
  const wordByWord = wordByWordState.data;

  const surahMap = useMemo(() => surahMapOf(surahs), [surahs]);
  const themes = themesState.data;
  const themeIdx = useMemo(
    () => (themes ? themeIndexById(themes, verses.length) : null),
    [themes, verses.length],
  );
  const asbab = useMemo(
    () => (asbabState.data ? asbabByFirstAyah(asbabState.data) : null),
    [asbabState.data],
  );
  const toggleAsbab = (id: number) =>
    setOpenAsbab((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const scopeVerses = useMemo(
    () => verses.filter((v) => scopeField(v, target.scope) === target.value),
    [verses, target.scope, target.value],
  );

  const changeScope = (scope: ReaderScope) => {
    if (scope === target.scope) return;
    const at =
      verses.find((v) => v.id === (target.anchor ?? scopeVerses[0]?.id)) ??
      scopeVerses[0];
    if (!at) return;
    onNavigate({ scope, value: scopeField(at, scope), anchor: at.id });
  };

  const verseColor = (v: Verse): string =>
    surahColorById(v.s, colorMode, palette, surahMap, v.p);

  const boundaryLabels = (prev: Verse | null, v: Verse): string[] => {
    const out: string[] = [];
    if (!prev || prev.manzil !== v.manzil) out.push(`${t.scope.manzil} ${v.manzil}`);
    if (!prev || prev.juz !== v.juz) out.push(`${t.scope.juz} ${v.juz}`);
    if (!prev || prev.hizb !== v.hizb) out.push(`${t.scope.hizb} ${v.hizb}`);
    if (!prev || prev.rub !== v.rub) out.push(`${t.scope.rub} ${v.rub}`);
    if (!prev || prev.ruku !== v.ruku) out.push(`${t.scope.ruku} ${v.ruku}`);
    if (!prev || prev.page !== v.page) out.push(`${t.scope.page} ${v.page}`);
    return out;
  };

  const translation = useTranslation(edition);
  const translit = useTranslation(showTranslit ? TRANSLITERATION_EDITION : null);
  const tafsirEd = tafsirById(tafsirEdition);
  const tafsir = useTranslation(
    showTafsir && tafsirEd.kind === "ayah" ? tafsirEd.id : null,
  );
  const scopeSurahs = useMemo(
    () => [...new Set(scopeVerses.map((v) => v.s))],
    [scopeVerses],
  );
  const groupedTafsir = useGroupedTafsir(
    showTafsir && tafsirEd.kind === "grouped" ? tafsirEd.id : null,
    scopeSurahs,
  );
  const tafsirGroups = useMemo(
    () =>
      groupedTafsir.data ? tafsirGroupLookup(scopeVerses, groupedTafsir.data) : null,
    [groupedTafsir.data, scopeVerses],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scopeVerses;
    const arQuery = normalizeArabic(query.trim());
    return scopeVerses.filter((v) => {
      if (`${v.s}:${v.a}` === q || String(v.a) === q) return true;
      const t = translation.data?.[v.id]?.toLowerCase() ?? "";
      return t.includes(q) || normalizeArabic(v.ar).includes(arQuery);
    });
  }, [scopeVerses, query, translation.data]);

  const anchorId = target.anchor ?? scopeVerses[0]?.id;

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 140,
    overscan: 4,
    // A little breathing room below the final verse so it isn't flush against
    // the edge; scales with Arabic font size.
    paddingEnd: Math.round(24 * arabicScale),
  });

  useEffect(() => {
    if (!anchorId) return;
    // New scope/anchor: we're scrolling to the top/anchor, not the bottom, so
    // clear the bottom-pin (it persists across Prev/Next while mounted) and
    // suppress re-pinning until the anchor scroll has settled — otherwise the
    // browser clamping the old (taller) scroll position into a shorter new
    // scope would briefly re-arm the pin and flick to the bottom.
    atBottomRef.current = false;
    navSettledRef.current = false;
    const idx = filtered.findIndex((v) => v.id === anchorId);
    if (idx < 0) {
      navSettledRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      rowVirtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
    }, 60);
    const settle = setTimeout(() => {
      navSettledRef.current = true;
    }, 500);
    return () => {
      clearTimeout(t);
      clearTimeout(settle);
    };
  }, [anchorId, filtered, rowVirtualizer]);

  // Verse rows are measured lazily, so the total height can grow *after* you've
  // already scrolled to the bottom (e.g. jumping straight to a long final verse
  // like 2:282) — leaving the last verse partly unreachable. Track whether the
  // viewport is pinned to the bottom, and when the measured size then grows,
  // re-pin to the true bottom so the final verse stays fully reachable.
  const onListScroll = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const room = sc.scrollHeight - sc.clientHeight;
    atBottomRef.current = room - sc.scrollTop < 8;
    // Whole percent only, so scrolling doesn't re-render on every pixel.
    setProgress(room > 0 ? Math.round((sc.scrollTop / room) * 100) : 100);
  }, []);
  const totalSize = rowVirtualizer.getTotalSize();
  useEffect(() => {
    const sc = scrollRef.current;
    if (sc && navSettledRef.current && atBottomRef.current)
      sc.scrollTop = sc.scrollHeight;
  }, [totalSize]);

  const max = SCOPE_MAX[target.scope];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack arrow keys while typing in an input (jump field, search).
      const el = document.activeElement;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          (el as HTMLElement).isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft" && target.value > 1)
        onNavigate({ scope: target.scope, value: target.value - 1 });
      if (e.key === "ArrowRight" && target.value < max)
        onNavigate({ scope: target.scope, value: target.value + 1 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target.scope, target.value, max, onNavigate]);

  // Keep the jump field showing the current scope value when it isn't being edited.
  useEffect(() => setJumpValue(String(target.value)), [target.value]);

  // Commit a typed jump: clamp into [1, max]; revert non-numeric input.
  const commitJump = () => {
    const n = parseInt(jumpValue, 10);
    if (!Number.isFinite(n)) {
      setJumpValue(String(target.value));
      return;
    }
    const clamped = Math.min(max, Math.max(1, n));
    setJumpValue(String(clamped));
    if (clamped !== target.value) onNavigate({ scope: target.scope, value: clamped });
  };

  // Close settings popover on outside click.
  const closeSettings = useCallback(() => setShowSettings(false), []);
  useEffect(() => {
    if (!showSettings) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        settingsRef.current &&
        !settingsRef.current.contains(target) &&
        gearRef.current &&
        !gearRef.current.contains(target)
      ) {
        closeSettings();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showSettings, closeSettings]);

  // Close settings first on Escape / backdrop click, then the modal.
  const handleClose = useCallback(() => {
    if (showSettings) {
      setShowSettings(false);
      return;
    }
    onClose();
  }, [showSettings, onClose]);

  const headerSurah = target.scope === "surah" ? surahMap.get(target.value) : undefined;
  const title =
    target.scope === "surah" && headerSurah ? (
      <span className="flex items-center gap-2">
        {headerSurah.number}. {headerSurah.nameEn}
        <span className="font-arabic text-xl text-slate-500 dark:text-slate-300">
          {headerSurah.nameAr}
        </span>
      </span>
    ) : (
      `${SCOPE_LABEL[target.scope]} ${target.value}`
    );
  const subtitle =
    target.scope === "surah" && headerSurah
      ? t.reader.meta(
          i18n.meaning(headerSurah),
          i18n.place(headerSurah.type),
          headerSurah.revelationOrder,
          headerSurah.ayahCount,
          n(headerSurah.wordCount),
        )
      : t.reader.nVerses(scopeVerses.length);

  const editionName =
    editions.editions.find((e) => e.identifier === edition)?.englishName ?? edition;
  const bookmarked = useMemo(() => new Map(bookmarks.map((b) => [b.id, b])), [bookmarks]);

  // Report "Copied" only once the clipboard write actually succeeded.
  const copy = (v: Verse, text: string, what: "text" | "link") => {
    const done = (ok: boolean) => {
      setCopied({ id: v.id, ok, what });
      setTimeout(() => setCopied((c) => (c?.id === v.id ? null : c)), 1500);
    };
    const viaAsync = navigator.clipboard?.writeText(text);
    if (viaAsync)
      viaAsync.then(
        () => done(true),
        () => done(legacyCopy(text)),
      );
    else done(legacyCopy(text));
  };
  const copyLink = (v: Verse) => copy(v, `https://quran.com/${v.s}/${v.a}`, "link");
  const copyText = (v: Verse) => {
    const tr = translation.data?.[v.id];
    const name = surahMap.get(v.s)?.nameEn ?? `${t.common.surah} ${v.s}`;
    const text = [v.ar, tr ? `${tr} (${editionName})` : null, `— ${name} ${v.s}:${v.a}`]
      .filter(Boolean)
      .join("\n\n");
    copy(v, text, "text");
  };

  // End-of-scope "continue" targets.
  const nextTarget: ReaderTarget | null =
    target.value < max ? { scope: target.scope, value: target.value + 1 } : null;
  const nextRevealed =
    target.scope === "surah" && headerSurah
      ? surahs.find((x) => x.revelationOrder === headerSurah.revelationOrder + 1)
      : undefined;

  const renderSegs = (segs: TajweedSegment[]) =>
    segs.map((seg, i) =>
      seg.rule ? (
        <span key={i} style={{ color: RULE_COLORS[seg.rule]?.color }}>
          {seg.text}
        </span>
      ) : (
        <Fragment key={i}>{seg.text}</Fragment>
      ),
    );

  const renderArabic = (v: Verse) => {
    const marked = showTajweed ? tajweed?.[v.id] : null;
    if (!marked) return v.ar;
    return renderSegs(parseTajweed(marked));
  };

  const renderWordByWord = (v: Verse) => {
    const ws = wordByWord?.[v.id];
    if (!ws)
      return (
        <p dir="rtl" className="quran-text text-slate-800 dark:text-slate-100">
          {renderArabic(v)}
        </p>
      );
    // Tajweed colours cut to match the word-by-word items. If the texts can't
    // be aligned the items are shown uncoloured — never the whole ayah twice.
    const marked = showTajweed ? tajweed?.[v.id] : null;
    let aligned: TajweedSegment[][] | null = null;
    if (marked) {
      const key = `${glossLang}:${v.id}`;
      const cache = alignCache.current;
      if (!cache.has(key))
        cache.set(
          key,
          alignTajweedToWords(
            marked,
            ws.map(([ar]) => ar),
          ),
        );
      aligned = cache.get(key) ?? null;
    }
    return (
      <>
        <div dir="rtl" className="flex flex-wrap gap-x-5 gap-y-1.5">
          {ws.map(([ar, en], i) => (
            <span key={i} className="flex flex-col items-center">
              <span className="quran-text leading-tight text-slate-800 dark:text-slate-100">
                {aligned ? renderSegs(aligned[i]) : ar}
              </span>
              <span
                dir="ltr"
                className="mt-0.5 max-w-[8rem] text-center text-[11px] leading-tight text-slate-500 dark:text-slate-400"
              >
                {en}
              </span>
            </span>
          ))}
        </div>
      </>
    );
  };

  const rowHeaders = (i: number, v: Verse) => {
    const prev = i > 0 ? filtered[i - 1] : null;
    const showSurahHeader = target.scope !== "surah" && (!prev || prev.s !== v.s);
    const labels = boundaryLabels(prev, v);
    const theme =
      showThemes && themes && themeIdx
        ? themeHeadingAt(themes, themeIdx, v.id, prev?.id ?? null)
        : null;
    return { showSurahHeader, labels, prev, theme };
  };

  return (
    <Modal
      open
      onClose={handleClose}
      fullHeight
      className="max-w-6xl"
      ariaLabel={t.reader.aria}
      width={width}
      onWidthChange={setWidth}
    >
      {/* ── Header ── */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowBookmarks((x) => !x)}
              aria-label={t.reader.bookmarks}
              aria-pressed={showBookmarks}
              title={t.app.bookmarks(bookmarks.length)}
              className={cx(
                "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800",
                showBookmarks &&
                  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              <BookmarkIcon size={18} />
            </button>
            {showBookmarks && (
              <div className="absolute right-0 top-full z-20 mt-1 max-h-[calc(60*var(--zvh))] w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t.reader.bookmarks}
                </p>
                <BookmarkList
                  bookmarks={bookmarks}
                  verses={verses}
                  surahMap={surahMap}
                  onOpen={(t) => {
                    setShowBookmarks(false);
                    onNavigate(t);
                  }}
                  onRemove={(id) => onBookmarks(toggleBookmark(bookmarks, id))}
                />
              </div>
            )}
          </div>
          {target.scope === "surah" && (
            <button
              onClick={() => setShowInfo((v) => !v)}
              aria-label={t.reader.about}
              aria-pressed={showInfo}
              title={t.reader.about}
              className={cx(
                "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800",
                showInfo &&
                  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              <Info size={18} />
            </button>
          )}
          <div className="relative">
            <button
              ref={gearRef}
              onClick={() => setShowSettings((v) => !v)}
              aria-label={t.reader.settings}
              className={cx(
                "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800",
                showSettings &&
                  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              <Settings size={18} />
            </button>
            {showSettings && (
              <div
                ref={settingsRef}
                className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800"
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t.reader.display}
                </p>
                <div className="flex flex-col gap-2.5">
                  <Toggle
                    checked={showTranslit}
                    onChange={setShowTranslit}
                    label={t.reader.transliteration}
                  />
                  <Toggle
                    checked={showTafsir}
                    onChange={setShowTafsir}
                    label={t.reader.tafsir}
                  />
                  {showTafsir && (
                    <Select
                      value={tafsirEdition}
                      onChange={(e) => setTafsirEdition(e.target.value)}
                      label={t.reader.tafsirSource}
                      className="ml-1"
                    >
                      {TAFSIR_EDITIONS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Toggle
                    checked={showTajweed}
                    onChange={setShowTajweed}
                    label={t.reader.tajweed}
                  />
                  {showTajweed && (
                    <div className="ml-1 flex flex-wrap gap-x-2 gap-y-0.5 rounded-lg bg-slate-50 p-2 dark:bg-slate-900/60">
                      {TAJWEED_LEGEND.map((r) => (
                        <span
                          key={r.code}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: r.color }}
                          />
                          {t.tajweed[r.code] ?? r.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <Toggle
                    checked={showWords}
                    onChange={setShowWords}
                    label={t.reader.wbw}
                  />
                  {showWords && (
                    <Select
                      value={glossLang}
                      onChange={(e) => setGlossLang(e.target.value as GlossLang)}
                      label={t.reader.glossLang}
                      className="ml-1"
                    >
                      <option value="en">{t.reader.glossEn}</option>
                      <option value="id">{t.reader.glossId}</option>
                    </Select>
                  )}
                  <Toggle
                    checked={showThemes}
                    onChange={setShowThemes}
                    label={t.reader.themes}
                  />
                  <Toggle
                    checked={showAsbab}
                    onChange={setShowAsbab}
                    label={t.reader.asbab}
                  />

                  <hr className="border-slate-200 dark:border-slate-700" />

                  <Slider
                    label={t.reader.arabicSize}
                    min={50}
                    max={200}
                    step={5}
                    value={Math.round(arabicScale * 100)}
                    onChange={(e) => onArabicScale(Number(e.target.value) / 100)}
                  />
                  <Slider
                    label={t.reader.trSize}
                    min={50}
                    max={200}
                    step={5}
                    value={Math.round(translationScale * 100)}
                    onChange={(e) => setTranslationScale(Number(e.target.value) / 100)}
                  />

                  {(tajweedState.error ||
                    wordByWordState.error ||
                    themesState.error ||
                    asbabState.error ||
                    tafsir.error ||
                    groupedTafsir.error) && (
                    <p className="text-xs text-rose-500">
                      {t.reader.failed(
                        tajweedState.error
                          ? t.reader.failedWhat.tajweed
                          : wordByWordState.error
                            ? t.reader.failedWhat.wbw
                            : themesState.error
                              ? t.reader.failedWhat.themes
                              : asbabState.error
                                ? t.reader.failedWhat.asbab
                                : t.reader.failedWhat.tafsir,
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            aria-label={t.reader.close}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── Reading progress ── */}
      <div className="h-0.5 shrink-0 bg-slate-100 dark:bg-slate-800" aria-hidden>
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${progress}%`, backgroundColor: palette.primary }}
        />
      </div>

      {/* ── Surah introduction ── */}
      {showInfo && target.scope === "surah" && (
        <div className="max-h-[40%] shrink-0 overflow-y-auto border-b border-slate-200 bg-slate-50/60 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t.reader.about}
            </p>
            <SegmentedControl<InfoLang>
              value={infoLang}
              onChange={setInfoLang}
              ariaLabel={t.reader.infoLang}
              options={[
                { value: "en", label: "English" },
                { value: "id", label: "Indonesia" },
              ]}
            />
          </div>
          <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {infoState.loading
              ? t.common.loading
              : infoState.error
                ? t.common.failedToLoad(infoState.error)
                : (infoState.data?.[target.value] ?? t.reader.noInfo)}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {t.reader.infoSource(infoLang === "en")}
          </p>
        </div>
      )}

      {/* ── Scope selector ── */}
      <div className="flex shrink-0 items-center justify-center border-b border-slate-200 px-5 py-2 dark:border-slate-700">
        <SegmentedControl<ReaderScope>
          value={target.scope}
          onChange={changeScope}
          options={SCOPE_OPTIONS}
        />
      </div>

      {/* ── Prev / Next ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-2 dark:border-slate-700">
        <button
          onClick={() => onNavigate({ scope: target.scope, value: target.value - 1 })}
          disabled={target.value <= 1}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronLeft size={16} /> {t.reader.prev(SCOPE_LABEL[target.scope])}
        </button>
        <span className="flex select-none items-center gap-1 text-xs tabular-nums text-slate-400">
          <input
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commitJump}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitJump();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                setJumpValue(String(target.value));
                (e.target as HTMLInputElement).blur();
              }
            }}
            inputMode="numeric"
            aria-label={t.reader.jump(SCOPE_LABEL[target.scope])}
            className="w-12 rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-xs tabular-nums text-slate-600 outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          / {max}
        </span>
        <button
          onClick={() => onNavigate({ scope: target.scope, value: target.value + 1 })}
          disabled={target.value >= max}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t.reader.next(SCOPE_LABEL[target.scope])} <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Translation edition + search ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-2.5 dark:border-slate-700">
        <div className="min-w-[200px] flex-1">
          <EditionSelect
            index={editions}
            value={edition}
            onChange={onEditionChange}
            label={t.reader.translation}
          />
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.reader.searchPh}
            aria-label={t.reader.searchAria}
            className="rounded-lg border border-slate-300 bg-white py-1.5 pl-7 pr-2 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* ── Verse list (fills remaining height) ── */}
      <div
        ref={scrollRef}
        onScroll={onListScroll}
        className="min-h-[10rem] flex-1 overflow-y-auto px-5 py-4"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">{t.reader.noMatch}</p>
          )}
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const v = filtered[vi.index];
            const { showSurahHeader, labels, theme, prev } = rowHeaders(vi.index, v);
            const verseAsbab = asbab?.get(v.id);
            const s = surahMap.get(v.s);
            return (
              <div
                key={v.id}
                data-ayah={v.id}
                ref={rowVirtualizer.measureElement}
                data-index={vi.index}
                className="pb-3"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                {showSurahHeader && (
                  <div className="mb-2 mt-3 flex items-center gap-2 border-b border-slate-100 pb-1 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {s?.number}. {s?.nameEn}
                    <span className="font-arabic text-slate-400">{s?.nameAr}</span>
                  </div>
                )}
                {labels.length > 0 && (
                  <div className="my-3 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    {labels.join(" · ")}
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  </div>
                )}
                {v.a === 1 && s?.hasBismillah && (
                  <p
                    dir="rtl"
                    className="quran-text mb-2 text-center text-slate-700 dark:text-slate-200"
                  >
                    {BASMALA}
                  </p>
                )}
                {theme && (
                  <p className="mb-1.5 mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {theme}
                  </p>
                )}
                <div
                  className={
                    "rounded-xl border p-3 transition " +
                    (v.id === target.anchor
                      ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/50 dark:bg-amber-500/10"
                      : "border-slate-100 dark:border-slate-700/60")
                  }
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      title={
                        v.p
                          ? t.reader.exceptionTitle(
                              v.p === "Hijra"
                                ? t.reader.exHijra
                                : t.reader.exAyah(i18n.place(v.p)),
                              i18n.place(surahMap.get(v.s)?.type ?? ""),
                            )
                          : undefined
                      }
                    >
                      <Badge color={verseColor(v)}>
                        {v.s}:{v.a}
                        {v.p && <span aria-hidden>{v.p === "Hijra" ? " ⇢" : " •"}</span>}
                      </Badge>
                    </span>
                    {v.sajda === 1 && <Badge color="#f97316">{t.reader.sajda}</Badge>}
                    {verseAsbab && (
                      <button
                        onClick={() => toggleAsbab(v.id)}
                        aria-expanded={openAsbab.has(v.id)}
                        className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-300"
                      >
                        {t.reader.asbab} (
                        {verseAsbab.reduce((n, e) => n + e.texts.length, 0)})
                      </button>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      {copied?.id === v.id && (
                        <span
                          className={cx(
                            "text-xs",
                            copied.ok ? "text-emerald-500" : "text-rose-500",
                          )}
                          role="status"
                        >
                          {copied.ok ? t.reader.copied(copied.what) : t.reader.copyFailed}
                        </span>
                      )}
                      <button
                        onClick={() => onBookmarks(toggleBookmark(bookmarks, v.id))}
                        aria-pressed={bookmarked.has(v.id)}
                        aria-label={
                          bookmarked.has(v.id)
                            ? t.reader.removeBookmark
                            : t.reader.bookmarkVerse
                        }
                        title={
                          bookmarked.has(v.id)
                            ? t.reader.removeBookmark
                            : t.reader.bookmark
                        }
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                        style={
                          bookmarked.has(v.id) ? { color: palette.primary } : undefined
                        }
                      >
                        {bookmarked.has(v.id) ? (
                          <BookmarkCheck size={14} />
                        ) : (
                          <BookmarkIcon size={14} />
                        )}
                      </button>
                      {bookmarked.has(v.id) && (
                        <button
                          onClick={() =>
                            setEditingNote((x) => (x === v.id ? null : v.id))
                          }
                          aria-label={t.reader.editNote}
                          title={t.reader.note}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                        >
                          <StickyNote size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => copyText(v)}
                        aria-label={t.reader.copyText}
                        title={t.reader.copyTextTitle}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <ClipboardCopy size={14} />
                      </button>
                      <button
                        onClick={() => copyLink(v)}
                        aria-label={t.reader.copyLink}
                        title={t.reader.copyLink}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <Link2 size={14} />
                      </button>
                      <a
                        href={`https://quran.com/${v.s}/${v.a}`}
                        target="_blank"
                        rel="noreferrer"
                        title={t.reader.openQc}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </span>
                  </div>
                  {bookmarked.has(v.id) &&
                    (editingNote === v.id ? (
                      <textarea
                        autoFocus
                        defaultValue={bookmarked.get(v.id)!.note}
                        onBlur={(e) => {
                          onBookmarks(
                            setBookmarkNote(bookmarks, v.id, e.target.value.trim()),
                          );
                          setEditingNote(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            (e.target as HTMLTextAreaElement).blur();
                          } else if (e.key === "Escape") setEditingNote(null);
                        }}
                        placeholder={t.reader.notePh}
                        aria-label={t.reader.noteAria}
                        rows={2}
                        className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    ) : (
                      bookmarked.get(v.id)!.note && (
                        <p className="mb-2 text-xs italic text-slate-500 dark:text-slate-400">
                          {t.reader.notePrefix(bookmarked.get(v.id)!.note)}
                        </p>
                      )
                    ))}
                  {showWords ? (
                    renderWordByWord(v)
                  ) : (
                    <p
                      dir="rtl"
                      className="quran-text text-slate-800 dark:text-slate-100"
                    >
                      {renderArabic(v)}
                    </p>
                  )}
                  {showTranslit && translit.data?.[v.id] && (
                    <p className="mt-1 text-sm italic text-slate-500 dark:text-slate-400">
                      {translit.data[v.id]}
                    </p>
                  )}
                  <p
                    className="mt-2 text-slate-700 dark:text-slate-200"
                    style={{ fontSize: `calc(0.875rem * ${translationScale})` }}
                  >
                    {translation.loading ? "…" : (translation.data?.[v.id] ?? "")}
                  </p>
                  {showTafsir && tafsirEd.kind === "ayah" && (
                    <p
                      className="mt-2 rounded-lg bg-slate-50 p-2 text-right font-arabic text-sm leading-loose text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
                      dir="rtl"
                    >
                      {tafsir.loading ? "…" : (tafsir.data?.[v.id] ?? "")}
                    </p>
                  )}
                  {showTafsir &&
                    tafsirEd.kind === "grouped" &&
                    (groupedTafsir.loading ? (
                      <p className="mt-2 text-sm text-slate-400">…</p>
                    ) : (
                      (() => {
                        const g = tafsirGroups
                          ? tafsirGroupAt(tafsirGroups, v.id, prev?.id ?? null)
                          : null;
                        if (!g) return null;
                        return (
                          <div
                            lang={tafsirEd.lang}
                            className="mt-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60"
                          >
                            {g.to !== g.from && (
                              <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {t.reader.versesRange(`${g.s}:${g.from}–${g.to}`)}
                              </p>
                            )}
                            <p
                              className="whitespace-pre-line text-slate-600 dark:text-slate-300"
                              style={{
                                fontSize: `calc(0.8125rem * ${translationScale})`,
                              }}
                            >
                              {g.text}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {tafsirEd.source}.
                            </p>
                          </div>
                        );
                      })()
                    ))}
                  {verseAsbab && openAsbab.has(v.id) && (
                    <div className="mt-2 rounded-lg border border-sky-100 bg-sky-50/60 p-2 dark:border-sky-500/20 dark:bg-sky-500/5">
                      {verseAsbab.map((e) => {
                        const last = verses[e.last - 1];
                        return (
                          <div key={e.last}>
                            {e.last !== e.first && last && (
                              <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                                {t.reader.versesRange(`${v.s}:${v.a}–${last.a}`)}
                              </p>
                            )}
                            {e.texts.map((t, i) => (
                              <p
                                key={i}
                                dir="rtl"
                                className="mb-2 whitespace-pre-line text-right font-arabic text-sm leading-loose text-slate-700 dark:text-slate-200"
                              >
                                {t}
                              </p>
                            ))}
                          </div>
                        );
                      })}
                      <p className="text-[11px] text-slate-400">
                        {t.reader.arabicOnly} {asbabState.data?.source}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!query.trim() && filtered.length > 0 && (nextTarget || nextRevealed) && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pb-2 pt-4 dark:border-slate-700/60">
            {nextTarget && (
              <button
                onClick={() => onNavigate(nextTarget)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: palette.primary }}
              >
                {t.reader.continueTo(SCOPE_LABEL[target.scope], nextTarget.value)}
                {target.scope === "surah" && surahMap.get(nextTarget.value)
                  ? ` · ${surahMap.get(nextTarget.value)!.nameEn}`
                  : ""}
                <ArrowRight size={15} />
              </button>
            )}
            {nextRevealed && (
              <button
                onClick={() => onNavigate({ scope: "surah", value: nextRevealed.id })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t.reader.nextRevealed(nextRevealed.id, nextRevealed.nameEn)}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
