import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  Search,
  Settings,
  X,
} from "lucide-react";
import type { EditionsIndex, Surah, Verse } from "../../types/quran";
import { READER_SCOPES } from "../charts/common";
import type { ColorMode, ReaderScope, ReaderTarget } from "../charts/common";
import { useTranslation } from "../../data/useTranslation";
import { useTajweed } from "../../data/useTajweed";
import { useWordByWord, type GlossLang } from "../../data/useWordByWord";
import { useThemes } from "../../data/useThemes";
import { useAsbab } from "../../data/useAsbab";
import { useSurahInfo, type InfoLang } from "../../data/useSurahInfo";
import { asbabByFirstAyah, themeHeadingAt, themeIndexById } from "../../data/sections";
import {
  parseTajweed,
  RULE_COLORS,
  splitTajweedWords,
  TAJWEED_LEGEND,
} from "../../data/tajweed";
import type { TajweedSegment } from "../../data/tajweed";
import { TAFSIR_EDITIONS, TRANSLITERATION_EDITION } from "../../data/editions";
import { surahMapOf } from "../../data/selectors";
import { categorizeOpening } from "../../data/fawatih";
import { normalizeArabic } from "../../data/arabic";
import { FAWATIH_COLORS } from "../../theme/palettes";
import type { Palette } from "../../theme/palettes";
import { Badge, cx, Modal, SegmentedControl, Select, Slider, Toggle } from "../ui";
import { EditionSelect } from "./EditionSelect";

const SCOPE_MAX: Record<ReaderScope, number> = {
  surah: 114,
  manzil: 7,
  juz: 30,
  hizb: 60,
  rub: 240,
  ruku: 558,
  page: 604,
};
const SCOPE_LABEL: Record<ReaderScope, string> = {
  surah: "Surah",
  manzil: "Manzil",
  juz: "Juz",
  hizb: "Hizb",
  rub: "Rub'",
  ruku: "Ruku'",
  page: "Page",
};
const SCOPE_OPTIONS: { value: ReaderScope; label: string }[] = READER_SCOPES.map((s) => ({
  value: s,
  label: SCOPE_LABEL[s],
}));

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

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export function ReaderModal({
  target,
  surahs,
  verses,
  editions,
  edition,
  onEditionChange,
  colorMode,
  palette,
  onNavigate,
  onClose,
}: {
  target: ReaderTarget;
  surahs: Surah[];
  verses: Verse[];
  editions: EditionsIndex;
  edition: string;
  onEditionChange: (id: string) => void;
  colorMode: ColorMode;
  palette: Palette;
  onNavigate: (t: ReaderTarget) => void;
  onClose: () => void;
}) {
  const [showTranslit, setShowTranslit] = useState(false);
  const [showTafsir, setShowTafsir] = useState(false);
  const [showTajweed, setShowTajweed] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [glossLang, setGlossLang] = useState<GlossLang>("en");
  const [showThemes, setShowThemes] = useState(false);
  const [showAsbab, setShowAsbab] = useState(false);
  // Ayah ids whose asbab narrations are expanded.
  const [openAsbab, setOpenAsbab] = useState<Set<number>>(() => new Set());
  const [showInfo, setShowInfo] = useState(false);
  const [infoLang, setInfoLang] = useState<InfoLang>("en");
  const [tafsirEdition, setTafsirEdition] = useState(TAFSIR_EDITIONS[0]);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const [arabicScale, setArabicScale] = useState(1);
  const [translationScale, setTranslationScale] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(false);
  const navSettledRef = useRef(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
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

  const surahColorFor = (sid: number): string =>
    colorMode === "fawatih"
      ? (FAWATIH_COLORS[categorizeOpening(sid)] ?? FAWATIH_COLORS.Unknown)
      : surahMap.get(sid)?.type === "Meccan"
        ? palette.pie[0]
        : palette.pie[1];

  const boundaryLabels = (prev: Verse | null, v: Verse): string[] => {
    const out: string[] = [];
    if (!prev || prev.manzil !== v.manzil) out.push(`Manzil ${v.manzil}`);
    if (!prev || prev.juz !== v.juz) out.push(`Juz ${v.juz}`);
    if (!prev || prev.hizb !== v.hizb) out.push(`Hizb ${v.hizb}`);
    if (!prev || prev.rub !== v.rub) out.push(`Rub' ${v.rub}`);
    if (!prev || prev.ruku !== v.ruku) out.push(`Ruku' ${v.ruku}`);
    if (!prev || prev.page !== v.page) out.push(`Page ${v.page}`);
    return out;
  };

  const translation = useTranslation(edition);
  const translit = useTranslation(showTranslit ? TRANSLITERATION_EDITION : null);
  const tafsir = useTranslation(showTafsir ? tafsirEdition : null);

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
    if (sc) atBottomRef.current = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 8;
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
      ? `${headerSurah.meaning} · ${headerSurah.type} · ${headerSurah.ayahCount} verses · ${headerSurah.wordCount.toLocaleString()} words`
      : `${scopeVerses.length} verses`;

  const copyLink = (v: Verse) => {
    navigator.clipboard?.writeText(`https://quran.com/${v.s}/${v.a}`);
    setCopied(v.id);
    setTimeout(() => setCopied((c) => (c === v.id ? null : c)), 1200);
  };

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
    const marked = showTajweed ? tajweed?.[v.id] : null;
    const twWords = marked ? splitTajweedWords(marked) : null;
    const aligned = twWords && twWords.length === ws.length ? twWords : null;
    return (
      <>
        {marked && !aligned && (
          <p dir="rtl" className="quran-text mb-1 text-slate-800 dark:text-slate-100">
            {renderArabic(v)}
          </p>
        )}
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
      ariaLabel="Quran reader"
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
          {target.scope === "surah" && (
            <button
              onClick={() => setShowInfo((v) => !v)}
              aria-label="About this surah"
              aria-pressed={showInfo}
              title="About this surah"
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
              aria-label="Reader settings"
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
                  Display options
                </p>
                <div className="flex flex-col gap-2.5">
                  <Toggle
                    checked={showTranslit}
                    onChange={setShowTranslit}
                    label="Transliteration"
                  />
                  <Toggle
                    checked={showTafsir}
                    onChange={setShowTafsir}
                    label="Tafsir context"
                  />
                  {showTafsir && (
                    <Select
                      value={tafsirEdition}
                      onChange={(e) => setTafsirEdition(e.target.value)}
                      label="Tafsir source"
                      className="ml-1"
                    >
                      <option value="ar.muyassar">Al-Muyassar</option>
                      <option value="ar.jalalayn">Al-Jalalayn</option>
                    </Select>
                  )}
                  <Toggle
                    checked={showTajweed}
                    onChange={setShowTajweed}
                    label="Tajweed colours"
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
                          {r.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <Toggle
                    checked={showWords}
                    onChange={setShowWords}
                    label="Word by word"
                  />
                  {showWords && (
                    <Select
                      value={glossLang}
                      onChange={(e) => setGlossLang(e.target.value as GlossLang)}
                      label="Gloss language"
                      className="ml-1"
                    >
                      <option value="en">English</option>
                      <option value="id">Indonesian (QUL)</option>
                    </Select>
                  )}
                  <Toggle
                    checked={showThemes}
                    onChange={setShowThemes}
                    label="Section themes"
                  />
                  <Toggle
                    checked={showAsbab}
                    onChange={setShowAsbab}
                    label="Asbab al-nuzul"
                  />

                  <hr className="border-slate-200 dark:border-slate-700" />

                  <Slider
                    label="Arabic size"
                    min={50}
                    max={200}
                    step={5}
                    value={Math.round(arabicScale * 100)}
                    onChange={(e) => setArabicScale(Number(e.target.value) / 100)}
                  />
                  <Slider
                    label="Translation size"
                    min={50}
                    max={200}
                    step={5}
                    value={Math.round(translationScale * 100)}
                    onChange={(e) => setTranslationScale(Number(e.target.value) / 100)}
                  />

                  {(tajweedState.error ||
                    wordByWordState.error ||
                    themesState.error ||
                    asbabState.error) && (
                    <p className="text-xs text-rose-500">
                      Failed to load{" "}
                      {tajweedState.error
                        ? "tajweed"
                        : wordByWordState.error
                          ? "word-by-word"
                          : themesState.error
                            ? "section theme"
                            : "asbab"}{" "}
                      data.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── Surah introduction ── */}
      {showInfo && target.scope === "surah" && (
        <div className="max-h-[40%] shrink-0 overflow-y-auto border-b border-slate-200 bg-slate-50/60 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              About this surah
            </p>
            <SegmentedControl<InfoLang>
              value={infoLang}
              onChange={setInfoLang}
              ariaLabel="Introduction language"
              options={[
                { value: "en", label: "English" },
                { value: "id", label: "Indonesia" },
              ]}
            />
          </div>
          <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {infoState.loading
              ? "Loading…"
              : infoState.error
                ? `Failed to load: ${infoState.error}`
                : (infoState.data?.[target.value] ?? "No introduction available.")}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Source: Quranic Universal Library (QUL), surah-info resource{" "}
            {infoLang === "en" ? "3 (English)" : "454 (Indonesian)"}.
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
          <ChevronLeft size={16} /> Prev {SCOPE_LABEL[target.scope]}
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
            aria-label={`Jump to ${SCOPE_LABEL[target.scope]}`}
            className="w-12 rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-xs tabular-nums text-slate-600 outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          / {max}
        </span>
        <button
          onClick={() => onNavigate({ scope: target.scope, value: target.value + 1 })}
          disabled={target.value >= max}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Next {SCOPE_LABEL[target.scope]} <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Translation edition + search ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-2.5 dark:border-slate-700">
        <div className="min-w-[200px] flex-1">
          <EditionSelect
            index={editions}
            value={edition}
            onChange={onEditionChange}
            label="Translation"
          />
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search verse / number"
            className="rounded-lg border border-slate-300 bg-white py-1.5 pl-7 pr-2 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* ── Verse list (fills remaining height) ── */}
      <div
        ref={scrollRef}
        onScroll={onListScroll}
        className="min-h-[10rem] flex-1 overflow-y-auto px-5 py-4"
        style={
          {
            "--arabic-scale": String(arabicScale),
            "--translation-scale": String(translationScale),
          } as React.CSSProperties
        }
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              No verses match your search.
            </p>
          )}
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const v = filtered[vi.index];
            const { showSurahHeader, labels, theme } = rowHeaders(vi.index, v);
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
                    <Badge color={surahColorFor(v.s)}>
                      {v.s}:{v.a}
                    </Badge>
                    {v.sajda === 1 && <Badge color="#f97316">Sajda</Badge>}
                    {verseAsbab && (
                      <button
                        onClick={() => toggleAsbab(v.id)}
                        aria-expanded={openAsbab.has(v.id)}
                        className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-300"
                      >
                        Asbab al-nuzul (
                        {verseAsbab.reduce((n, e) => n + e.texts.length, 0)})
                      </button>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => copyLink(v)}
                        title="Copy quran.com link"
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <Copy size={14} />
                      </button>
                      <a
                        href={`https://quran.com/${v.s}/${v.a}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open on quran.com"
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <ExternalLink size={14} />
                      </a>
                      {copied === v.id && (
                        <span className="text-xs text-emerald-500">copied</span>
                      )}
                    </span>
                  </div>
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
                  {showTafsir && (
                    <p
                      className="mt-2 rounded-lg bg-slate-50 p-2 text-right font-arabic text-sm leading-loose text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
                      dir="rtl"
                    >
                      {tafsir.loading ? "…" : (tafsir.data?.[v.id] ?? "")}
                    </p>
                  )}
                  {verseAsbab && openAsbab.has(v.id) && (
                    <div className="mt-2 rounded-lg border border-sky-100 bg-sky-50/60 p-2 dark:border-sky-500/20 dark:bg-sky-500/5">
                      {verseAsbab.map((e) => {
                        const last = verses[e.last - 1];
                        return (
                          <div key={e.last}>
                            {e.last !== e.first && last && (
                              <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                                Verses {v.s}:{v.a}–{last.a}
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
                        Arabic only. {asbabState.data?.source}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
