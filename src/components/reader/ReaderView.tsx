import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useListVirtualizer } from "../../lib/useListVirtualizer";
import { useStableFn } from "../../lib/useStableFn";
import { ArrowLeft, ArrowRight, ClipboardCheck, EyeOff, Plus, X } from "lucide-react";
import type { EditionsIndex, Surah, Verse } from "../../types/quran";
import { SCOPE_MAX, surahColorById, type ReaderScope } from "../charts/common";
import type { ColorMode, ReaderTarget } from "../charts/common";
import { useTranslation, useTranslations } from "../../data/useTranslation";
import { useTajweed } from "../../data/useTajweed";
import { loadSurahWords, useSurahWords } from "../../data/words";
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
import {
  cachedGroupedTafsir,
  loadSurah as loadGroupedTafsir,
  useGroupedTafsirs,
} from "../../data/useGroupedTafsir";
import { footnotesPending, useFootnotes } from "../../data/footnotes";
import {
  findAllArabic,
  findAllLatin,
  isAyahRef,
  type TextMatch,
} from "../../data/textSearch";
import type { Hits } from "./MarkedText";
import {
  pageOf,
  useMushafLayout,
  pageAyahs,
  wordCounter,
  type LayoutLine,
} from "../../data/mushafLayout";
import { TIMED_RECITERS, useWordTimings } from "../../data/wordTimings";
import { MushafLinesPage } from "./MushafLinesPage";
import { needsDownload, useTafsirDownloads } from "../../data/tafsirStore";
import { TafsirDownloadOffer } from "./TafsirDownload";
import { useElementWidth } from "../../lib/useElementWidth";
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
  Button,
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
  RECITERS,
  estimateAudioBytes,
  formatBytes,
  outsideRange,
  type LoopRange,
  type RecitationOptions,
} from "../../data/recitation";
import { useRecitationContext } from "../../data/RecitationContext";
import {
  cancelDownloads,
  deviceTimings,
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
import { HifdhSheet } from "./HifdhSheet";
import {
  RATINGS,
  addStumble,
  gradeOf,
  pagesWith,
  rateReview,
  stumbleCount,
  type Hifdh,
} from "../../lib/hifdh";
import { appendReviews } from "../../lib/reviewLog";
import { dayKey } from "../../data/readingLog";
import {
  HIFDH_LEVELS,
  maskedParts,
  type HifdhLevel,
  type WordMask,
} from "../../data/hifdh";
import { splitWords } from "../../data/mushafLayout";
import { EASE_OUT, animateTo, prefersReducedMotion } from "../../lib/drag";
import { useSwipePager } from "../../lib/useSwipePager";
import { ReaderPeek } from "./ReaderPeek";
import { ReaderToolbar } from "./ReaderToolbar";
import {
  VerseRow,
  type RowContext,
  type RowTafsir,
  type RowTranslation,
} from "./VerseRow";
import { MushafPage } from "./MushafPage";
import { WordDetailPage, WordPopover } from "./WordDetail";
import { pickOf, type AyahPick, type PickRect, type WordPick } from "./wordPick";
import { AyahPopover } from "./AyahPopover";
import { ayahInView, shouldFollow } from "../../lib/ayahInView";
import { popupRoot, rootZoom } from "../ui/popup";
import { VerseContextPanel, type ExploreTarget } from "./VerseContextPanel";
import {
  copyToClipboard,
  DIVISIONS,
  MAX_EXTRA,
  MUSHAF_LAYOUTS,
  scopeField,
  tafsirOptions,
  useReaderPrefs,
  windowRows,
  type WindowRows,
} from "./readerShared";

/** End-of-scope buttons: a long surah name wraps instead of overflowing a phone. */
const END_NAV = "h-auto min-h-9 max-w-full !whitespace-normal py-2 text-center";

/** Reader width (CSS px, after zoom) below which the tools go icon-only. */
const NARROW_PX = 560;
/** Reader width from which the player keeps the range ends beside its seek bar. */
const PLAYER_ROOMY_PX = 560;
/** Reader width from which the context panel docks beside the text. */

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
  /** Memorisation status and stumbles (owned by App, persisted). */
  hifdh: Hifdh;
  onHifdh: (h: Hifdh) => void;
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
/** The list's rows. They re-render on their own as the list scrolls (the
 *  reader around them does not; see `useListVirtualizer`); `afterRender`
 *  runs after each of their renders. */
function VirtualRows({
  subscribe,
  afterRender,
  children,
}: {
  subscribe: (f: () => void) => () => void;
  afterRender: () => void;
  children: () => ReactNode;
}) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => subscribe(rerender), [subscribe]);
  useEffect(() => afterRender());
  return <>{children()}</>;
}

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
  hifdh,
  onHifdh,
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
  // The row across the middle of the list: in the mushaf, the page in view.
  const [viewIndex, setViewIndex] = useState(0);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(false);
  const navSettledRef = useRef(false);
  // The window a swipe committed to: the pager has slid it in already.
  const swipedTo = useRef("");
  // Set when that window opened at its top, so the anchor jump is skipped.
  const openedAtTop = useRef(false);
  // A tapped word (its popup), and the word whose details page is open.
  const [wordPick, setWordPick] = useState<WordPick | null>(null);
  const [wordDetail, setWordDetail] = useState<{ id: number; w: number } | null>(null);
  // A tapped ayah in the mushaf layouts (its popup: reference and translation).
  const [ayahPick, setAyahPick] = useState<AyahPick | null>(null);

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
  const translation = useTranslation(mode === "ayah" || ayahPick ? edition : null);
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
  // Word data (meanings, grammar): for word by word, and once a word is
  // tapped. Mushaf pages also show the edges of the surahs around the scope.
  const pickedSurah = verses[(wordDetail?.id ?? wordPick?.id ?? 0) - 1]?.s;
  const wordSurahs = useMemo(() => {
    if (!p.showWords && pickedSurah === undefined) return null;
    const set = new Set(scopeSurahs);
    if (mode === "mushaf")
      for (const x of scopeSurahs) {
        if (x > 1) set.add(x - 1);
        if (x < 114) set.add(x + 1);
      }
    if (pickedSurah !== undefined) set.add(pickedSurah);
    return [...set].sort((a, b) => a - b);
  }, [p.showWords, pickedSurah, scopeSurahs, mode]);
  const wordsAt = useSurahWords(wordSurahs);
  const wordsOf = useCallback(
    (id: number) => {
      const v = verses[id - 1];
      return v ? wordsAt(v.s, v.a) : undefined;
    },
    [verses, wordsAt],
  );
  // Hafalan mode: ayahs the learner uncovered to check themselves, and single
  // words they peeked at. Both start over with the window or the level.
  // The ayah whose memorisation is being marked.
  const [hifdhFor, setHifdhFor] = useState<number | null>(null);
  // Rating how reciting this window from memory went.
  const [rating, setRating] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const [peeked, setPeeked] = useState<ReadonlySet<string>>(new Set());
  const hideAgain = useCallback(() => {
    setRevealed(new Set());
    setPeeked(new Set());
  }, []);
  useEffect(hideAgain, [hideAgain, target.scope, target.value, p.hifdhLevel, p.hifdhOn]);
  const mask = useMemo<WordMask | null>(
    () =>
      p.hifdhOn
        ? {
            level: p.hifdhLevel,
            ayahShown: (id) => revealed.has(id),
            wordShown: (id, w) => peeked.has(`${id}:${w}`),
            stumbled: (id, w) => stumbleCount(hifdh, id, w) > 0,
          }
        : null,
    [p.hifdhOn, p.hifdhLevel, revealed, peeked, hifdh],
  );
  // The memorised pages in this window: what a rating applies to.
  const ratePages = useMemo(
    () => (p.hifdhOn ? pagesWith(hifdh, scopeVerses, [2, 3]) : []),
    [p.hifdhOn, hifdh, scopeVerses],
  );
  const covered = (id: number) => !!mask && !revealed.has(id);
  const reveal = (id: number) => setRevealed((s) => new Set(s).add(id));
  const openWord = (id: number, w: number, el: Element) => {
    setMenuFor(null);
    setAyahPick(null);
    setWordPick(pickOf(id, w, el));
  };
  // One popup at a time: a word's or an ayah's. While an ayah is covered, a
  // tap uncovers it instead (to check a recitation from memory).
  const onWord = useStableFn((id: number, w: number, el: Element) => {
    if (covered(id)) reveal(id);
    else openWord(id, w, el);
  });
  // Press-and-hold on a printed word. On a hidden word it is a peek: only
  // that word shows, and it is kept as a stumble.
  const onWordHold = useStableFn((id: number, w: number, el: Element) => {
    const text = splitWords(verses[id - 1]?.ar ?? "")[w] ?? "";
    if (!maskedParts(mask, id, w, text)[1]) return openWord(id, w, el);
    setPeeked((s) => new Set(s).add(`${id}:${w}`));
    onHifdh(addStumble(hifdh, id, w, Date.now()));
  });
  const onAyah = useStableFn((id: number, rect: PickRect) => {
    if (covered(id)) return reveal(id);
    setWordPick(null);
    setAyahPick({ id, rect });
  });
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

  // ── Recitation: owned by RecitationProvider, so it outlives the reader ──
  const audio = useRecitationContext();
  const { rec, reciters, reciter, reciterId, loopRange, setLoopRange, setScopeRange } =
    audio;
  const scopeRange = useMemo<LoopRange>(
    () =>
      scopeVerses.length
        ? { from: scopeVerses[0].id, to: scopeVerses[scopeVerses.length - 1].id }
        : { from: 1, to: 1 },
    [scopeVerses],
  );
  // What the player plays: an edited range, else what this view gives it (the
  // provider keeps the last one after the reader closes; see `followRange`).
  const range = loopRange ?? audio.viewRange;
  // ── Android app: recitation lives in device storage, downloaded per surah ──
  const native = isNativeApp();
  // The chosen reciter's downloads; the others' (their surah counts in the
  // reciter list) are read only once the player's sheet is open.
  const downloads = useAudioDownloads(playerSheet ? RECITERS : [reciterId]);
  const onDevice = downloads.downloaded[reciterId];
  const totalWords = useMemo(() => surahs.reduce((n, x) => n + x.wordCount, 0), [surahs]);
  const reciterName = reciter?.name ?? "";
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

  let downloadPrompt: AudioDownloadPrompt | null = null;
  let storage: AudioStorage | null = null;
  if (native && onDevice) {
    // The surah playback stopped at, then the rest of the range: Play waits
    // for all of them.
    const missingSurah = rec.missing !== null ? verses[rec.missing - 1]?.s : undefined;
    const ns = missingSurah ? [missingSurah] : [];
    const lastSurah = verses[range.to - 1]?.s ?? 0;
    for (let n = verses[range.from - 1]?.s ?? 1; n <= lastSurah; n++)
      if (n !== missingSurah) ns.push(n);
    const want = ns.filter((n) => !onDevice[n]);
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
      // Play downloads by itself (the provider's onMissing); a retry is Play.
      auto: !audio.confirmDownload,
      onStart: audio.confirmDownload
        ? () => downloadSurahs(reciterId, jobsFor(want))
        : rec.toggle,
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
    };
  }
  const audioOn = !!reciter && audio.showAudio;
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
      options: audio.audioOpts,
      reciter: audio.reciterPref,
    };
    setPlayerSheet(true);
  };
  const reciterNote = (id: string) => {
    const n = Object.keys(downloads.downloaded[id] ?? {}).length;
    return n > 0 ? t.reader.audio.nSurahs(n) : null;
  };
  const hasCursor = rec.cursor !== null;
  /** Play `id` alone (with its repeats): the range becomes that ayah, so the
   *  player stops after it. A hidden player opens. */
  const playAyah = useStableFn((id: number) => {
    if (!audio.showAudio) audio.setShowAudio(true);
    setLoopRange({ from: id, to: id });
    rec.play(id);
  });
  const playingId = rec.cursor?.id;
  // Word timings of the surah being recited (some reciters only). In the app
  // they are downloaded with the surah's audio.
  const playingSurah = playingId ? (verses[playingId - 1]?.s ?? null) : null;
  const surahTimings = useWordTimings(
    reciterId,
    audioOn ? playingSurah : null,
    native ? deviceTimings : undefined,
    playingId,
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
    const r = next ?? audio.viewRange;
    if (rec.cursor && outsideRange(rec.cursor.id, r)) rec.moveTo(r.from);
  };

  // ── Items: ayahs, or mushaf pages ──
  const filtered = scopeVerses;
  // A printed layout's pages, once its file is in; flowing pages otherwise.
  const layoutId = mode === "mushaf" && p.mushafLayout !== "flow" ? p.mushafLayout : null;
  const layoutState = useMushafLayout(layoutId);
  const layout = layoutId && layoutState.data?.page ? layoutState.data : null;
  const wordCount = useMemo(() => wordCounter(verses), [verses]);
  const rows = useMemo(
    () => windowRows(scopeVerses, mode === "mushaf", layout),
    [scopeVerses, mode, layout],
  );
  const { layoutPages, pages, count } = rows;
  const indexOfAyah = useCallback(
    (id: number) =>
      layout && layoutPages
        ? layoutPages.indexOf(pageOf(layout, id))
        : pages
          ? pages.findIndex((pg) => pg.some((v) => v.id === id))
          : filtered.findIndex((v) => v.id === id),
    [layout, layoutPages, pages, filtered],
  );

  // ── The player's range follows the view: the "read by" scope in ayah view,
  // the page in view in the mushaf (its ayahs inside the scope) ──
  const pageRangeAt = useCallback(
    (i: number): LoopRange | null => {
      if (mode !== "mushaf" || i < 0 || i >= count) return null;
      const r =
        layout && layoutPages
          ? pageAyahs(layout, layoutPages[i], verses.length)
          : pages
            ? { from: pages[i][0].id, to: pages[i][pages[i].length - 1].id }
            : null;
      if (!r) return null;
      const from = Math.max(r.from, scopeRange.from);
      const to = Math.min(r.to, scopeRange.to);
      return from <= to ? { from, to } : null;
    },
    [mode, count, layout, layoutPages, pages, verses.length, scopeRange],
  );
  const pageRange = pageRangeAt(Math.min(viewIndex, count - 1));
  const followRange = pageRange ?? scopeRange;
  // The page being recited stays the range while the learner scrolls on; a
  // new window, stopping, or an ayah outside it hands the range to the view.
  const pushed = useRef<LoopRange | null>(null);
  const byPage = !!pageRange;
  useLayoutEffect(() => {
    const held = pushed.current;
    if (
      pageRange &&
      held &&
      playingId !== undefined &&
      !outsideRange(playingId, held) &&
      held.from >= scopeRange.from &&
      held.to <= scopeRange.to
    )
      return;
    pushed.current = followRange;
    setScopeRange(followRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followRange.from, followRange.to, playingId, byPage, scopeRange, setScopeRange]);
  // A new window (or page in the mushaf) resets an edited range, unless
  // something is playing from it.
  useEffect(() => {
    if (!hasCursor) setLoopRange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeRange, pageRange?.from, pageRange?.to]);
  useEffect(() => setViewIndex(0), [scopeRange, mode, layoutId]);

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

  const {
    virtualizer: rowVirtualizer,
    scrolling: listScrolling,
    subscribe: onListChange,
  } = useListVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    // A printed page is some 15 lines of 2.05em (2.9em with meanings) at a
    // font of about a 15th of its width: a close guess keeps the list from
    // counting two pages on screen where one fits.
    estimateSize: () =>
      layoutPages
        ? Math.round(Math.min(width, 640) * (p.showWords ? 2.9 : 2.05)) + 80
        : pages
          ? 720
          : 170,
    getItemKey: (i) =>
      layoutPages ? `L${layoutPages[i]}` : pages ? `p${pages[i][0].id}` : filtered[i].id,
    // A mushaf page is a screen or more of text: two either side is plenty.
    overscan: pages || layoutPages ? 2 : 4,
    // Room under the floating head, and scrolls to a row stop below it.
    paddingStart: headH,
    scrollPaddingStart: headH,
    // Breathing room below the final item; scales with the Arabic size.
    paddingEnd: Math.round(24 * arabicScale),
  });

  // Rows are measured as they render and re-measured by a ResizeObserver when
  // they change size. A Qur'an font arriving late reflows rows measured with
  // the fallback font; once the fonts are in, read every rendered row's height
  // again from the DOM. (Not `measure()`: it empties the size cache, and rows
  // whose height did not change then fell back to the estimate and
  // overlapped for a few frames.)
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      const list = scrollRef.current;
      if (!alive || !list) return;
      list
        .querySelectorAll<HTMLElement>("[data-index]")
        .forEach((el) =>
          rowVirtualizer.resizeItem(Number(el.dataset.index), el.offsetHeight),
        );
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
    // A swiped-to window was opened at its top already (no anchor to find).
    if (openedAtTop.current) {
      openedAtTop.current = false;
      navSettledRef.current = true;
      return;
    }
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

  // ── Following the recitation ──
  // The ayah's own boxes (its row, its span in the flow mushaf, its words in
  // the printed one), and the band of the list below the floating head.
  const ayahRects = (id: number): DOMRect[] => {
    const sc = scrollRef.current;
    if (!sc) return [];
    return [...sc.querySelectorAll(`[data-ayah="${id}"]`)].flatMap((el) =>
      mode === "ayah" ? [el.getBoundingClientRect()] : [...el.getClientRects()],
    );
  };
  const listBand = () => {
    const sc = scrollRef.current!.getBoundingClientRect();
    const head = headRef.current?.getBoundingClientRect();
    return { top: Math.max(sc.top, head?.bottom ?? sc.top), bottom: sc.bottom };
  };
  const inView = (id: number) =>
    !!scrollRef.current && ayahInView(ayahRects(id), listBand(), mode === "ayah");
  // Scroll to an ayah: its row; in the mushaf its page, then the ayah itself
  // near the top of the band once the page is drawn (a page can be taller
  // than the screen). Instant, like the anchor jumps.
  const bringTry = useRef(0);
  const scrollToAyah = (id: number) => {
    const idx = indexOfAyah(id);
    if (idx < 0) return;
    quietScrollUntil.current = Date.now() + 700;
    if (mode === "ayah") {
      rowVirtualizer.scrollToIndex(idx, { align: "start" });
      return;
    }
    if (!ayahRects(id).length) rowVirtualizer.scrollToIndex(idx, { align: "start" });
    const run = ++bringTry.current;
    let tries = 12;
    const step = () => {
      const sc = scrollRef.current;
      if (run !== bringTry.current || !sc) return;
      const rects = ayahRects(id);
      if (!rects.length) {
        if (--tries > 0) requestAnimationFrame(step);
        return;
      }
      const b = listBand();
      const top = Math.min(...rects.map((r) => r.top));
      quietScrollUntil.current = Date.now() + 400;
      // Rects are in screen px; scrollTop in the zoomed root's px.
      sc.scrollTop += (top - b.top - (b.bottom - b.top) * 0.15) / rootZoom(popupRoot());
    };
    requestAnimationFrame(() => requestAnimationFrame(step));
  };
  // A new ayah: no scroll while it is in view; else follow only a learner who
  // was following (the previous ayah was in view, or nothing played before).
  // One who scrolled away to read is left there.
  const prevPlaying = useRef<number | undefined>(undefined);
  useEffect(() => {
    const prev = prevPlaying.current;
    prevPlaying.current = playingId;
    if (playingId === undefined || prev === playingId) return;
    if (shouldFollow(inView(playingId), prev === undefined ? null : inView(prev)))
      scrollToAyah(playingId);
    // Only a change of ayah moves the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId]);
  /** The player's "go to the ayah being recited": always scrolls; outside the
   *  scope, opens it there. */
  const goToPlaying = () => {
    if (playingId === undefined) return;
    if (indexOfAyah(playingId) >= 0) return scrollToAyah(playingId);
    const v = verses[playingId - 1];
    if (v)
      onNavigate({
        scope: target.scope,
        value: scopeField(v, target.scope),
        anchor: playingId,
      });
  };

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
  const settleTimer = useRef(0);
  useEffect(() => () => clearTimeout(settleTimer.current), []);
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
    // The ayah just below the head (the title, the strip's mark) and, in the
    // mushaf, the page across the middle (the player's range). Set once the
    // list settles: setting them as each row crossed re-rendered the whole
    // reader in the middle of a scroll.
    const below = hidden ? 0 : headHRef.current;
    const items = rowVirtualizer.getVirtualItems();
    const top = items.find((vi) => vi.end > y + below + 8);
    const mid =
      mode === "mushaf"
        ? items.find((vi) => vi.end > y + (below + sc.clientHeight) / 2)
        : undefined;
    clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (top) setTopId(itemFirstAyah.current(top.index));
      if (mid) setViewIndex(mid.index);
    }, 120);
  }, [rowVirtualizer, mode]);
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
  const lastTotal = useRef(0);
  const pinToBottom = () => {
    const total = rowVirtualizer.getTotalSize();
    if (total === lastTotal.current) return;
    lastTotal.current = total;
    const sc = scrollRef.current;
    if (sc && navSettledRef.current && atBottomRef.current)
      sc.scrollTop = sc.scrollHeight;
  };

  // ← / → step through the scope (not while typing).
  const max = SCOPE_MAX[target.scope];
  // The side the next window arrives from: +1 going forward, -1 going back.
  const arriveFrom = useRef(0);
  const go = useCallback(
    (value: number) => {
      if (value < 1 || value > max) return;
      arriveFrom.current = Math.sign(value - target.value);
      onNavigate({ scope: target.scope, value });
    },
    [max, onNavigate, target.scope, target.value],
  );
  // A sideways swipe moves to the next (swipe right) or previous (swipe left)
  // surah, juz, hizb, rukuʿ or page, as pages turn in an Arabic mushaf, with
  // the neighbour's start
  // (`ReaderPeek`) beside the text while the finger is down. Not over an
  // open popover, menu or sheet, nor while searching (the hits are this
  // window's; the end-of-list buttons hide then too).
  const scopeKey = `${target.scope}:${target.value}`;
  const {
    handlers: pagerHandlers,
    sides: pagerSides,
    trackRef: slideRef,
  } = useSwipePager({
    current: scopeKey,
    // The pager's +1 is the pane on the right (a swipe left): a step back.
    canGo: (d) => target.value - d >= 1 && target.value - d <= max,
    onCommit: (d) => {
      swipedTo.current = `${target.scope}:${target.value - d}`;
      go(target.value - d);
    },
    enabled:
      !query.trim() &&
      !settingsOpen &&
      !goToOpen &&
      !markFor &&
      !contextSheet &&
      !playerSheet &&
      !showInfo &&
      !tajweedRules &&
      hifdhFor === null &&
      !rating &&
      menuFor === null &&
      !ayahPick &&
      !wordPick &&
      !wordDetail,
    // Each neighbour's first screen is cheap: mounted when idle, so a drag
    // does no React work.
    ahead: true,
  });
  const sidesKey = pagerSides.join();
  const peeks = useMemo(
    () =>
      sidesKey
        .split(",")
        .filter(Boolean)
        .map((d) => {
          const dir = Number(d) as -1 | 1;
          const value = target.value - dir;
          const rows = windowRows(
            verses.filter((v) => scopeField(v, target.scope) === value),
            mode === "mushaf",
            layout,
          );
          return { dir, rows };
        })
        .filter((x) => x.rows.count > 0),
    [sidesKey, verses, target.scope, target.value, mode, layout],
  );
  // What the neighbours' rows load per surah (passages, word meanings),
  // fetched as they mount (idle): the peek and the arrival then draw them
  // whole at once instead of filling in a moment later.
  const nearSurahs = [
    ...new Set(peeks.flatMap((x) => x.rows.verses.map((v) => v.s))),
  ].join();
  const groupedKey = groupedTafsirIds.join();
  const [, bumpPeeks] = useState(0);
  useEffect(() => {
    if (!nearSurahs) return;
    const list = nearSurahs.split(",").map(Number);
    const jobs: Promise<unknown>[] = [
      ...groupedKey
        .split(",")
        .filter(Boolean)
        .flatMap((id) =>
          list
            .filter((x) => !cachedGroupedTafsir(id, x))
            .map((x) => loadGroupedTafsir(id, x)),
        ),
      ...(p.showWords ? list.filter((x) => !wordsAt(x, 1)).map(loadSurahWords) : []),
    ];
    if (!jobs.length) return;
    let alive = true;
    void Promise.allSettled(jobs).then(() => alive && bumpPeeks((n) => n + 1));
    return () => {
      alive = false;
    };
    // `wordsAt` reads a module cache; the surahs and editions are the inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearSurahs, groupedKey, p.showWords]);
  // A window reached by stepping (← / →, the end-of-list buttons) slides in
  // from the side it lies on; any other jump just appears. A short offset,
  // not the full width: the list is still settling on its anchor. A swiped-to
  // window is already in place: it only opens at its top, in the same frame
  // as the pager drops its transform (both layout effects of this commit).
  useLayoutEffect(() => {
    const dir = arriveFrom.current;
    arriveFrom.current = 0;
    const swiped = swipedTo.current === scopeKey;
    swipedTo.current = "";
    if (swiped) {
      openedAtTop.current = true;
      quietScrollUntil.current = Date.now() + 700;
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      return;
    }
    if (!dir) return;
    const reduced = prefersReducedMotion();
    animateTo(
      slideRef.current,
      [
        { opacity: 0, transform: reduced ? "none" : `translateX(${dir * 48}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: reduced ? 120 : 240, easing: EASE_OUT },
    );
  }, [scopeKey, slideRef]);
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

  const openContext = useStableFn((id: number) => {
    setSelectedId(id);
    setWordPick(null);
    setAyahPick(null);
    setContextSheet(true);
  });

  const verseColor = useCallback(
    (v: Verse): string => surahColorById(v.s, colorMode, palette, surahMap, v.p),
    [colorMode, palette, surahMap],
  );

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
  const copyLink = useStableFn((v: Verse) =>
    copy(v, `https://quran.com/${v.s}/${v.a}`, "link"),
  );
  const copyText = useStableFn((v: Verse) => {
    const tr = translation.data?.[v.id];
    const trName = editionName;
    const name = surahMap.get(v.s)?.name ?? `${t.common.surah} ${v.s}`;
    const text = [v.ar, tr ? `${tr} (${trName})` : null, `— ${name} ${v.s}:${v.a}`]
      .filter(Boolean)
      .join("\n\n");
    copy(v, text, "text");
  });

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

  // The rows' inputs keep their identity between renders (memoised values,
  // stable handlers), so a scroll's re-render skips the rows already drawn.
  const notesPending = [edition, ...extraIds].map(footnotesPending).join();
  const translations = useMemo((): RowTranslation[] => {
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
    return [
      {
        ...column(
          edition,
          translation.data,
          translation.loading || footnotesPending(edition),
        ),
        notes: footnotes[edition],
      },
      ...extraIds.map((id, i) => ({
        ...column(
          id,
          extraTr[i]?.data ?? null,
          (extraTr[i]?.loading ?? true) || footnotesPending(id),
        ),
        notes: footnotes[id],
      })),
    ];
    // `notesPending` stands for footnotesPending's module state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editions,
    edition,
    translation.data,
    translation.loading,
    extraIds,
    extraTr,
    footnotes,
    notesPending,
  ]);
  const tafsirsFor = (groups: typeof tafsirGroups): RowTafsir[] =>
    shownTafsirs.map((ed) => {
      const ai = ayahTafsirIds.indexOf(ed.id);
      const grouped = groupedTafsirs.get(ed.id);
      const lookup = groups.get(ed.id);
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
  const shownTafsirKey = shownTafsirs.map((e) => e.id).join();
  const inlineTafsirs = useMemo(
    () => tafsirsFor(tafsirGroups),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shownTafsirKey, ayahTafsirs, groupedTafsirs, tafsirGroups, lang],
  );
  const recited = useMemo(
    () => (surahTimings ? { clock: rec.clock, timing: timingOf } : null),
    [surahTimings, rec.clock, timingOf],
  );
  const toggleAsbab = useCallback(
    (id: number) =>
      setOpenAsbab((cur) => {
        const next = new Set(cur);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const asbabSource = asbabState.data?.source ?? "";
  const inlineAsbab = useMemo(
    () =>
      p.showAsbab && asbabMap
        ? { byFirst: asbabMap, source: asbabSource, open: openAsbab, toggle: toggleAsbab }
        : null,
    [p.showAsbab, asbabMap, asbabSource, openAsbab, toggleAsbab],
  );
  const themeAt = useCallback(
    (id: number, prevId: number | null) =>
      p.showThemes && themes && themeIdx
        ? themeHeadingAt(themes, themeIdx, id, prevId)
        : null,
    [p.showThemes, themes, themeIdx],
  );
  const inEditedRange = useCallback(
    (id: number) => !!loopRange && id >= range.from && id <= range.to,
    [loopRange, range],
  );
  const openMark = useCallback(
    (id: number, kind: "pin" | "collection") => setMarkFor({ id, kind }),
    [],
  );

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
    wordsOf,
    onWord,
    mask,
    glossLang: p.glossLang,
    inlineTafsirs,
    search: searchHits,
    recited,
    inlineAsbab,
    themeAt,
    verseColor,
    audioOn,
    canPlay: !!reciter,
    playingId,
    inEditedRange,
    playAyah,
    marksAt,
    openMark,
    openHifdh: setHifdhFor,
    copied,
    copyText,
    copyLink,
    selectedId: highlightId,
    openContext,
    menuFor,
    setMenuFor,
  };

  // A swipe peek's rows: as the list will draw them on arrival (its passages
  // from the prefetched files, shown once all its surahs are in, as the list
  // does), without selection, recitation, search or edited-range highlight.
  const peekCtxOf = (w: WindowRows): RowContext => {
    const surahsOf = [...new Set(w.verses.map((v) => v.s))];
    return {
      ...rowCtx,
      inlineTafsirs: tafsirsFor(
        new Map(
          groupedTafsirIds.flatMap((id) => {
            const rows = surahsOf.map((x) => cachedGroupedTafsir(id, x));
            if (!rows.every(Boolean)) return [];
            const bySurah = new Map(surahsOf.map((x, i) => [x, rows[i]!]));
            return [[id, tafsirGroupLookup(w.verses, bySurah)] as const];
          }),
        ),
      ),
      search: null,
      recited: null,
      playingId: undefined,
      inEditedRange: () => false,
      selectedId: undefined,
      copied: null,
      menuFor: null,
    };
  };
  // One row of a window: the list's, or a swipe peek's (`peekCtx`, not live).
  const renderRow = (w: WindowRows, i: number, peekCtx?: RowContext) => {
    const live = !peekCtx;
    // Rows on screen (the virtualizer's range without its overscan), read as
    // the rows render: they re-render on their own while the list scrolls.
    const onScreen = rowVirtualizer.range;
    if (layout && w.layoutPages)
      return (
        <MushafLinesPage
          // A page mounted ahead, off screen, draws its words in steps:
          // spread over frames, not one long scroll frame. Before the list
          // knows what is on screen (its first render, before a jump to an
          // anchor), only the first page is drawn at once.
          deferred={
            live && (onScreen ? i < onScreen.startIndex || i > onScreen.endIndex : i > 0)
          }
          layout={layout}
          page={w.layoutPages[i]}
          verses={verses}
          surahMap={surahMap}
          wordCount={wordCount}
          scopeFrom={w.from}
          scopeTo={w.to}
          tajweed={p.showTajweed ? tajweedState.data : null}
          selectedId={!live ? undefined : contextSheet ? highlightId : ayahPick?.id}
          pickedWord={live ? (wordPick ?? wordDetail) : null}
          playingId={live && audioOn ? playingId : undefined}
          clock={rec.clock}
          timing={timingOf}
          audioRange={live && audioOn && loopRange ? range : null}
          glosses={p.showWords ? wordsOf : null}
          glossLang={p.glossLang}
          mask={mask}
          onWord={onWordHold}
          onAyah={onAyah}
        />
      );
    const page = w.pages?.[i];
    if (page)
      return (
        <MushafPage
          verses={page}
          surahMap={surahMap}
          tajweed={p.showTajweed ? tajweedState.data : null}
          selectedId={!live ? undefined : contextSheet ? highlightId : ayahPick?.id}
          playingId={live && audioOn ? playingId : undefined}
          mask={mask}
          onAyah={onAyah}
        />
      );
    return (
      <VerseRow
        v={w.verses[i]}
        prev={i > 0 ? w.verses[i - 1] : null}
        ctx={peekCtx ?? rowCtx}
      />
    );
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
    <div className="flex flex-col gap-5">
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
        <span className="text-eyebrow text-ink-muted">{t.reader.translations}</span>
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
            className="-mx-1 inline-flex min-h-9 items-center gap-1.5 self-start rounded-md px-1.5 text-sm font-medium text-illumination transition-colors hover:bg-surface-sunken touch:min-h-11"
          >
            <Plus size={15} aria-hidden /> {t.reader.addTranslation}
          </button>
        )}
      </div>
      <div className="flex flex-col">
        <p className="mb-1 text-eyebrow text-ink-subtle">{t.reader.display}</p>
        <Toggle
          checked={p.showTranslit}
          onChange={p.setShowTranslit}
          label={t.reader.transliteration}
        />
        <Toggle
          checked={p.showTafsir}
          onChange={p.setShowTafsir}
          label={t.reader.tafsir}
        />
        {p.showTafsir && (
          <div className="flex flex-col gap-1.5 pb-2">
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
                  onClick={() =>
                    p.setExtraTafsirs(p.extraTafsirs.filter((x) => x !== id))
                  }
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
                className="-mx-1 inline-flex min-h-9 items-center gap-1.5 self-start rounded-md px-1.5 text-sm font-medium text-illumination transition-colors hover:bg-surface-sunken touch:min-h-11"
              >
                <Plus size={15} aria-hidden /> {t.reader.addTafsir}
              </button>
            )}
          </div>
        )}
        {p.showTafsir &&
          pendingTafsirs.map((ed) => (
            <div key={ed.id} className="pb-2">
              <TafsirDownloadOffer ed={ed} dl={tafsirDl} />
            </div>
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
            className="-mx-1 inline-flex min-h-10 items-center justify-between gap-2 rounded-md px-1 text-left text-sm font-medium text-illumination transition-colors hover:bg-surface-sunken touch:min-h-11"
          >
            {t.reader.tajweedRules}
            <ArrowRight size={15} aria-hidden />
          </button>
        )}
        <div className="py-2">
          <Select<(typeof MUSHAF_LAYOUTS)[number]>
            label={t.reader.layout}
            value={p.mushafLayout}
            onChange={(l) => {
              p.setMushafLayout(l);
              if (mode !== "mushaf") p.setMode("mushaf");
            }}
            options={MUSHAF_LAYOUTS.map((l) => ({
              value: l,
              label: t.reader.layouts[l],
            }))}
          />
          {mode === "mushaf" && p.mushafLayout !== "flow" && (
            <p className="mt-1.5 text-xs text-ink-subtle">{t.reader.layoutNote}</p>
          )}
        </div>
        <Toggle checked={p.showWords} onChange={p.setShowWords} label={t.reader.wbw} />
        {p.showWords && (
          <div className="pb-2">
            <Select<GlossLang>
              value={p.glossLang}
              onChange={p.setGlossLang}
              label={t.reader.glossLang}
              options={[
                { value: "en", label: t.reader.glossEn },
                { value: "id", label: t.reader.glossId },
              ]}
            />
          </div>
        )}
        <Toggle
          checked={p.showThemes}
          onChange={p.setShowThemes}
          label={t.reader.themes}
        />
        <Toggle checked={p.showAsbab} onChange={p.setShowAsbab} label={t.reader.asbab} />
        <Toggle checked={p.hifdhOn} onChange={p.setHifdhOn} label={t.hifdh.mode} />
      </div>
      <div className="flex flex-col gap-3">
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
      </div>
      {loadError && (
        <p className="text-sm text-rubric" role="alert">
          {t.reader.failed(
            tajweedState.error
              ? t.reader.failedWhat.tajweed
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
              ? {
                  on: audio.showAudio,
                  toggle: () => audio.setShowAudio(!audio.showAudio),
                }
              : null
          }
          settingsOpen={settingsOpen}
          onSettingsOpen={setSettingsOpen}
          settings={settings}
        />

        {/* Hafalan mode is on: how much shows, cover again, leave the mode. */}
        {p.hifdhOn && (
          <div
            role="group"
            aria-label={t.hifdh.mode}
            className="flex items-center gap-0.5 border-b border-line bg-paper px-2 py-1"
          >
            <div className="min-w-0 flex-1">
              <SegmentedControl<HifdhLevel>
                ariaLabel={t.hifdh.show}
                value={p.hifdhLevel}
                onChange={p.setHifdhLevel}
                options={HIFDH_LEVELS.map((l) => ({
                  value: l,
                  label: t.hifdh.levels[l],
                }))}
              />
            </div>
            <QuietIconButton
              label={t.hifdh.hideAgain}
              disabled={revealed.size + peeked.size === 0}
              onClick={hideAgain}
            >
              <EyeOff size={18} />
            </QuietIconButton>
            <QuietIconButton
              label={t.hifdh.rate}
              aria-haspopup="dialog"
              disabled={ratePages.length === 0}
              onClick={() => setRating(true)}
            >
              <ClipboardCheck size={18} />
            </QuietIconButton>
            <QuietIconButton label={t.hifdh.off} onClick={() => p.setHifdhOn(false)}>
              <X size={18} />
            </QuietIconButton>
          </div>
        )}

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

      {/* The pager: its track slides the list and, beside it, the start of
          each neighbouring window (mounted when idle). Clipped, not hidden:
          nothing can scroll it sideways onto a neighbour. */}
      <div className="flex min-h-0 flex-1 touch-pan-y overflow-clip" {...pagerHandlers}>
        <div ref={slideRef} className="relative flex min-w-0 flex-1">
          {peeks.map(({ dir, rows: w }) => {
            const ctx = peekCtxOf(w);
            return (
              <ReaderPeek
                key={dir}
                dir={dir}
                rows={w}
                headH={headH}
                frozen={listScrolling}
                renderRow={(r, i) => renderRow(r, i, ctx)}
              />
            );
          })}
          <div
            ref={scrollRef}
            onScroll={onListScroll}
            // A stable gutter: the peeks lay out at the list's text width. The
            // opaque background lets the browser scroll the list on the GPU
            // even on low-DPI screens (otherwise every frame repainted it).
            className="min-w-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden bg-paper px-3 pb-4 pt-1 [scrollbar-gutter:stable]"
          >
            <div className="relative mx-auto max-w-4xl">
              <VirtualRows subscribe={onListChange} afterRender={pinToBottom}>
                {() => (
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
                      const v = layoutPages || pages ? undefined : filtered[vi.index];
                      return (
                        <div
                          key={vi.key}
                          data-ayah={v?.id}
                          ref={rowVirtualizer.measureElement}
                          data-index={vi.index}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${vi.start}px)`,
                            zIndex: v && menuFor === v.id ? 10 : undefined,
                          }}
                        >
                          {renderRow(rows, vi.index)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </VirtualRows>
              {!query.trim() &&
                count > 0 &&
                (prevTarget || nextTarget || nextRevealed) && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pb-4 pt-6">
                    {prevTarget && (
                      <Button
                        onClick={() => {
                          arriveFrom.current = -1;
                          onNavigate(prevTarget);
                        }}
                        icon={<ArrowLeft size={16} aria-hidden />}
                        className={END_NAV}
                      >
                        {t.reader.prev(t.scope[target.scope])}
                      </Button>
                    )}
                    {nextTarget && (
                      <Button
                        variant="primary"
                        onClick={() => {
                          arriveFrom.current = 1;
                          onNavigate(nextTarget);
                        }}
                        className={END_NAV}
                      >
                        {t.reader.continueTo(t.scope[target.scope], nextTarget.value)}
                        {target.scope === "surah" && surahMap.get(nextTarget.value)
                          ? ` · ${surahMap.get(nextTarget.value)!.name}`
                          : ""}
                        <ArrowRight size={16} aria-hidden />
                      </Button>
                    )}
                    {nextRevealed && (
                      <Button
                        onClick={() =>
                          onNavigate({ scope: "surah", value: nextRevealed.id })
                        }
                        className={END_NAV}
                      >
                        {t.reader.nextRevealed(nextRevealed.id, nextRevealed.name)}
                      </Button>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {audioOn && (
        <MiniPlayer
          rec={rec}
          verses={verses}
          reciter={reciterId}
          reciterName={reciterName}
          options={audio.audioOpts}
          onOptions={audio.setAudioOpts}
          range={range}
          onRange={editRange}
          roomy={width >= PLAYER_ROOMY_PX}
          onOpenOptions={openPlayerSheet}
          onLocate={goToPlaying}
          onClose={() => audio.setShowAudio(false)}
          download={downloadPrompt}
        />
      )}

      <Sheet
        open={contextSheet && !!selected}
        onClose={() => setContextSheet(false)}
        title={
          selected ? t.reader.contextFor(`${selected.s}:${selected.a}`) : t.reader.context
        }
        side="bottom"
        closeLabel={t.reader.closeContext}
      >
        {contextPanel()}
      </Sheet>

      {wordPick && verses[wordPick.id - 1] && (
        <WordPopover
          pick={wordPick}
          verse={verses[wordPick.id - 1]}
          info={wordsOf(wordPick.id)?.[wordPick.w]}
          loading={!wordsOf(wordPick.id)}
          glossLang={p.glossLang}
          canPlay={!!reciter}
          onMore={() => {
            setWordDetail({ id: wordPick.id, w: wordPick.w });
            setWordPick(null);
          }}
          onPlay={() => {
            setWordPick(null);
            playAyah(wordPick.id);
          }}
          onContext={() => openContext(wordPick.id)}
          onClose={() => setWordPick(null)}
        />
      )}

      {ayahPick && verses[ayahPick.id - 1] && (
        <AyahPopover
          pick={ayahPick}
          title={refOf(ayahPick.id)}
          text={translation.data?.[ayahPick.id]}
          loading={!translation.data && !translation.error}
          lang={editionByIdentifier(editions, edition)?.language ?? "en"}
          rtl={isRtl(editionByIdentifier(editions, edition)?.language ?? "en")}
          scale={p.translationScale}
          holdHint={!!layout}
          canPlay={!!reciter}
          onPlay={() => {
            setAyahPick(null);
            playAyah(ayahPick.id);
          }}
          onContext={() => openContext(ayahPick.id)}
          onHifdh={() => {
            setHifdhFor(ayahPick.id);
            setAyahPick(null);
          }}
          onClose={() => setAyahPick(null)}
        />
      )}

      <Sheet
        open={rating}
        onClose={() => setRating(false)}
        title={t.hifdh.rateTitle(n(ratePages.length))}
        side={phone ? "bottom" : "right"}
        closeLabel={t.common.close}
      >
        <ul className="flex flex-col gap-0.5 px-4 py-3">
          {RATINGS.map((r) => (
            <li key={r}>
              <button
                type="button"
                onClick={() => {
                  const now = Date.now();
                  onHifdh(rateReview(hifdh, ratePages, r, dayKey(new Date(now)), now));
                  appendReviews(
                    ratePages.map((p) => p.page),
                    gradeOf(r),
                    now,
                  );
                  setRating(false);
                  hideAgain();
                }}
                className="flex min-h-11 w-full flex-col justify-center rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken"
              >
                <span className="text-sm font-medium text-ink">{t.hifdh.ratings[r]}</span>
                <span className="text-xs text-ink-subtle">{t.hifdh.ratingHelp[r]}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={hifdhFor !== null}
        onClose={() => setHifdhFor(null)}
        title={hifdhFor !== null ? t.hifdh.markTitle(refOf(hifdhFor)) : ""}
        side={phone ? "bottom" : "right"}
        closeLabel={t.common.close}
      >
        {hifdhFor !== null && (
          <HifdhSheet
            ayah={hifdhFor}
            verses={verses}
            hifdh={hifdh}
            onHifdh={onHifdh}
            onDone={() => setHifdhFor(null)}
          />
        )}
      </Sheet>

      <Sheet
        open={!!wordDetail}
        onClose={() => setWordDetail(null)}
        title={t.word.title}
        side="bottom"
        closeLabel={t.common.close}
      >
        {wordDetail &&
          verses[wordDetail.id - 1] &&
          wordsOf(wordDetail.id)?.[wordDetail.w] && (
            <WordDetailPage
              key={`${wordDetail.id}:${wordDetail.w}`}
              verse={verses[wordDetail.id - 1]}
              w={wordDetail.w}
              info={wordsOf(wordDetail.id)![wordDetail.w]}
              verses={verses}
              surahMap={surahMap}
              onRead={(tg) => {
                setWordDetail(null);
                onNavigate(tg);
              }}
              onExplore={
                onExplore
                  ? (x) => {
                      setWordDetail(null);
                      onExplore(x);
                    }
                  : undefined
              }
            />
          )}
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
          reciter={reciter?.id ?? audio.reciterPref}
          onReciter={audio.setReciter}
          verses={verses}
          surahs={surahs}
          range={range}
          isDefaultRange={!loopRange}
          onRange={editRange}
          onResetRange={() => editRange(null)}
          options={audio.audioOpts}
          onOptions={audio.setAudioOpts}
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
              audio.setAudioOpts(was.options);
              audio.setReciter(was.reciter);
            }
            setPlayerSheet(false);
          }}
        />
      </Sheet>
    </section>
  );
}
