import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowLeft, ArrowRight, Plus, X } from "lucide-react";
import type { EditionsIndex, Surah, Verse } from "../../types/quran";
import { SCOPE_MAX, surahColorById, type ReaderScope } from "../charts/common";
import type { ColorMode, ReaderTarget } from "../charts/common";
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
import { useGroupedTafsirs } from "../../data/useGroupedTafsir";
import { useFootnotes } from "../../data/footnotes";
import {
  findAllArabic,
  findAllLatin,
  isAyahRef,
  type TextMatch,
} from "../../data/textSearch";
import type { Hits } from "./MarkedText";
import {
  pageOf,
  pagesFor,
  useMushafLayout,
  wordCounter,
  type LayoutLine,
} from "../../data/mushafLayout";
import { TIMED_RECITERS, useWordTimings } from "../../data/wordTimings";
import { MushafLinesPage } from "./MushafLinesPage";
import { needsDownload, useTafsirDownloads } from "../../data/tafsirStore";
import { TafsirDownloadOffer } from "./TafsirDownload";
import { useElementWidth } from "../../lib/useElementWidth";
import type { TajweedSegment } from "../../data/tajweed";
import {
  editionByIdentifier,
  isRtl,
  tafsirById,
  transliterationFor,
  type TafsirEdition,
} from "../../data/editions";
import type { GlossLang } from "../../data/useWordByWord";
import { surahMapOf } from "../../data/selectors";
import type { Palette } from "../../theme/palettes";
import {
  cx,
  QuietIconButton,
  SegmentedControl,
  Select,
  Sheet,
  Slider,
  Toggle,
} from "../ui";
import { EditionSelect } from "../panels/EditionSelect";
import { marksByAyah, type Marks } from "../../lib/marks";
import { MarkSheet } from "../marks/MarkSheet";
import { GoToSheet } from "./GoToSheet";
import { useI18n } from "../../i18n/I18nContext";
import {
  LOCAL_RECITERS,
  RECITERS,
  estimateAudioBytes,
  estimateAyahSeconds,
  formatBytes,
  outsideRange,
  type LoopRange,
  type RecitationOptions,
  type ReciterId,
} from "../../data/recitation";
import { useReciters, useRecitation } from "../../data/useRecitation";
import {
  cancelDownloads,
  deleteReciterAudio,
  deviceTimingsUrl,
  downloadSurahs,
  isNativeApp,
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
import { TajweedRules } from "./TajweedRules";
import { nextHeadHidden } from "../../lib/hideOnScroll";
import { ReaderToolbar } from "./ReaderToolbar";
import {
  VerseRow,
  type RowContext,
  type RowTafsir,
  type RowTranslation,
} from "./VerseRow";
import { MushafPage } from "./MushafPage";
import { VerseContextPanel, type ExploreTarget } from "./VerseContextPanel";
import {
  copyToClipboard,
  DIVISIONS,
  groupByPage,
  MAX_EXTRA,
  MUSHAF_LAYOUTS,
  scopeField,
  tafsirOptions,
  useReaderPrefs,
} from "./readerShared";

/** Reader width (CSS px, after zoom) below which the tools go icon-only. */
const NARROW_PX = 560;
/** Reader width from which the player keeps the range ends beside its seek bar. */
const PLAYER_ROOMY_PX = 560;
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
  /** Pins and collections (owned by App, persisted). */
  marks: Marks;
  onMarks: (m: Marks) => void;
  /** The ayah being read (it stayed on screen, or is being recited). */
  onRead?: (id: number) => void;
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
 * mini-player under it. Ayahs are laid out one by one or as mushaf pages.
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
  marks,
  onMarks,
  onRead,
  onExplore,
  phone,
  dark = false,
}: ReaderViewProps) {
  const i18n = useI18n();
  const { t, n, lang } = i18n;
  const p = useReaderPrefs();
  const { mode } = p;
  const rootRef = useRef<HTMLElement>(null);
  const width = useElementWidth(rootRef);
  const narrow = width > 0 && width < NARROW_PX;
  const docked = width >= DOCK_PX;

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [copied, setCopied] = useState<RowContext["copied"]>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goToOpen, setGoToOpen] = useState(false);
  // The ayah being pinned or added to a collection.
  const [markFor, setMarkFor] = useState<{
    id: number;
    kind: "pin" | "collection";
  } | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  // The ayah at the top of the list: the strip's "you are here" mark.
  const [topId, setTopId] = useState<number | undefined>(undefined);
  const [showInfo, setShowInfo] = useState(false);
  const [tajweedRules, setTajweedRules] = useState(false);
  // The head (toolbar + strip) floats over the list and slides away while
  // reading down; it comes back on a scroll up.
  const headRef = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(0);
  const [headHidden, setHeadHidden] = useState(false);
  const headHiddenRef = useRef(false);
  const headHRef = useRef(0);
  const lastScrollY = useRef(0);
  // Scrolls the reader makes itself (anchor jumps, following the recitation)
  // must not hide the head.
  const quietScrollUntil = useRef(0);
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

  const surahMap = useMemo(() => surahMapOf(surahs), [surahs]);
  const scopeVerses = useMemo(
    () => verses.filter((v) => scopeField(v, target.scope) === target.value),
    [verses, target.scope, target.value],
  );
  const anchorId = target.anchor ?? scopeVerses[0]?.id;
  // Only an ayah someone chose is selected: the one a link or a jump named, or
  // one tapped for its context. Opening a surah selects nothing.
  const [selectedId, setSelectedId] = useState<number | undefined>(target.anchor);
  useEffect(
    () => setSelectedId(target.anchor),
    [target.anchor, target.scope, target.value],
  );
  const inScope = (id: number | undefined) =>
    id !== undefined && scopeVerses.some((v) => v.id === id);
  const highlightId = inScope(selectedId) ? selectedId : undefined;
  // The context panel always has an ayah to show: the chosen one, else the first.
  const selected = verses[(highlightId ?? anchorId ?? 1) - 1];

  // ── Data ──
  const tajweedState = useTajweed(p.showTajweed);
  const wordByWordState = useWordByWord(p.showWords && mode !== "mushaf", p.glossLang);
  const themesState = useThemes(p.showThemes && mode !== "mushaf", i18n.lang);
  const asbabState = useAsbab(p.showAsbab && mode !== "mushaf");
  const infoState = useSurahInfo(p.infoLang, showInfo);
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
  // Further translations under the main one.
  const extraIds = useMemo(
    () =>
      mode === "ayah"
        ? p.extraEditions.filter(
            (id) => id !== edition && !!editionByIdentifier(editions, id),
          )
        : [],
    [mode, p.extraEditions, edition, editions],
  );
  const extraTr = useTranslations(extraIds);
  const footnotes = useFootnotes(mode === "ayah" ? [edition, ...extraIds] : []);
  // Indonesian spelling when the app is in Indonesian.
  const translit = useTranslation(
    p.showTranslit && mode !== "mushaf" ? transliterationFor(lang) : null,
  );
  const tafsirEd = tafsirById(p.tafsirEdition);
  const tafsirDl = useTafsirDownloads();
  // The tafsirs shown under the ayahs: the main one (also the context
  // panel's), then the extra ones.
  const tafsirEds = useMemo<TafsirEdition[]>(
    () => [
      tafsirEd,
      ...p.extraTafsirs.filter((id) => id !== tafsirEd.id).map((id) => tafsirById(id)),
    ],
    [tafsirEd, p.extraTafsirs],
  );
  // In the app, editions not downloaded yet show the offer in settings.
  const pendingTafsirs = tafsirEds.filter((ed) => needsDownload(ed, tafsirDl));
  const shownTafsirs =
    p.showTafsir && mode !== "mushaf"
      ? tafsirEds.filter((ed) => !needsDownload(ed, tafsirDl))
      : [];
  const ayahTafsirIds = shownTafsirs.filter((e) => e.kind === "ayah").map((e) => e.id);
  const groupedTafsirIds = shownTafsirs
    .filter((e) => e.kind === "grouped")
    .map((e) => e.id);
  const ayahTafsirs = useTranslations(ayahTafsirIds);
  const scopeSurahs = useMemo(
    () => [...new Set(scopeVerses.map((v) => v.s))],
    [scopeVerses],
  );
  const groupedTafsirs = useGroupedTafsirs(groupedTafsirIds, scopeSurahs);
  const tafsirGroups = useMemo(() => {
    const m = new Map<string, ReturnType<typeof tafsirGroupLookup>>();
    groupedTafsirs.forEach((st, id) => {
      if (st.data) m.set(id, tafsirGroupLookup(scopeVerses, st.data));
    });
    return m;
  }, [groupedTafsirs, scopeVerses]);
  const tafsirError =
    ayahTafsirs.find((x) => x.error)?.error ??
    [...groupedTafsirs.values()].find((x) => x.error)?.error ??
    null;

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
  // ── Android app: recitation lives in device storage, downloaded per surah ──
  const native = isNativeApp();
  // The app offers the whole catalogue; the desktop, the folders under audio/.
  const reciters = useReciters(native ? RECITERS : LOCAL_RECITERS);
  // The stored choice, or the first reciter present locally.
  const reciter = reciters?.find((r) => r.id === p.reciterPref) ?? reciters?.[0] ?? null;
  const downloads = useAudioDownloads(RECITERS);
  const reciterId = (reciter?.id ?? p.reciterPref) as ReciterId;
  const onDevice = downloads.downloaded[reciterId];
  const available = useCallback(
    (id: number) => !native || !!onDevice?.[verses[id - 1]?.s ?? 0],
    [native, onDevice, verses],
  );
  const totalWords = useMemo(() => surahs.reduce((n, x) => n + x.wordCount, 0), [surahs]);
  const totalLetters = useMemo(
    () => surahs.reduce((n, x) => n + x.letterCount, 0),
    [surahs],
  );
  // Ayah lengths for the seek bar, until the real ones are known.
  const estimate = useCallback(
    (id: number) => estimateAyahSeconds(reciterId, verses[id - 1]?.l ?? 0, totalLetters),
    [reciterId, verses, totalLetters],
  );
  const reciterName = reciter?.name ?? "";
  // What the system's media controls show: "Qaf 50:16" by the reciter.
  const describe = useCallback(
    (id: number) => {
      const v = verses[id - 1];
      const name = v ? (surahMap.get(v.s)?.name ?? "") : "";
      return {
        title: v ? `${name} ${v.s}:${v.a}` : "",
        artist: reciterName,
        album: t.app.titleShort,
      };
    },
    [verses, surahMap, reciterName, t],
  );
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
        ? (surahMap.get(ns[0])?.name ?? String(ns[0]))
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
    base: native ? downloads.base : undefined,
    available: native ? available : undefined,
    estimate,
    describe,
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
      busy: !!act || !!downloads.moving,
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
  // The options sheet changes things as you pick them; Cancel puts back what
  // was set when it opened.
  const sheetSnapshot = useRef<{
    loopRange: LoopRange | null;
    options: RecitationOptions;
    reciter: string;
  } | null>(null);
  const openPlayerSheet = () => {
    sheetSnapshot.current = {
      loopRange,
      options: p.audioOpts,
      reciter: p.reciterPref,
    };
    setPlayerSheet(true);
  };
  const reciterNote = (id: string) => {
    const n = Object.keys(downloads.downloaded[id] ?? {}).length;
    return n > 0 ? t.reader.audio.nSurahs(n) : null;
  };
  // A new scope resets an edited range, unless something is playing from it.
  const hasCursor = rec.cursor !== null;
  useEffect(() => {
    if (!hasCursor) setLoopRange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeRange]);
  /** Play from `id`; outside the range, the range becomes id..end of scope.
   *  A hidden player opens. */
  const playFrom = (id: number) => {
    if (!p.showAudio) p.setShowAudio(true);
    if (id < range.from || id > range.to)
      setLoopRange({ from: id, to: Math.max(id, scopeRange.to) });
    rec.play(id);
  };
  const playingId = rec.cursor?.id;
  // Word timings of the surah being recited (some reciters only). In the app
  // they are downloaded with the surah's audio.
  const playingSurah = playingId ? (verses[playingId - 1]?.s ?? null) : null;
  const timingUrl = native ? deviceTimingsUrl : undefined;
  const surahTimings = useWordTimings(
    reciterId,
    audioOn ? playingSurah : null,
    timingUrl,
  );
  const timingOf = useCallback(
    (id: number) => {
      const v = verses[id - 1];
      return v && v.s === playingSurah ? surahTimings?.[v.a - 1] : undefined;
    },
    [verses, playingSurah, surahTimings],
  );
  /** The learner edited the range: if the ayah being recited fell outside it,
   *  go to the new range's start now instead of finishing that ayah first. */
  const editRange = (next: LoopRange | null) => {
    setLoopRange(next);
    const r = next ?? scopeRange;
    if (rec.cursor && outsideRange(rec.cursor.id, r)) rec.moveTo(r.from);
  };

  // ── Items: ayahs, or mushaf pages ──
  const filtered = scopeVerses;
  // A printed layout's pages, once its file is in; flowing pages otherwise.
  const layoutId = mode === "mushaf" && p.mushafLayout !== "flow" ? p.mushafLayout : null;
  const layoutState = useMushafLayout(layoutId);
  const layout = layoutId && layoutState.data?.page ? layoutState.data : null;
  const wordCount = useMemo(() => wordCounter(verses), [verses]);
  const layoutPages = useMemo(
    () => (layout ? pagesFor(layout, scopeRange.from, scopeRange.to) : null),
    [layout, scopeRange],
  );
  const pages = useMemo(
    () => (mode === "mushaf" && !layoutPages ? groupByPage(scopeVerses) : null),
    [mode, scopeVerses, layoutPages],
  );
  const count = layoutPages ? layoutPages.length : pages ? pages.length : filtered.length;
  const indexOfAyah = useCallback(
    (id: number) =>
      layout && layoutPages
        ? layoutPages.indexOf(pageOf(layout, id))
        : pages
          ? pages.findIndex((pg) => pg.some((v) => v.id === id))
          : filtered.findIndex((v) => v.id === id),
    [layout, layoutPages, pages, filtered],
  );

  // ── Search: every hit in the Arabic and the translations shown ──
  const q = mode === "ayah" ? query.trim() : "";
  const shownTranslations = useMemo(
    () => [
      { id: edition, data: translation.data },
      ...extraIds.map((id, i) => ({ id, data: extraTr[i]?.data ?? null })),
    ],
    [edition, translation.data, extraIds, extraTr],
  );
  const matches = useMemo<TextMatch[]>(() => {
    if (!q) return [];
    const out: TextMatch[] = [];
    for (const v of scopeVerses) {
      if (isAyahRef(q, v.s, v.a)) out.push({ id: v.id, field: "ref", range: null });
      for (const r of findAllArabic(v.ar, q))
        out.push({ id: v.id, field: "ar", range: r });
      for (const tr of shownTranslations) {
        const text = tr.data?.[v.id];
        if (text)
          for (const r of findAllLatin(text, q))
            out.push({ id: v.id, field: tr.id, range: r });
      }
    }
    return out;
  }, [q, scopeVerses, shownTranslations]);
  const [matchAt, setMatchAt] = useState(0);
  useEffect(() => setMatchAt(0), [q]);
  const current = matches.length ? matches[Math.min(matchAt, matches.length - 1)] : null;
  const searchHits = useMemo(() => {
    if (!matches.length) return null;
    const by = new Map<number, Map<string, Hits>>();
    for (const m of matches) {
      let fields = by.get(m.id);
      if (!fields) by.set(m.id, (fields = new Map()));
      let h = fields.get(m.field);
      if (!h) fields.set(m.field, (h = { ranges: [], current: -1 }));
      if (m === current) h.current = h.ranges.length;
      if (m.range) h.ranges.push(m.range);
      else if (m === current) h.current = 0;
    }
    return by;
  }, [matches, current]);
  const stepMatch = (d: 1 | -1) =>
    setMatchAt((i) => (matches.length ? (i + d + matches.length) % matches.length : 0));

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (pages || layoutPages ? 720 : 170),
    getItemKey: (i) =>
      layoutPages ? `L${layoutPages[i]}` : pages ? `p${pages[i][0].id}` : filtered[i].id,
    overscan: 4,
    // Room under the floating head, and scrolls to a row stop below it.
    paddingStart: headH,
    scrollPaddingStart: headH,
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
    quietScrollUntil.current = Date.now() + 700;
    const tm = setTimeout(() => {
      // Instant, not smooth: during a smooth scroll the virtualizer skips
      // measuring rows far from the target and never returns to them, so
      // the rows passed on the way overlapped after a long jump.
      rowVirtualizer.scrollToIndex(idx, {
        align: pages || layoutPages ? "start" : "center",
      });
    }, 60);
    const settle = setTimeout(() => {
      navSettledRef.current = true;
    }, 500);
    return () => {
      clearTimeout(tm);
      clearTimeout(settle);
    };
  }, [anchorId, indexOfAyah, rowVirtualizer, pages, layoutPages]);

  // Bring the search hit stepped to into view (the row, then the word). Keyed
  // on the hit itself, so reloaded data never pulls the list back to it.
  const currentKey = current
    ? `${current.id}:${current.field}:${current.range?.[0] ?? ""}`
    : "";
  useEffect(() => {
    if (!current) return;
    const idx = indexOfAyah(current.id);
    if (idx < 0) return;
    quietScrollUntil.current = Date.now() + 600;
    rowVirtualizer.scrollToIndex(idx, { align: "center" });
    const tm = setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>("[data-match-current]");
      el?.scrollIntoView?.({ block: "center" });
    }, 80);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  // Keep the ayah being recited in view: its top (the Arabic), not the end
  // of a long tafsir under it. Only scrolls when that top is off screen.
  useEffect(() => {
    if (playingId === undefined) return;
    const idx = indexOfAyah(playingId);
    if (idx < 0) return;
    const item = rowVirtualizer.getVirtualItems().find((vi) => vi.index === idx);
    const sc = scrollRef.current;
    if (item && sc) {
      const top = item.start - sc.scrollTop;
      if (top >= headHRef.current && top < sc.clientHeight - 120) return;
    }
    quietScrollUntil.current = Date.now() + 400;
    rowVirtualizer.scrollToIndex(idx, { align: pages || layoutPages ? "auto" : "start" });
  }, [playingId, indexOfAyah, rowVirtualizer, pages, layoutPages]);

  // Rows are measured lazily, so the total height can grow after reaching the
  // bottom (a long final ayah like 2:282). While pinned to the bottom, follow it.
  const itemFirstAyah = useRef<(i: number) => number | undefined>(() => undefined);
  useEffect(() => {
    itemFirstAyah.current = (i) => {
      if (layout && layoutPages) {
        const first = layout.page[layoutPages[i] - 1]?.find(
          (l: LayoutLine) => l.length === 2 && typeof l[0] === "number",
        );
        return first ? (first[0] as number) : undefined;
      }
      return pages ? pages[i]?.[0].id : filtered[i]?.id;
    };
  }, [pages, filtered, layout, layoutPages]);
  const onListScroll = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const room = sc.scrollHeight - sc.clientHeight;
    atBottomRef.current = room - sc.scrollTop < 8;
    const y = sc.scrollTop;
    const quiet = Date.now() < quietScrollUntil.current || !navSettledRef.current;
    const hidden = quiet
      ? headHiddenRef.current
      : nextHeadHidden(headHiddenRef.current, y, lastScrollY.current, headHRef.current);
    lastScrollY.current = y;
    if (hidden !== headHiddenRef.current) {
      headHiddenRef.current = hidden;
      setHeadHidden(hidden);
    }
    // The ayah just below the head. Only changes when another row reaches the
    // top, not on every pixel.
    const below = hidden ? 0 : headHRef.current;
    const top = rowVirtualizer.getVirtualItems().find((vi) => vi.end > y + below + 8);
    if (top) setTopId(itemFirstAyah.current(top.index));
  }, [rowVirtualizer]);
  // Measure the head (it grows with the search field).
  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const update = () => {
      headHRef.current = el.offsetHeight;
      setHeadH(el.offsetHeight);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
          el.getAttribute("role") === "combobox" ||
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

  // A sideways swipe moves to the next (swipe left) or previous (swipe right)
  // surah, juz, hizb, rukuʿ or page, like ← / →. Not from inputs and sliders,
  // nor while text is being selected.
  const swipe = useRef<{ x: number; y: number; at: number } | null>(null);
  const onSwipeStart = (e: React.TouchEvent) => {
    const el = e.target as Element;
    swipe.current =
      e.touches.length === 1 &&
      !el.closest("input, textarea, [role='slider'], [data-no-swipe]")
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY, at: Date.now() }
        : null;
  };
  const onSwipeEnd = (e: React.TouchEvent) => {
    const st = swipe.current;
    swipe.current = null;
    if (!st || Date.now() - st.at > 700) return;
    if (window.getSelection?.()?.toString()) return;
    const tch = e.changedTouches[0];
    const dx = tch.clientX - st.x;
    const dy = tch.clientY - st.y;
    if (Math.abs(dx) < 80 || Math.abs(dx) < 2.5 * Math.abs(dy)) return;
    go(target.value + (dx < 0 ? 1 : -1));
  };

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

  const openContext = (id: number) => {
    setSelectedId(id);
    if (docked) p.setShowContext(true);
    else setContextSheet(true);
  };

  const verseColor = (v: Verse): string =>
    surahColorById(v.s, colorMode, palette, surahMap, v.p);

  // The ayah the reader is on: the one at the top of the screen, else the
  // chosen one.
  const hereVerse = verses[(inScope(topId) ? topId! : (selected?.id ?? 1)) - 1];

  // ── Title ──
  // Reading by surah: that surah. By juz, hizb, rukuʿ or page: the surah
  // being read (it changes as you scroll), with the division in bold below.
  const scopeSurah = target.scope === "surah" ? surahMap.get(target.value) : undefined;
  const headerSurah = scopeSurah ?? (hereVerse ? surahMap.get(hereVerse.s) : undefined);
  const title = headerSurah ? (
    <span className="flex items-baseline gap-2">
      {/* On a phone the head holds six tools: the name alone. */}
      <span className="truncate">
        {narrow ? headerSurah.name : `${headerSurah.number}. ${headerSurah.name}`}
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
  const subtitle = scopeSurah ? (
    narrow ? null : (
      t.reader.meta(
        i18n.meaning(scopeSurah),
        i18n.place(scopeSurah.type),
        scopeSurah.revelationOrder,
        scopeSurah.ayahCount,
        n(scopeSurah.wordCount),
      )
    )
  ) : (
    <>
      <b className="font-semibold text-ink-muted">
        {t.scope[target.scope]} {target.value}
      </b>
      {!narrow && ` · ${t.reader.nVerses(scopeVerses.length)}`}
    </>
  );

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
    const tr = translation.data?.[v.id];
    const trName = editionName;
    const name = surahMap.get(v.s)?.name ?? `${t.common.surah} ${v.s}`;
    const text = [v.ar, tr ? `${tr} (${trName})` : null, `— ${name} ${v.s}:${v.a}`]
      .filter(Boolean)
      .join("\n\n");
    copy(v, text, "text");
  };

  const marksAt = useMemo(() => marksByAyah(marks), [marks]);
  const refOf = (id: number) => {
    const v = verses[id - 1];
    return v ? `${surahMap.get(v.s)?.name ?? ""} ${v.s}:${v.a}` : "";
  };

  // Last read (Home): the ayah at the top once it has stayed there a few
  // seconds, so scrolling past doesn't count; while reciting, the ayah heard.
  const readId = playingId ?? topId ?? (count > 0 ? scopeVerses[0]?.id : undefined);
  useEffect(() => {
    if (!onRead || readId === undefined) return;
    const timer = setTimeout(() => onRead(readId), playingId ? 0 : 3000);
    return () => clearTimeout(timer);
    // onRead is a fresh closure each render; the ayah is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readId, playingId]);

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
  const translations: RowTranslation[] = [
    {
      ...column(edition, translation.data, translation.loading),
      notes: footnotes[edition],
    },
    ...extraIds.map((id, i) => ({
      ...column(id, extraTr[i]?.data ?? null, extraTr[i]?.loading ?? true),
      notes: footnotes[id],
    })),
  ];
  const inlineTafsirs: RowTafsir[] = shownTafsirs.map((ed) => {
    const ai = ayahTafsirIds.indexOf(ed.id);
    const grouped = groupedTafsirs.get(ed.id);
    const lookup = tafsirGroups.get(ed.id);
    return {
      id: ed.id,
      label: ed.label,
      kind: ed.kind,
      lang: ed.lang,
      source: ed.source,
      published: lang === "id" ? ed.published.id : ed.published.en,
      loading:
        ed.kind === "ayah"
          ? (ayahTafsirs[ai]?.loading ?? true)
          : !lookup && !grouped?.error,
      ayah: ed.kind === "ayah" ? (ayahTafsirs[ai]?.data ?? null) : null,
      groupAt: (id, prevId) => (lookup ? tafsirGroupAt(lookup, id, prevId) : null),
    };
  });

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
    inlineTafsirs,
    search: searchHits,
    recited: surahTimings ? { clock: rec.clock, timing: timingOf } : null,
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
    canPlay: !!reciter,
    playingId,
    inEditedRange: (id) => !!loopRange && id >= range.from && id <= range.to,
    playFrom,
    marksAt,
    openMark: (id, kind) => setMarkFor({ id, kind }),
    copied,
    copyText,
    copyLink,
    selectedId: highlightId,
    openContext,
    menuFor,
    setMenuFor,
  };

  // End-of-scope "continue" targets.
  const nextTarget: ReaderTarget | null =
    target.value < max ? { scope: target.scope, value: target.value + 1 } : null;
  const prevTarget: ReaderTarget | null =
    target.value > 1 ? { scope: target.scope, value: target.value - 1 } : null;
  const nextRevealed = headerSurah
    ? surahs.find((x) => x.revelationOrder === headerSurah.revelationOrder + 1)
    : undefined;

  const loadError =
    tajweedState.error ||
    wordByWordState.error ||
    themesState.error ||
    asbabState.error ||
    tafsirError ||
    layoutState.error;

  const divisions: ReaderScope[] = (DIVISIONS as readonly ReaderScope[]).includes(
    target.scope,
  )
    ? [...DIVISIONS]
    : [...DIVISIONS, target.scope];
  const settings = (
    <div className="flex flex-col gap-3">
      <Select<ReaderScope>
        label={t.reader.divideBy}
        value={target.scope}
        options={divisions.map((d) => ({ value: d, label: t.scope[d] }))}
        onChange={(scope) => {
          if ((DIVISIONS as readonly string[]).includes(scope))
            p.setDivision(scope as (typeof DIVISIONS)[number]);
          if (hereVerse)
            onNavigate({
              scope,
              value: scopeField(hereVerse, scope),
              anchor: hereVerse.id,
            });
        }}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">
          {t.reader.translations}
        </span>
        <EditionSelect
          index={editions}
          value={edition}
          onChange={onEditionChange}
          ariaLabel={t.reader.translation}
          exclude={p.extraEditions}
        />
        {p.extraEditions.map((id, i) => (
          <div key={id} className="flex items-center gap-1">
            <EditionSelect
              className="flex-1"
              index={editions}
              value={id}
              ariaLabel={t.reader.extraTranslation(i + 2)}
              exclude={[edition, ...p.extraEditions]}
              onChange={(next) =>
                p.setExtraEditions(p.extraEditions.map((x) => (x === id ? next : x)))
              }
            />
            <QuietIconButton
              label={t.reader.remove(
                editionByIdentifier(editions, id)?.englishName ?? id,
              )}
              onClick={() => p.setExtraEditions(p.extraEditions.filter((x) => x !== id))}
            >
              <X size={16} />
            </QuietIconButton>
          </div>
        ))}
        {p.extraEditions.length < MAX_EXTRA && (
          <button
            type="button"
            onClick={() => {
              const taken = new Set([edition, ...p.extraEditions]);
              const pick =
                editions.editions.find(
                  (e) => e.language === lang && !taken.has(e.identifier),
                ) ?? editions.editions.find((e) => !taken.has(e.identifier));
              if (pick) p.setExtraEditions([...p.extraEditions, pick.identifier]);
            }}
            className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg px-1 text-sm text-illumination hover:bg-surface-sunken touch:min-h-11"
          >
            <Plus size={15} aria-hidden /> {t.reader.addTranslation}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">{t.reader.display}</p>
      <Toggle
        checked={p.showTranslit}
        onChange={p.setShowTranslit}
        label={t.reader.transliteration}
      />
      <Toggle checked={p.showTafsir} onChange={p.setShowTafsir} label={t.reader.tafsir} />
      {p.showTafsir && (
        <div className="flex flex-col gap-1.5">
          <Select
            value={p.tafsirEdition}
            onChange={(id) => {
              p.setTafsirEdition(id);
              p.setExtraTafsirs(p.extraTafsirs.filter((x) => x !== id));
            }}
            label={t.reader.tafsirSource}
            options={tafsirOptions(lang, tafsirDl)}
          />
          {p.extraTafsirs.map((id, i) => (
            <div key={id} className="flex items-center gap-1">
              <Select
                className="flex-1"
                value={id}
                ariaLabel={t.reader.extraTafsir(i + 2)}
                onChange={(next) =>
                  p.setExtraTafsirs(p.extraTafsirs.map((x) => (x === id ? next : x)))
                }
                options={tafsirOptions(lang, tafsirDl).filter(
                  (o) =>
                    o.value === id ||
                    (o.value !== p.tafsirEdition && !p.extraTafsirs.includes(o.value)),
                )}
              />
              <QuietIconButton
                label={t.reader.remove(tafsirById(id).label)}
                onClick={() => p.setExtraTafsirs(p.extraTafsirs.filter((x) => x !== id))}
              >
                <X size={16} />
              </QuietIconButton>
            </div>
          ))}
          {p.extraTafsirs.length < MAX_EXTRA && (
            <button
              type="button"
              onClick={() => {
                const taken = new Set([p.tafsirEdition, ...p.extraTafsirs]);
                const pick = tafsirOptions(lang).find((o) => !taken.has(o.value));
                if (pick) p.setExtraTafsirs([...p.extraTafsirs, pick.value]);
              }}
              className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg px-1 text-sm text-illumination hover:bg-surface-sunken touch:min-h-11"
            >
              <Plus size={15} aria-hidden /> {t.reader.addTafsir}
            </button>
          )}
        </div>
      )}
      {p.showTafsir &&
        pendingTafsirs.map((ed) => (
          <TafsirDownloadOffer key={ed.id} ed={ed} dl={tafsirDl} />
        ))}
      <Toggle
        checked={p.showTajweed}
        onChange={p.setShowTajweed}
        label={t.reader.tajweed}
      />
      {p.showTajweed && (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            setSettingsOpen(false);
            setTajweedRules(true);
          }}
          className="-mt-1 inline-flex min-h-10 items-center justify-between gap-2 rounded-lg px-1 text-left text-sm text-illumination hover:bg-surface-sunken touch:min-h-11"
        >
          {t.reader.tajweedRules}
          <ArrowRight size={15} aria-hidden />
        </button>
      )}
      <Select<(typeof MUSHAF_LAYOUTS)[number]>
        label={t.reader.layout}
        value={p.mushafLayout}
        onChange={(l) => {
          p.setMushafLayout(l);
          if (mode !== "mushaf") p.setMode("mushaf");
        }}
        options={MUSHAF_LAYOUTS.map((l) => ({ value: l, label: t.reader.layouts[l] }))}
      />
      {mode === "mushaf" && p.mushafLayout !== "flow" && (
        <p className="-mt-1.5 text-xs text-ink-subtle">{t.reader.layoutNote}</p>
      )}
      <Toggle checked={p.showWords} onChange={p.setShowWords} label={t.reader.wbw} />
      {p.showWords && (
        <Select<GlossLang>
          value={p.glossLang}
          onChange={p.setGlossLang}
          label={t.reader.glossLang}
          options={[
            { value: "en", label: t.reader.glossEn },
            { value: "id", label: t.reader.glossId },
          ]}
        />
      )}
      <Toggle checked={p.showThemes} onChange={p.setShowThemes} label={t.reader.themes} />
      <Toggle checked={p.showAsbab} onChange={p.setShowAsbab} label={t.reader.asbab} />
      {docked && (
        <Toggle
          checked={p.showContext}
          onChange={p.setShowContext}
          label={t.reader.contextPanel}
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
                    : layoutState.error
                      ? t.reader.failedWhat.layout
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

  // The surah "About" describes: the one of the ayah at the top.
  const infoSurah = hereVerse ? surahMap.get(hereVerse.s) : undefined;
  // The head stays put while anything it opened, or any sheet, is up.
  const headOff =
    headHidden &&
    !searchOpen &&
    !query &&
    !settingsOpen &&
    !goToOpen &&
    !markFor &&
    !contextSheet &&
    !playerSheet &&
    !showInfo &&
    !tajweedRules;

  return (
    <section
      ref={rootRef}
      aria-label={t.reader.aria}
      className={cx(
        "relative flex h-[calc(100*var(--zvh))] min-w-0 flex-col bg-paper",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      {/* The head floats over the list so hiding it never resizes the scroller
          (the text would jump). The list reserves its height (paddingStart). */}
      <div
        ref={headRef}
        // `inert` is not in React 18's types; passed through as an attribute.
        {...({ inert: headOff ? "" : undefined } as object)}
        aria-hidden={headOff || undefined}
        className={cx(
          "absolute inset-x-0 top-0 z-20 bg-paper pt-[env(safe-area-inset-top)]",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          headOff && "-translate-y-full",
        )}
      >
        <ReaderToolbar
          title={title}
          subtitle={subtitle}
          compact={narrow}
          onBack={onClose}
          onGoTo={() => setGoToOpen(true)}
          mode={mode}
          onMode={p.setMode}
          searchOpen={searchOpen || !!query}
          onSearchOpen={setSearchOpen}
          query={query}
          onQuery={setQuery}
          matches={
            q
              ? {
                  count: matches.length,
                  at: Math.min(matchAt, matches.length - 1),
                  onStep: stepMatch,
                }
              : null
          }
          info={{ on: showInfo, toggle: () => setShowInfo(!showInfo) }}
          player={
            reciter
              ? { on: p.showAudio, toggle: () => p.setShowAudio(!p.showAudio) }
              : null
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
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onListScroll}
          onTouchStart={onSwipeStart}
          onTouchEnd={onSwipeEnd}
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
                <p
                  className="py-8 text-center text-sm text-ink-subtle"
                  style={{ marginTop: headH }}
                >
                  {t.reader.noMatch}
                </p>
              )}
              {rowVirtualizer.getVirtualItems().map((vi) => {
                if (layout && layoutPages)
                  return (
                    <div
                      key={vi.key}
                      ref={rowVirtualizer.measureElement}
                      data-index={vi.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vi.start}px)`,
                      }}
                    >
                      <MushafLinesPage
                        layout={layout}
                        page={layoutPages[vi.index]}
                        verses={verses}
                        surahMap={surahMap}
                        wordCount={wordCount}
                        inScope={(id) => id >= scopeRange.from && id <= scopeRange.to}
                        tajweed={p.showTajweed ? tajweedState.data : null}
                        selectedId={highlightId}
                        playingId={audioOn ? playingId : undefined}
                        clock={rec.clock}
                        timing={timingOf}
                        onSelect={openContext}
                      />
                    </div>
                  );
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
                        selectedId={highlightId}
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
            {!query.trim() && count > 0 && (prevTarget || nextTarget || nextRevealed) && (
              <div className="flex flex-wrap items-center justify-center gap-2 pb-2 pt-4">
                {prevTarget && (
                  <button
                    type="button"
                    onClick={() => onNavigate(prevTarget)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm text-ink-muted touch:min-h-11 hover:bg-surface-sunken"
                  >
                    <ArrowLeft size={15} aria-hidden />
                    {t.reader.prev(t.scope[target.scope])}
                  </button>
                )}
                {nextTarget && (
                  <button
                    type="button"
                    onClick={() => onNavigate(nextTarget)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-illumination px-4 py-2.5 text-sm font-semibold text-white touch:min-h-11 dark:text-paper"
                  >
                    {t.reader.continueTo(t.scope[target.scope], nextTarget.value)}
                    {target.scope === "surah" && surahMap.get(nextTarget.value)
                      ? ` · ${surahMap.get(nextTarget.value)!.name}`
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
                    {t.reader.nextRevealed(nextRevealed.id, nextRevealed.name)}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {docked && p.showContext && (
          <aside
            aria-label={t.reader.contextPanel}
            className="w-[24rem] shrink-0 overflow-y-auto border-l border-line bg-surface transition-[padding] duration-200 motion-reduce:transition-none"
            style={{ paddingTop: headOff ? 0 : headH }}
          >
            {contextPanel()}
          </aside>
        )}
      </div>

      {audioOn && (
        <MiniPlayer
          rec={rec}
          verses={verses}
          reciter={reciterId}
          reciterName={reciterName}
          options={p.audioOpts}
          onOptions={p.setAudioOpts}
          range={range}
          onRange={editRange}
          roomy={width >= PLAYER_ROOMY_PX}
          onOpenOptions={openPlayerSheet}
          onClose={() => p.setShowAudio(false)}
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
        open={goToOpen}
        onClose={() => setGoToOpen(false)}
        title={t.reader.goTo}
        side="top"
        closeLabel={t.common.close}
      >
        {goToOpen && selected && (
          <GoToSheet
            surahs={surahs}
            verses={verses}
            scope={target.scope}
            at={verses[(inScope(topId) ? topId! : selected.id) - 1] ?? selected}
            onGo={(tg) => {
              setGoToOpen(false);
              onNavigate(tg);
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={!!markFor}
        onClose={() => setMarkFor(null)}
        title={
          markFor
            ? (markFor.kind === "pin" ? t.marks.pinTitle : t.marks.saveTitle)(
                refOf(markFor.id),
              )
            : ""
        }
        side={phone ? "bottom" : "right"}
        closeLabel={t.common.close}
      >
        {markFor && (
          <MarkSheet
            kind={markFor.kind}
            ayah={markFor.id}
            refOf={refOf}
            marks={marks}
            onMarks={onMarks}
          />
        )}
      </Sheet>

      <Sheet
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title={infoSurah ? t.reader.aboutSurah(infoSurah.name) : t.reader.about}
        side="bottom"
        closeLabel={t.common.close}
      >
        {infoSurah && (
          <div className="px-4 py-3">
            <SegmentedControl<InfoLang>
              value={p.infoLang}
              onChange={p.setInfoLang}
              ariaLabel={t.reader.infoLang}
              options={[
                { value: "en", label: "English" },
                { value: "id", label: "Indonesia" },
              ]}
            />
            <div
              lang={p.infoLang}
              className="mt-3 max-w-[68ch] whitespace-pre-line font-reading leading-relaxed text-ink"
            >
              {infoState.loading
                ? t.common.loading
                : infoState.error
                  ? t.common.failedToLoad(infoState.error)
                  : infoState.data?.[infoSurah.id]
                    ? renderInline(infoState.data[infoSurah.id]!)
                    : t.reader.noInfo}
            </div>
            <p className="mt-2 text-xs text-ink-subtle">
              {t.reader.infoSource(p.infoLang === "en")}
            </p>
          </div>
        )}
      </Sheet>

      <Sheet
        open={tajweedRules}
        onClose={() => setTajweedRules(false)}
        title={t.reader.tajweedRules}
        side="bottom"
        closeLabel={t.common.close}
      >
        <TajweedRules dark={dark} />
      </Sheet>

      <Sheet
        open={audioOn && playerSheet}
        onClose={() => setPlayerSheet(false)}
        title={t.reader.audio.options}
        side="bottom"
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
          onRange={editRange}
          onResetRange={() => editRange(null)}
          options={p.audioOpts}
          onOptions={p.setAudioOpts}
          storage={storage}
          reciterNote={native ? reciterNote : undefined}
          timed={(id) => TIMED_RECITERS.has(id)}
          onPlay={() => {
            setPlayerSheet(false);
            rec.play(range.from);
          }}
          onCancel={() => {
            const was = sheetSnapshot.current;
            if (was) {
              editRange(was.loopRange);
              p.setAudioOpts(was.options);
              p.setReciter(was.reciter);
            }
            setPlayerSheet(false);
          }}
        />
      </Sheet>
    </section>
  );
}
