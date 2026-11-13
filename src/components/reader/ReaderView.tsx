import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowRight, Plus, X } from "lucide-react";
import type { EditionsIndex, Surah, Verse } from "../../types/quran";
import { SCOPE_MAX, surahColorById } from "../charts/common";
import type { ColorMode, ReaderScope, ReaderTarget } from "../charts/common";
import { useTranslation, useTranslations } from "../../data/useTranslation";
import { useTajweed } from "../../data/useTajweed";
import { useWordByWord } from "../../data/useWordByWord";
import { useThemes } from "../../data/useThemes";
import { useAsbab } from "../../data/useAsbab";
import { useSurahInfo, type InfoLang } from "../../data/useSurahInfo";
import { renderInline } from "../../lib/inlineMarkdown";
import {
  asbabByFirstAyah,
  tafsirGroupAt,
  tafsirGroupLookup,
  themeHeadingAt,
  themeIndexById,
} from "../../data/sections";
import { useGroupedTafsir } from "../../data/useGroupedTafsir";
import { usePersistentState } from "../../lib/usePersistentState";
import { useElementWidth } from "../../lib/useElementWidth";
import { TAJWEED_LEGEND, type TajweedSegment } from "../../data/tajweed";
import {
  editionByIdentifier,
  isRtl,
  TAFSIR_EDITIONS,
  tafsirById,
  TRANSLITERATION_EDITION,
} from "../../data/editions";
import type { GlossLang } from "../../data/useWordByWord";
import { surahMapOf } from "../../data/selectors";
import { normalizeArabic } from "../../data/arabic";
import type { Palette } from "../../theme/palettes";
import { cx, SegmentedControl, Select, Sheet, Slider, Toggle } from "../ui";
import { EditionSelect } from "../panels/EditionSelect";
import { BookmarkList } from "../panels/BookmarkList";
import { setBookmarkNote, toggleBookmark, type Bookmark } from "../../lib/bookmarks";
import { useI18n } from "../../i18n/I18nContext";
import {
  RECITERS,
  estimateAudioBytes,
  formatBytes,
  type LoopRange,
  type ReciterId,
} from "../../data/recitation";
import { useReciters, useRecitation } from "../../data/useRecitation";
import {
  cancelDownloads,
  deleteReciterAudio,
  downloadSurahs,
  isNativeApp,
  nativeAudioBase,
  useAudioDownloads,
  type SurahJob,
} from "../../data/audioStore";
import {
  MiniPlayer,
  RecitationControls,
  type AudioDownloadPrompt,
  type AudioStorage,
} from "./Recitation";
import { QuranStrip } from "../peta/QuranStrip";
import { ReaderToolbar } from "./ReaderToolbar";
import { VerseRow, type RowContext, type RowTranslation } from "./VerseRow";
import { MushafPage } from "./MushafPage";
import { VerseContextPanel, type ExploreTarget } from "./VerseContextPanel";
import { copyToClipboard, groupByPage, scopeField, useReaderPrefs } from "./readerShared";

/** Reader width (CSS px, after zoom) below which the tools go icon-only. */
const NARROW_PX = 560;
/** Reader width from which the context panel docks beside the text. */
const DOCK_PX = 960;

export interface ReaderViewProps {
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
  /** Leave the reader (back to the view it was opened from). */
  onClose: () => void;
  /** Bookmarked ayahs (owned by App, persisted). */
  bookmarks: Bookmark[];
  onBookmarks: (b: Bookmark[]) => void;
  /** Open a root or topic in the dashboard explorers. */
  onExplore?: (t: ExploreTarget) => void;
  /** Phone shell: leave room for the status bar and the bottom tab bar. */
  phone?: boolean;
  /** Night theme (for the canvas-drawn Qur'an strip). */
  dark?: boolean;
}

/**
 * The reader as a page (DESIGN.md "Layout"): the text column, the "Konteks
 * ayat" panel docked beside it on wide layouts (a sheet otherwise), and the
 * mini-player under it. Ayahs are laid out one by one, as mushaf pages, or
 * with several translations side by side.
 */
export function ReaderView({
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
  onExplore,
  phone,
  dark = false,
}: ReaderViewProps) {
  const i18n = useI18n();
  const { t, n } = i18n;
  const p = useReaderPrefs();
  const { mode } = p;
  const rootRef = useRef<HTMLElement>(null);
  const width = useElementWidth(rootRef);
  const narrow = width > 0 && width < NARROW_PX;
  const docked = width >= DOCK_PX;

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [copied, setCopied] = useState<RowContext["copied"]>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  // The ayah at the top of the list: the strip's "you are here" mark.
  const [topId, setTopId] = useState<number | undefined>(undefined);
  const [showInfo, setShowInfo] = useState(false);
  const [openAsbab, setOpenAsbab] = useState<Set<number>>(() => new Set());
  const [contextSheet, setContextSheet] = useState(false);
  const [playerSheet, setPlayerSheet] = useState(false);
  // An edited loop range; null follows the reader's scope.
  const [loopRange, setLoopRange] = useState<LoopRange | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(false);
  const navSettledRef = useRef(false);
  // `${glossLang}:${ayahId}` -> tajweed pieces per word-by-word item (static data).
  const alignCache = useRef(new Map<string, TajweedSegment[][] | null>());

  // Compared translations (compare layout); editions gone after a data
  // rebuild are dropped and the list is never empty.
  const known = useMemo(
    () => new Set(editions.editions.map((e) => e.identifier)),
    [editions],
  );
  const [picked, setPicked] = usePersistentState<string[]>(
    "qv.compare.editions",
    [edition],
    (raw) => {
      if (!Array.isArray(raw)) return undefined;
      const ok = raw.filter((x): x is string => typeof x === "string" && known.has(x));
      return ok.length ? [...new Set(ok)] : undefined;
    },
  );
  const [adding, setAdding] = useState(editions.default);

  const surahMap = useMemo(() => surahMapOf(surahs), [surahs]);
  const scopeVerses = useMemo(
    () => verses.filter((v) => scopeField(v, target.scope) === target.value),
    [verses, target.scope, target.value],
  );
  const anchorId = target.anchor ?? scopeVerses[0]?.id;
  const [selectedId, setSelectedId] = useState<number | undefined>(anchorId);
  useEffect(() => setSelectedId(anchorId), [anchorId]);
  const inScope = (id: number | undefined) =>
    id !== undefined && scopeVerses.some((v) => v.id === id);
  const selected = verses[(inScope(selectedId) ? selectedId! : (anchorId ?? 1)) - 1];

  // ── Data ──
  const tajweedState = useTajweed(p.showTajweed);
  const wordByWordState = useWordByWord(p.showWords && mode !== "mushaf", p.glossLang);
  const themesState = useThemes(p.showThemes && mode !== "mushaf");
  const asbabState = useAsbab(p.showAsbab && mode !== "mushaf");
  const infoState = useSurahInfo(p.infoLang, showInfo && target.scope === "surah");
  const themes = themesState.data;
  const themeIdx = useMemo(
    () => (themes ? themeIndexById(themes, verses.length) : null),
    [themes, verses.length],
  );
  const asbabMap = useMemo(
    () => (asbabState.data ? asbabByFirstAyah(asbabState.data) : null),
    [asbabState.data],
  );
  const translation = useTranslation(mode === "ayah" ? edition : null);
  const compared = useTranslations(mode === "compare" ? picked : []);
  const translit = useTranslation(
    p.showTranslit && mode !== "mushaf" ? TRANSLITERATION_EDITION : null,
  );
  const tafsirEd = tafsirById(p.tafsirEdition);
  const inlineTafsirOn = p.showTafsir && mode !== "mushaf";
  const tafsir = useTranslation(
    inlineTafsirOn && tafsirEd.kind === "ayah" ? tafsirEd.id : null,
  );
  const scopeSurahs = useMemo(
    () => [...new Set(scopeVerses.map((v) => v.s))],
    [scopeVerses],
  );
  const groupedTafsir = useGroupedTafsir(
    inlineTafsirOn && tafsirEd.kind === "grouped" ? tafsirEd.id : null,
    scopeSurahs,
  );
  const tafsirGroups = useMemo(
    () =>
      groupedTafsir.data ? tafsirGroupLookup(scopeVerses, groupedTafsir.data) : null,
    [groupedTafsir.data, scopeVerses],
  );

  // ── Recitation ──
  const scopeRange = useMemo<LoopRange>(
    () =>
      scopeVerses.length
        ? { from: scopeVerses[0].id, to: scopeVerses[scopeVerses.length - 1].id }
        : { from: 1, to: 1 },
    [scopeVerses],
  );
  const range = loopRange ?? scopeRange;
  const needsBasmalah = useCallback(
    (id: number) => {
      const v = verses[id - 1];
      return !!v && v.a === 1 && !!surahMap.get(v.s)?.hasBismillah;
    },
    [verses, surahMap],
  );
  const reciters = useReciters(RECITERS);
  // The stored choice, or the first reciter present locally.
  const reciter = reciters?.find((r) => r.id === p.reciterPref) ?? reciters?.[0] ?? null;
  // ── Android app: recitation lives in device storage, downloaded per surah ──
  const native = isNativeApp();
  const [deviceBase, setDeviceBase] = useState<string | null>(null);
  useEffect(() => {
    if (native) void nativeAudioBase().then(setDeviceBase, () => undefined);
  }, [native]);
  const downloads = useAudioDownloads(RECITERS);
  const reciterId = (reciter?.id ?? p.reciterPref) as ReciterId;
  const onDevice = downloads.downloaded[reciterId];
  const available = useCallback(
    (id: number) => !native || !!onDevice?.[verses[id - 1]?.s ?? 0],
    [native, onDevice, verses],
  );
  const totalWords = useMemo(() => surahs.reduce((n, x) => n + x.wordCount, 0), [surahs]);
  const jobOf = useCallback(
    (n: number): SurahJob | null => {
      const x = surahMap.get(n);
      return x
        ? { surah: n, ayahCount: x.ayahCount, hasBismillah: !!x.hasBismillah }
        : null;
    },
    [surahMap],
  );
  /** "Al-Baqara" for one surah, "3 surahs" for more. */
  const surahsLabel = useCallback(
    (ns: number[]) =>
      ns.length === 1
        ? (surahMap.get(ns[0])?.nameEn ?? String(ns[0]))
        : t.reader.audio.nSurahs(ns.length),
    [surahMap, t],
  );

  const rec = useRecitation({
    reciter: reciterId,
    enabled: p.showAudio,
    verses,
    range,
    options: p.audioOpts,
    needsBasmalah,
    base: native ? deviceBase : undefined,
    available: native ? available : undefined,
  });

  let downloadPrompt: AudioDownloadPrompt | null = null;
  let storage: AudioStorage | null = null;
  if (native && onDevice) {
    // The surah playback stopped at, else the ones this view shows.
    const missingSurah = rec.missing !== null ? verses[rec.missing - 1]?.s : undefined;
    const want = (missingSurah ? [missingSurah] : scopeSurahs).filter(
      (n) => !onDevice[n],
    );
    const words = want.reduce((n, x) => n + (surahMap.get(x)?.wordCount ?? 0), 0);
    const act = downloads.active;
    const jobsFor = (ns: number[]) => ns.flatMap((n) => jobOf(n) ?? []);
    downloadPrompt = {
      needed:
        want.length > 0
          ? {
              what: surahsLabel(want),
              size: formatBytes(estimateAudioBytes(reciterId, words, totalWords)),
            }
          : null,
      active: act
        ? {
            what: surahsLabel([act.surah]),
            done: act.done,
            total: act.total,
            waiting: downloads.queue.length,
          }
        : null,
      error: downloads.error,
      onStart: () => downloadSurahs(reciterId, jobsFor(want)),
      onCancel: cancelDownloads,
    };
    const have = Object.keys(onDevice).map(Number);
    const bytes = Object.values(onDevice).reduce((n, b) => n + b, 0);
    storage = {
      surahs: have.length,
      size: formatBytes(bytes),
      allSize: formatBytes(
        estimateAudioBytes(
          reciterId,
          surahs.filter((x) => !onDevice[x.id]).reduce((n, x) => n + x.wordCount, 0),
          totalWords,
        ),
      ),
      busy: !!act,
      onDownloadAll: () =>
        downloadSurahs(
          reciterId,
          jobsFor(surahs.map((x) => x.id).filter((n) => !onDevice[n])),
        ),
      onDeleteAll: () => {
        if (
          window.confirm(
            t.reader.audio.deleteConfirm(reciter?.name ?? "", formatBytes(bytes)),
          )
        ) {
          rec.stop();
          void deleteReciterAudio(reciterId);
        }
      },
    };
  }
  const audioOn = !!reciter && p.showAudio;
  // A new scope resets an edited range, unless something is playing from it.
  const hasCursor = rec.cursor !== null;
  useEffect(() => {
    if (!hasCursor) setLoopRange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeRange]);
  /** Play from `id`; outside the range, the range becomes id..end of scope. */
  const playFrom = (id: number) => {
    if (id < range.from || id > range.to)
      setLoopRange({ from: id, to: Math.max(id, scopeRange.to) });
    rec.play(id);
  };
  const playingId = rec.cursor?.id;

  // ── Items: ayahs, or mushaf pages ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || mode === "mushaf") return scopeVerses;
    const arQuery = normalizeArabic(query.trim());
    const tr = mode === "compare" ? compared.map.get(picked[0]) : translation.data;
    return scopeVerses.filter((v) => {
      if (`${v.s}:${v.a}` === q || String(v.a) === q) return true;
      const text = tr?.[v.id]?.toLowerCase() ?? "";
      return text.includes(q) || normalizeArabic(v.ar).includes(arQuery);
    });
  }, [scopeVerses, query, mode, translation.data, compared.map, picked]);
  const pages = useMemo(
    () => (mode === "mushaf" ? groupByPage(scopeVerses) : null),
    [mode, scopeVerses],
  );
  const count = pages ? pages.length : filtered.length;
  const indexOfAyah = useCallback(
    (id: number) =>
      pages
        ? pages.findIndex((pg) => pg.some((v) => v.id === id))
        : filtered.findIndex((v) => v.id === id),
    [pages, filtered],
  );

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (pages ? 720 : 170),
    getItemKey: (i) => (pages ? `p${pages[i][0].id}` : filtered[i].id),
    overscan: 4,
    // Breathing room below the final item; scales with the Arabic size.
    paddingEnd: Math.round(24 * arabicScale),
  });

  // Rows are measured as they render and re-measured by a ResizeObserver when
  // they change size. A Qur'an font arriving late reflows rows measured with
  // the fallback font; once the fonts are in, measure every rendered row again
  // from the DOM. (`measure()` alone only empties the size cache: rows already
  // observed would fall back to the estimate and overlap.)
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      const list = scrollRef.current;
      if (!alive || !list) return;
      rowVirtualizer.measure();
      list
        .querySelectorAll<HTMLElement>("[data-index]")
        .forEach((el) => rowVirtualizer.measureElement(el));
    });
    return () => {
      alive = false;
    };
  }, [rowVirtualizer]);

  useEffect(() => {
    if (!anchorId) return;
    // New scope/anchor: scrolling to the anchor, not the bottom, so clear the
    // bottom-pin and suppress re-pinning until the anchor scroll settles.
    atBottomRef.current = false;
    navSettledRef.current = false;
    const idx = indexOfAyah(anchorId);
    if (idx < 0) {
      navSettledRef.current = true;
      return;
    }
    const tm = setTimeout(() => {
      // Instant, not smooth: during a smooth scroll the virtualizer skips
      // measuring rows far from the target and never returns to them, so
      // the rows passed on the way overlapped after a long jump.
      rowVirtualizer.scrollToIndex(idx, { align: pages ? "start" : "center" });
    }, 60);
    const settle = setTimeout(() => {
      navSettledRef.current = true;
    }, 500);
    return () => {
      clearTimeout(tm);
      clearTimeout(settle);
    };
  }, [anchorId, indexOfAyah, rowVirtualizer, pages]);

  // Keep the ayah being recited in view.
  useEffect(() => {
    if (playingId === undefined) return;
    const idx = indexOfAyah(playingId);
    if (idx >= 0) rowVirtualizer.scrollToIndex(idx, { align: "auto" });
  }, [playingId, indexOfAyah, rowVirtualizer]);

  // Rows are measured lazily, so the total height can grow after reaching the
  // bottom (a long final ayah like 2:282). While pinned to the bottom, follow it.
  const itemFirstAyah = useRef<(i: number) => number | undefined>(() => undefined);
  useEffect(() => {
    itemFirstAyah.current = (i) => (pages ? pages[i]?.[0].id : filtered[i]?.id);
  }, [pages, filtered]);
  const onListScroll = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const room = sc.scrollHeight - sc.clientHeight;
    atBottomRef.current = room - sc.scrollTop < 8;
    // Only changes when another row reaches the top, not on every pixel.
    const top = rowVirtualizer.getVirtualItems().find((vi) => vi.end > sc.scrollTop + 8);
    if (top) setTopId(itemFirstAyah.current(top.index));
  }, [rowVirtualizer]);
  const totalSize = rowVirtualizer.getTotalSize();
  useEffect(() => {
    const sc = scrollRef.current;
    if (sc && navSettledRef.current && atBottomRef.current)
      sc.scrollTop = sc.scrollHeight;
  }, [totalSize]);

  // ← / → step through the scope (not while typing).
  const max = SCOPE_MAX[target.scope];
  const go = useCallback(
    (value: number) => {
      if (value >= 1 && value <= max) onNavigate({ scope: target.scope, value });
    },
    [max, onNavigate, target.scope],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "ArrowLeft") go(target.value - 1);
      if (e.key === "ArrowRight") go(target.value + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, target.value]);

  // A row's "more" menu closes on any press outside it.
  useEffect(() => {
    if (menuFor === null) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el?.closest("[data-row-menu], [aria-haspopup]")) setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  const changeScope = (scope: ReaderScope) => {
    if (scope === target.scope) return;
    const at = verses[(selected?.id ?? anchorId ?? 1) - 1] ?? scopeVerses[0];
    if (!at) return;
    onNavigate({ scope, value: scopeField(at, scope), anchor: at.id });
  };

  const openContext = (id: number) => {
    setSelectedId(id);
    if (docked) p.setShowContext(true);
    else setContextSheet(true);
  };

  const verseColor = (v: Verse): string =>
    surahColorById(v.s, colorMode, palette, surahMap, v.p);

  // ── Title ──
  const headerSurah = target.scope === "surah" ? surahMap.get(target.value) : undefined;
  const title = headerSurah ? (
    <span className="flex items-baseline gap-2">
      <span className="truncate">
        {headerSurah.number}. {headerSurah.nameEn}
      </span>
      {!narrow && (
        <span
          lang="ar"
          dir="rtl"
          className="font-arabic text-xl font-normal text-ink-muted"
        >
          {headerSurah.nameAr}
        </span>
      )}
    </span>
  ) : (
    `${t.scope[target.scope]} ${target.value}`
  );
  const subtitle = headerSurah
    ? t.reader.meta(
        i18n.meaning(headerSurah),
        i18n.place(headerSurah.type),
        headerSurah.revelationOrder,
        headerSurah.ayahCount,
        n(headerSurah.wordCount),
      )
    : t.reader.nVerses(scopeVerses.length);

  // ── Copy ──
  const editionName =
    editions.editions.find((e) => e.identifier === edition)?.englishName ?? edition;
  const copy = (v: Verse, text: string, what: "text" | "link") => {
    void copyToClipboard(text).then((ok) => {
      setCopied({ id: v.id, ok, what });
      setTimeout(() => setCopied((c) => (c?.id === v.id ? null : c)), 1500);
    });
  };
  const copyLink = (v: Verse) => copy(v, `https://quran.com/${v.s}/${v.a}`, "link");
  const copyText = (v: Verse) => {
    const tr =
      mode === "compare" ? compared.map.get(picked[0])?.[v.id] : translation.data?.[v.id];
    const trName =
      mode === "compare"
        ? (editionByIdentifier(editions, picked[0])?.englishName ?? picked[0])
        : editionName;
    const name = surahMap.get(v.s)?.nameEn ?? `${t.common.surah} ${v.s}`;
    const text = [v.ar, tr ? `${tr} (${trName})` : null, `— ${name} ${v.s}:${v.a}`]
      .filter(Boolean)
      .join("\n\n");
    copy(v, text, "text");
  };

  const bookmarked = useMemo(() => new Map(bookmarks.map((b) => [b.id, b])), [bookmarks]);

  const column = (id: string, data: (string | null)[] | null, loading: boolean) => {
    const e = editionByIdentifier(editions, id);
    return {
      id,
      name: e?.englishName ?? id,
      lang: e?.language ?? "en",
      rtl: e ? isRtl(e.language) : false,
      data,
      loading,
    } satisfies RowTranslation;
  };
  const translations: RowTranslation[] =
    mode === "compare"
      ? picked.map((id) => column(id, compared.map.get(id) ?? null, compared.loading))
      : [column(edition, translation.data, translation.loading)];

  const rowCtx: RowContext = {
    mode,
    surahMap,
    verses,
    multiSurah: target.scope !== "surah",
    showTranslit: p.showTranslit,
    showWords: p.showWords,
    showTajweed: p.showTajweed,
    translationScale: p.translationScale,
    translations,
    translit: translit.data,
    tajweed: tajweedState.data,
    wordByWord: wordByWordState.data,
    alignCache: alignCache.current,
    glossLang: p.glossLang,
    inlineTafsir: inlineTafsirOn
      ? {
          kind: tafsirEd.kind,
          lang: tafsirEd.lang,
          source: tafsirEd.source,
          loading: tafsirEd.kind === "ayah" ? tafsir.loading : groupedTafsir.loading,
          ayah: tafsir.data,
          groupAt: (id, prevId) =>
            tafsirGroups ? tafsirGroupAt(tafsirGroups, id, prevId) : null,
        }
      : null,
    inlineAsbab:
      p.showAsbab && asbabMap
        ? {
            byFirst: asbabMap,
            source: asbabState.data?.source ?? "",
            open: openAsbab,
            toggle: (id) =>
              setOpenAsbab((cur) => {
                const next = new Set(cur);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              }),
          }
        : null,
    themeAt: (id, prevId) =>
      p.showThemes && themes && themeIdx
        ? themeHeadingAt(themes, themeIdx, id, prevId)
        : null,
    verseColor,
    audioOn,
    playingId,
    inEditedRange: (id) => !!loopRange && id >= range.from && id <= range.to,
    playFrom,
    bookmarked,
    toggleBookmark: (id) => onBookmarks(toggleBookmark(bookmarks, id)),
    editingNote,
    setEditingNote,
    saveNote: (id, note) => onBookmarks(setBookmarkNote(bookmarks, id, note)),
    copied,
    copyText,
    copyLink,
    selectedId: selected?.id,
    openContext,
    menuFor,
    setMenuFor,
  };

  // End-of-scope "continue" targets.
  const nextTarget: ReaderTarget | null =
    target.value < max ? { scope: target.scope, value: target.value + 1 } : null;
  const nextRevealed = headerSurah
    ? surahs.find((x) => x.revelationOrder === headerSurah.revelationOrder + 1)
    : undefined;

  const loadError =
    tajweedState.error ||
    wordByWordState.error ||
    themesState.error ||
    asbabState.error ||
    tafsir.error ||
    groupedTafsir.error;

  const settings = (
    <div className="flex flex-col gap-3">
      <EditionSelect
        index={editions}
        value={edition}
        onChange={onEditionChange}
        label={t.reader.translation}
      />
      <p className="mt-1 text-sm font-semibold text-ink">{t.reader.display}</p>
      <Toggle
        checked={p.showTranslit}
        onChange={p.setShowTranslit}
        label={t.reader.transliteration}
      />
      <Toggle checked={p.showTafsir} onChange={p.setShowTafsir} label={t.reader.tafsir} />
      {p.showTafsir && (
        <Select
          value={p.tafsirEdition}
          onChange={(e) => p.setTafsirEdition(e.target.value)}
          label={t.reader.tafsirSource}
        >
          {TAFSIR_EDITIONS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </Select>
      )}
      <Toggle
        checked={p.showTajweed}
        onChange={p.setShowTajweed}
        label={t.reader.tajweed}
      />
      {p.showTajweed && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-surface-sunken p-2 dark:bg-paper">
          {TAJWEED_LEGEND.map((r) => (
            <span
              key={r.code}
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: dark ? r.dark : r.color }}
              />
              {t.tajweed[r.code] ?? r.name}
            </span>
          ))}
        </div>
      )}
      <Toggle checked={p.showWords} onChange={p.setShowWords} label={t.reader.wbw} />
      {p.showWords && (
        <Select
          value={p.glossLang}
          onChange={(e) => p.setGlossLang(e.target.value as GlossLang)}
          label={t.reader.glossLang}
        >
          <option value="en">{t.reader.glossEn}</option>
          <option value="id">{t.reader.glossId}</option>
        </Select>
      )}
      <Toggle checked={p.showThemes} onChange={p.setShowThemes} label={t.reader.themes} />
      <Toggle checked={p.showAsbab} onChange={p.setShowAsbab} label={t.reader.asbab} />
      {reciter && (
        <Toggle
          checked={p.showAudio}
          onChange={p.setShowAudio}
          label={t.reader.recitationPlayer}
        />
      )}
      <hr className="border-line" />
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
        value={Math.round(p.translationScale * 100)}
        onChange={(e) => p.setTranslationScale(Number(e.target.value) / 100)}
      />
      {loadError && (
        <p className="text-sm text-rubric" role="alert">
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
  );

  const contextPanel = () =>
    selected && (
      <VerseContextPanel
        verse={selected}
        verses={verses}
        surahMap={surahMap}
        tab={p.contextTab}
        onTab={p.setContextTab}
        tafsirEdition={p.tafsirEdition}
        onTafsirEdition={p.setTafsirEdition}
        glossLang={p.glossLang}
        onGlossLang={p.setGlossLang}
        verseColor={verseColor}
        onRead={(tg) => {
          setContextSheet(false);
          onNavigate(tg);
        }}
        onExplore={(x) => {
          setContextSheet(false);
          onExplore?.(x);
        }}
      />
    );

  return (
    <section
      ref={rootRef}
      aria-label={t.reader.aria}
      className={cx(
        "flex h-[calc(100*var(--zvh))] min-w-0 flex-col bg-paper",
        phone &&
          "pb-[calc(3.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]",
      )}
    >
      <ReaderToolbar
        title={title}
        subtitle={subtitle}
        onBack={onClose}
        scope={target.scope}
        value={target.value}
        max={max}
        onScope={changeScope}
        onGo={go}
        mode={mode}
        onMode={p.setMode}
        narrow={narrow}
        searchOpen={searchOpen || !!query}
        onSearchOpen={setSearchOpen}
        query={query}
        onQuery={setQuery}
        infoAvailable={target.scope === "surah"}
        showInfo={showInfo}
        onInfo={() => setShowInfo((x) => !x)}
        contextToggle={
          docked
            ? { on: p.showContext, toggle: () => p.setShowContext(!p.showContext) }
            : null
        }
        bookmarksOpen={bookmarksOpen}
        onBookmarksOpen={setBookmarksOpen}
        bookmarks={
          <>
            <p className="mb-1 text-sm font-semibold text-ink">{t.reader.bookmarks}</p>
            <BookmarkList
              bookmarks={bookmarks}
              verses={verses}
              surahMap={surahMap}
              onOpen={(tg) => {
                setBookmarksOpen(false);
                onNavigate(tg);
              }}
              onRemove={(id) => onBookmarks(toggleBookmark(bookmarks, id))}
            />
          </>
        }
        settingsOpen={settingsOpen}
        onSettingsOpen={setSettingsOpen}
        settings={settings}
      />

      {/* Where this scope sits in the whole Qur'an, and where you are in it. */}
      <QuranStrip
        verses={verses}
        surahMap={surahMap}
        dark={dark}
        from={scopeRange.from}
        to={scopeRange.to}
        at={inScope(topId) ? topId : selected?.id}
        label={t.reader.stripLabel}
        onPick={(id) => {
          const v = verses[id - 1];
          if (v)
            onNavigate({
              scope: target.scope,
              value: scopeField(v, target.scope),
              anchor: id,
            });
        }}
      />

      {showInfo && target.scope === "surah" && (
        <div className="max-h-[35%] shrink-0 overflow-y-auto border-b border-line bg-surface px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">{t.reader.about}</p>
            <SegmentedControl<InfoLang>
              value={p.infoLang}
              onChange={p.setInfoLang}
              ariaLabel={t.reader.infoLang}
              options={[
                { value: "en", label: "English" },
                { value: "id", label: "Indonesia" },
              ]}
            />
          </div>
          <div
            lang={p.infoLang}
            className="max-w-[68ch] whitespace-pre-line font-reading leading-relaxed text-ink"
          >
            {infoState.loading
              ? t.common.loading
              : infoState.error
                ? t.common.failedToLoad(infoState.error)
                : infoState.data?.[target.value]
                  ? renderInline(infoState.data[target.value]!)
                  : t.reader.noInfo}
          </div>
          <p className="mt-2 text-xs text-ink-subtle">
            {t.reader.infoSource(p.infoLang === "en")}
          </p>
        </div>
      )}

      {mode === "compare" && (
        <div className="flex shrink-0 flex-wrap items-end gap-2 border-b border-line px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span className="sr-only">{t.reader.compareEditions}</span>
            {picked.map((id) => {
              const e = editionByIdentifier(editions, id);
              const name = e?.englishName ?? id;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-surface py-0.5 pl-2 pr-0.5 text-sm text-ink"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() =>
                      setPicked((cur) =>
                        cur.length > 1 ? cur.filter((x) => x !== id) : cur,
                      )
                    }
                    disabled={picked.length <= 1}
                    aria-label={t.reader.removeEdition(name)}
                    className="rounded p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                  >
                    <X size={13} />
                  </button>
                </span>
              );
            })}
          </div>
          <div className="flex items-end gap-1.5">
            <EditionSelect
              index={editions}
              value={adding}
              onChange={setAdding}
              label={t.compare.addTranslation}
            />
            <button
              type="button"
              onClick={() => !picked.includes(adding) && setPicked([...picked, adding])}
              className="inline-flex h-[2.125rem] touch:min-h-11 items-center gap-1 rounded-lg bg-illumination px-3 text-sm font-medium text-white dark:text-paper"
            >
              <Plus size={15} aria-hidden /> {t.compare.add}
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onListScroll}
          className="min-w-0 flex-1 overflow-y-auto px-3 pb-4 pt-1"
        >
          <div className="mx-auto max-w-4xl">
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {count === 0 && (
                <p className="py-8 text-center text-sm text-ink-subtle">
                  {t.reader.noMatch}
                </p>
              )}
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const page = pages?.[vi.index];
                const v = page ? page[0] : filtered[vi.index];
                return (
                  <div
                    key={vi.key}
                    data-ayah={page ? undefined : v.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={vi.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vi.start}px)`,
                      zIndex: !page && menuFor === v.id ? 10 : undefined,
                    }}
                  >
                    {page ? (
                      <MushafPage
                        verses={page}
                        surahMap={surahMap}
                        tajweed={p.showTajweed ? tajweedState.data : null}
                        selectedId={selected?.id}
                        playingId={audioOn ? playingId : undefined}
                        onSelect={openContext}
                      />
                    ) : (
                      <VerseRow
                        v={v}
                        prev={vi.index > 0 ? filtered[vi.index - 1] : null}
                        ctx={rowCtx}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {!query.trim() && count > 0 && (nextTarget || nextRevealed) && (
              <div className="flex flex-wrap items-center justify-center gap-2 pb-2 pt-4">
                {nextTarget && (
                  <button
                    type="button"
                    onClick={() => onNavigate(nextTarget)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-illumination px-4 py-2.5 text-sm font-semibold text-white touch:min-h-11 dark:text-paper"
                  >
                    {t.reader.continueTo(t.scope[target.scope], nextTarget.value)}
                    {target.scope === "surah" && surahMap.get(nextTarget.value)
                      ? ` · ${surahMap.get(nextTarget.value)!.nameEn}`
                      : ""}
                    <ArrowRight size={15} aria-hidden />
                  </button>
                )}
                {nextRevealed && (
                  <button
                    type="button"
                    onClick={() => onNavigate({ scope: "surah", value: nextRevealed.id })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm text-ink-muted touch:min-h-11 hover:bg-surface-sunken"
                  >
                    {t.reader.nextRevealed(nextRevealed.id, nextRevealed.nameEn)}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {docked && p.showContext && (
          <aside
            aria-label={t.reader.contextPanel}
            className="w-[24rem] shrink-0 overflow-y-auto border-l border-line bg-surface"
          >
            {contextPanel()}
          </aside>
        )}
      </div>

      {audioOn && (
        <MiniPlayer
          rec={rec}
          verses={verses}
          reciterName={reciter?.name ?? ""}
          options={p.audioOpts}
          onOpenOptions={() => setPlayerSheet(true)}
          download={downloadPrompt}
        />
      )}

      <Sheet
        open={!docked && contextSheet && !!selected}
        onClose={() => setContextSheet(false)}
        title={
          selected ? t.reader.contextFor(`${selected.s}:${selected.a}`) : t.reader.context
        }
        side={phone ? "bottom" : "right"}
        closeLabel={t.reader.closeContext}
      >
        {contextPanel()}
      </Sheet>

      <Sheet
        open={audioOn && playerSheet}
        onClose={() => setPlayerSheet(false)}
        title={t.reader.audio.options}
        side={phone ? "bottom" : "right"}
        closeLabel={t.common.close}
      >
        <RecitationControls
          rec={rec}
          reciters={reciters ?? []}
          reciter={reciter?.id ?? p.reciterPref}
          onReciter={p.setReciter}
          verses={verses}
          surahs={surahs}
          range={range}
          isDefaultRange={!loopRange}
          onRange={setLoopRange}
          onResetRange={() => setLoopRange(null)}
          options={p.audioOpts}
          onOptions={p.setAudioOpts}
          storage={storage}
        />
      </Sheet>
    </section>
  );
}
