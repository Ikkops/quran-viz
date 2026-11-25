import {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { loadQuranData, useQuranData } from "./data/useQuranData";
import { HomeView } from "./views/HomeView";
import { prefetchJson } from "./data/useLazyJson";
import { persisted, readPersisted, usePersistentState } from "./lib/usePersistentState";
import { useTheme } from "./theme/ThemeContext";
import type { ColorMode, ReaderTarget } from "./components/charts/common";
import { Card, Skeleton, cx } from "./components/ui";
import { BOOKMARKS_KEY } from "./lib/bookmarks";
import { HIFDH_KEY, emptyHifdh, sanitizeHifdh, type Hifdh } from "./lib/hifdh";
import {
  MARKS_KEY,
  initialMarks,
  markedAyahs,
  sanitizeMarks,
  type Marks,
} from "./lib/marks";
import {
  DEFAULT_LAST_READ_COUNT,
  LAST_READ_COUNTS,
  LAST_READ_KEY,
  recordRead,
  sanitizeLastRead,
  type ReadStretch,
} from "./lib/lastRead";
// Views, the reader and the dialogs load on first use (Recharts and the
// reader's parts stay out of the first download).
const viewChunk = {
  dashboard: () => import("./views/DashboardView"),
  structure: () => import("./views/StructureView"),
  // Home is where the app opens: in the first bundle (about 20 KB), so its
  // first render does not suspend for a chunk and draw a skeleton first.
  home: () => Promise.resolve({ HomeView }),
  activity: () => import("./views/ActivityView"),
  settings: () => import("./views/SettingsView"),
} satisfies Record<View, () => Promise<unknown>>;
const readerChunk = () => import("./components/reader/ReaderView");
const DashboardView = lazy(() =>
  viewChunk.dashboard().then((m) => ({ default: m.DashboardView })),
);
const StructureView = lazy(() =>
  viewChunk.structure().then((m) => ({ default: m.StructureView })),
);
const ActivityView = lazy(() =>
  viewChunk.activity().then((m) => ({ default: m.ActivityView })),
);
const SettingsView = lazy(() =>
  viewChunk.settings().then((m) => ({ default: m.SettingsView })),
);
/** The dashboard's chosen view (views/vizDefs.ts, kept out of this chunk). */
const VIZ_KEY = "qv.viz";
/** The Activity page's tab (views/ActivityView.tsx, kept out of this chunk). */
const ACTIVITY_TAB_KEY = "qv.activity.tab";
const ReaderView = lazy(() => readerChunk().then((m) => ({ default: m.ReaderView })));
import type { ExploreTarget } from "./components/reader/VerseContextPanel";
import type { ChartSettings } from "./views/SettingsView";
const GlobalSearchModal = lazy(() =>
  import("./components/panels/GlobalSearchModal").then((m) => ({
    default: m.GlobalSearchModal,
  })),
);
const AboutModal = lazy(() =>
  import("./components/panels/AboutModal").then((m) => ({ default: m.AboutModal })),
);
const Welcome = lazy(() =>
  import("./components/panels/Welcome").then((m) => ({ default: m.Welcome })),
);
import type { WelcomeChoice } from "./components/panels/Welcome";
import { parseHash, serializeHash, type View } from "./lib/hash";
import { shortcutFor } from "./lib/shortcuts";
import { effectiveUiScale, isWideLayout, useViewportWidth } from "./lib/uiScale";
import {
  BottomTabs,
  TAB_BAR_ROOM,
  TopBar,
  type NavProps,
} from "./components/shell/Navigation";
import { useI18n } from "./i18n/I18nContext";
import { searchEditionFor } from "./data/searchEdition";
import { loadTranslation } from "./data/useTranslation";
import { prefetchFootnotes } from "./data/footnotes";
import { installBackButton } from "./lib/androidBack";
import { useReadingTimer } from "./lib/readingStore";
import { useReminders } from "./lib/remindersNative";
import { RecitationProvider } from "./data/RecitationContext";
import { NowPlayingBar } from "./components/shell/NowPlayingBar";
import { preferredDivision, scopeField } from "./components/reader/readerShared";

/** Current hash, parsed. Dashboard params are kept when the reader opens or
 *  closes so a shared link reopens the same chart. */
const readHash = () =>
  parseHash(typeof window !== "undefined" ? window.location.hash : "");

/** What opening the reader needs: its code, the translation and its notes,
 *  and the tajweed colours when they are on. Each loads once. */
const warmReader = (edition: string) => {
  void readerChunk().catch(() => undefined);
  loadTranslation(edition).catch(() => undefined);
  prefetchFootnotes(edition);
  if (readPersisted("qv.reader.tajweed", false, persisted.bool))
    prefetchJson("tajweed.json");
};

/** Run `fn` when the main thread is idle (soon at the latest). */
const whenIdle = (fn: () => void) =>
  window.requestIdleCallback
    ? window.requestIdleCallback(fn, { timeout: 3000 })
    : window.setTimeout(fn, 200);

/** The other screens' code, one per idle moment, so a tab opens at once. */
const warmViews = () => {
  const rest = Object.values(viewChunk);
  const next = () => {
    const load = rest.shift();
    if (load)
      void load().then(
        () => whenIdle(next),
        () => whenIdle(next),
      );
  };
  whenIdle(next);
};

// Start-up: the core data and the first screen's code download now, beside
// React's first render, instead of one after the other (data, then the lazy
// view once the data is in); a reader link warms the reader at once.
if (typeof window !== "undefined") {
  const first = readHash();
  void loadQuranData().catch(() => undefined);
  void viewChunk[first.view]().catch(() => undefined);
  // A reader link: its code now, and in ayah view its translation (mushaf
  // pages show one only in a popup; the tajweed colours may follow the text).
  if (first.reader) {
    void readerChunk().catch(() => undefined);
    if (readPersisted<string>("qv.reader.mode", "ayah") !== "mushaf") {
      const edition = readPersisted("qv.edition", "en.sahih");
      loadTranslation(edition).catch(() => undefined);
      prefetchFootnotes(edition);
    }
  }
}

/** Set a persisted tab before the view that owns it mounts. */
const presetTab = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

export default function App() {
  const { data: loaded, loading, error } = useQuranData();
  const theme = useTheme();
  const { t, lang } = useI18n();
  // Surah names in the UI language's spelling (Al-Baqarah / Al-Baqarah,
  // Ya-Sin / Yasin, Ash-Sharh / Asy-Syarh).
  const data = useMemo(
    () =>
      loaded && {
        ...loaded,
        surahs: loaded.surahs.map((s) => ({
          ...s,
          name: lang === "id" ? s.nameId : s.nameEn,
        })),
      },
    [loaded, lang],
  );
  const initial = readHash();
  const [view, setViewState] = useState<View>(initial.view);
  const [reader, setReader] = useState<ReaderTarget | null>(initial.reader);
  // Each view remembers its scroll position: switching tabs and coming back
  // returns to the same card or chart. Recorded at the moment of switching
  // (not from scroll events, which background tabs and WebViews may skip).
  const scrollByView = useRef<Partial<Record<View, number>>>({});
  const viewRef = useRef(view);
  // The reader is a page over the current view (which stays mounted, hidden):
  // remember the view's scroll when it opens, restore it when it closes.
  const readerRef = useRef(reader); // the reader target, readable in handlers
  const scrollUnderReader = useRef(0);
  const readerShown = useRef(!!reader); // the reader has been committed
  const showReader = (t: ReaderTarget | null) => {
    if (t && !readerRef.current) scrollUnderReader.current = window.scrollY;
    readerRef.current = t;
    // Opening is a transition: the view under it stays up, with the tapped
    // row's highlight, until the reader is ready to paint.
    if (t && !readerShown.current) startTransition(() => setReader(t));
    else setReader(t);
  };
  const changeView = (v: View) => {
    if (v !== viewRef.current && !readerRef.current)
      scrollByView.current[viewRef.current] = window.scrollY;
    setViewState(v);
  };
  useLayoutEffect(() => {
    if (viewRef.current === view) return;
    viewRef.current = view;
    window.scrollTo(0, scrollByView.current[view] ?? 0);
  }, [view]);
  const isReading = !!reader;
  useLayoutEffect(() => {
    readerShown.current = isReading;
    window.scrollTo(0, isReading ? 0 : scrollUnderReader.current);
  }, [isReading]);
  // True while the history entry before this one is the view the reader was
  // opened from (opened in this session): closing then steps back, so the
  // Android back gesture doesn't land in the reader again.
  const openedHere = useRef(false);
  const setView = (v: View) => {
    openedHere.current = false;
    changeView(v);
    showReader(null);
    if (typeof window !== "undefined") window.location.hash = serializeHash(v, null);
    // (Leaving the dashboard drops its params; it writes them back on return.)
  };
  // Android back gesture: close a window, else history back, else exit.
  useEffect(() => installBackButton(), []);
  // Sync view + reader with browser back/forward navigation.
  useEffect(() => {
    const onHash = () => {
      const p = readHash();
      if (!p.reader) openedHere.current = false;
      changeView(p.view);
      showReader(p.reader);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Keep the URL in sync so ayahs are deep-linkable. Opening the reader adds a
  // history entry; moving inside it replaces that entry; closing steps back.
  const navigateReader = (t: ReaderTarget | null) => {
    const params = view === "dashboard" ? readHash().params : {};
    if (!t) {
      if (openedHere.current) {
        openedHere.current = false;
        window.history.back(); // hashchange closes it
        return;
      }
      showReader(null);
      window.history.replaceState(null, "", `#${serializeHash(view, null, params)}`);
      return;
    }
    const hash = serializeHash(view, t, params);
    if (readerRef.current) window.history.replaceState(null, "", `#${hash}`);
    else {
      openedHere.current = true;
      window.location.hash = hash;
    }
    showReader(t);
  };
  // Ayah context → root / topic explorer on the dashboard.
  const [dashKey, setDashKey] = useState(0);
  const explore = (x: ExploreTarget) => {
    const params: Record<string, string> =
      x.kind === "root"
        ? { v: "root-explorer", root: x.key }
        : { v: "topic-explorer", topic: x.key };
    openedHere.current = false;
    window.location.hash = serializeHash("dashboard", null, params);
    changeView("dashboard");
    showReader(null);
    setDashKey((k) => k + 1); // remount: it reads the link on mount
  };
  // Shared by the dashboard charts, reader badges and search results.
  const [colorMode, setColorMode] = usePersistentState<ColorMode>(
    "qv.colorMode",
    "type",
    persisted.oneOf(["type", "fawatih"] as const),
  );
  // Reader translation; remembered across reader opens and app restarts.
  const [storedEdition, setEdition] = usePersistentState("qv.edition", "en.sahih");
  // A stored edition may no longer exist after a data rebuild.
  const edition =
    data && !data.editions.editions.some((e) => e.identifier === storedEdition)
      ? data.editions.default
      : storedEdition;
  // Warm the reader once the first screen is up, so the first tap on a surah
  // opens it with its code, translation and notes already here; then the
  // other screens.
  useEffect(() => {
    const id = setTimeout(() => warmReader(edition), 1500);
    return () => clearTimeout(id);
  }, [edition]);
  useEffect(() => {
    const id = setTimeout(warmViews, 2500);
    return () => clearTimeout(id);
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  // Mounted from their first opening on (lazy chunks; state kept after closing).
  const [searchUsed, setSearchUsed] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutUsed, setAboutUsed] = useState(false);
  if (aboutOpen && !aboutUsed) setAboutUsed(true);
  // First run: shown once to a new learner (someone with a reading position or
  // settings has used the app before), and not over a shared deep link.
  const [welcomed, setWelcomed] = usePersistentState(
    "qv.welcome",
    readPersisted<unknown>("qv.lastRead", null) !== null ||
      readPersisted<unknown>(LAST_READ_KEY, null) !== null ||
      readPersisted<unknown>("qv.settings", null) !== null,
    persisted.bool,
  );
  const [deepLinked] = useState(
    () => typeof window !== "undefined" && window.location.hash.length > 1,
  );
  const [welcomeAgain, setWelcomeAgain] = useState(false);
  if (searchOpen && !searchUsed) setSearchUsed(true);
  // Query to open search with (word-cloud click); bumped key remounts the input.
  const [searchSeed, setSearchSeed] = useState<{ q: string; n: number }>({ q: "", n: 0 });
  const openSearch = (q = "") => {
    setSearchSeed((cur) => ({ q, n: cur.n + 1 }));
    setSearchOpen(true);
  };
  const [settings, setSettings] = usePersistentState<ChartSettings>("qv.settings", {
    bucketSize: 5,
    extremesCount: 5,
    uiScale: 1.5,
  });
  // Pins and collections. A first run names the defaults in the interface
  // language and takes over the old flat bookmarks.
  const [marks, setMarks] = usePersistentState<Marks>(
    MARKS_KEY,
    initialMarks(
      { pin: t.marks.defaultPin, collection: t.marks.defaultCollection },
      readPersisted<unknown>(BOOKMARKS_KEY, null),
    ),
    sanitizeMarks,
  );
  // What the learner has memorised, and the words they stumbled on.
  const [hifdh, setHifdh] = usePersistentState<Hifdh>(
    HIFDH_KEY,
    emptyHifdh(),
    sanitizeHifdh,
  );
  // Interface scale, capped on narrow screens (lib/uiScale.ts).
  const viewportWidth = useViewportWidth();
  const zoom = effectiveUiScale(settings.uiScale, viewportWidth);
  const wide = isWideLayout(viewportWidth, zoom);
  // App-wide keyboard shortcuts (see lib/shortcuts.ts).
  const modalOpen = searchOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.getAttribute("role") === "combobox" ||
          el.isContentEditable);
      const action = shortcutFor(e, typing, modalOpen);
      if (!action || !data) return;
      e.preventDefault();
      if (action.kind === "search") {
        setSearchSeed((cur) => ({ q: "", n: cur.n + 1 }));
        setSearchOpen(true);
      } else if (action.kind === "bookmarks") openMarks();
      else setView(action.view);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // setView only touches refs and state setters, so a stale copy is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, data]);
  // Where recent reading stopped (lib/lastRead.ts): the reader reports the
  // ayah on screen; Home lists the newest few.
  const [lastReads, setLastReads] = usePersistentState<ReadStretch[]>(
    LAST_READ_KEY,
    [],
    sanitizeLastRead,
  );
  const [lastReadCount, setLastReadCount] = usePersistentState<number>(
    "qv.lastRead.count",
    DEFAULT_LAST_READ_COUNT,
    (raw) =>
      (LAST_READ_COUNTS as readonly unknown[]).includes(raw)
        ? (raw as number)
        : undefined,
  );
  const noteRead = (id: number) => {
    const v = data?.verses[id - 1];
    if (v) setLastReads((list) => recordRead(list, id, v.s, Date.now()));
  };
  // The position from before the list existed starts it off.
  const [oldLastRead] = useState(() =>
    readPersisted<ReaderTarget | null>("qv.lastRead", null),
  );
  useEffect(() => {
    if (!data || lastReads.length || !oldLastRead) return;
    const key = {
      surah: "s",
      manzil: "manzil",
      juz: "juz",
      hizb: "hizb",
      rub: "rub",
      ruku: "ruku",
      page: "page",
    } as const;
    const id =
      oldLastRead.anchor ??
      data.verses.find((v) => v[key[oldLastRead.scope]] === oldLastRead.value)?.id;
    if (id) noteRead(id);
    // Once, when the data arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const openMarks = () => {
    presetTab(ACTIVITY_TAB_KEY, "marks");
    setActivityKey((k) => k + 1);
    setView("activity");
  };
  const [activityKey, setActivityKey] = useState(0);

  const openRead = () => {
    const top = lastReads[0];
    navigateReader(
      top
        ? { scope: "surah", value: top.s, anchor: top.id }
        : { scope: "surah", value: 1 },
    );
  };
  // The mini-player opens the reader at the recited ayah, in the division the
  // learner reads by (as Home's last-read cards do).
  const openPlaying = (id: number) => {
    const v = data?.verses[id - 1];
    if (!v) return;
    const d = preferredDivision();
    navigateReader({ scope: d, value: scopeField(v, d), anchor: id });
  };
  const showWelcome = !!data && ((!welcomed && !deepLinked && !reader) || welcomeAgain);
  const finishWelcome = (choice: WelcomeChoice) => {
    setWelcomed(true);
    setWelcomeAgain(false);
    if (choice === "read") openRead();
    else if (choice === "map") {
      presetTab(VIZ_KEY, "map");
      setDashKey((k) => k + 1);
      setView("dashboard");
    }
  };
  const reading = !!(data && reader);
  // Opened on a reader link: the view under the reader (shown when it closes)
  // waits until the reader is up, then draws in an idle moment; closing the
  // reader first draws it at once.
  const [viewUnderReader, setViewUnderReader] = useState(!initial.reader);
  useEffect(() => {
    if (!viewUnderReader && data)
      whenIdle(() => startTransition(() => setViewUnderReader(true)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);
  const showView = viewUnderReader || !reading;
  // Reading time (Home → Activity) counts while the reader is open.
  useReadingTimer(reading);
  useReminders(hifdh, data?.verses);
  const marked = useMemo(() => markedAyahs(marks), [marks]);
  const navProps: NavProps = {
    view,
    reading,
    onView: setView,
    onSearch: () => openSearch(),
    ready: !!data,
  };

  return (
    <RecitationProvider
      surahs={data?.surahs ?? []}
      verses={data?.verses ?? []}
      readerOpen={reading}
      onRead={noteRead}
    >
      <div
        id="app-root"
        className="min-h-[calc(100*var(--zvh))] bg-paper pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] font-ui text-ink"
        // `--zvh` is 1vh corrected for this zoom: use `calc(N*var(--zvh))` instead of
        // `Nvh` anywhere below, since CSS zoom multiplies `vh` lengths.
        style={
          {
            zoom,
            "--zvh": `calc(1vh / ${zoom})`,
          } as CSSProperties
        }
      >
        <div
          className={cx(
            "min-w-0",
            // Views fill the screen down to the tab bar, so a pager's swipe
            // area reaches the bottom (not while reading: <main> is hidden).
            !reading && "flex min-h-[calc(100*var(--zvh))] flex-col",
          )}
        >
          {!reading && <TopBar {...navProps} />}
          {data && reader && (
            <Suspense fallback={<ReaderSkeleton />}>
              <ReaderView
                target={reader}
                surahs={data.surahs}
                verses={data.verses}
                editions={data.editions}
                edition={edition}
                onEditionChange={setEdition}
                colorMode={colorMode}
                palette={theme.palette}
                arabicScale={theme.arabicScale}
                onArabicScale={theme.setArabicScale}
                onNavigate={navigateReader}
                onClose={() => navigateReader(null)}
                marks={marks}
                onMarks={setMarks}
                hifdh={hifdh}
                onHifdh={setHifdh}
                onRead={noteRead}
                onExplore={explore}
                phone={!wide}
                dark={theme.dark}
              />
            </Suspense>
          )}
          <main
            hidden={reading}
            className={cx(
              "mx-auto max-w-7xl px-4 pt-5",
              TAB_BAR_ROOM,
              !reading && "flex w-full flex-1 flex-col",
            )}
          >
            {loading && <LoadingSkeleton />}
            {error && (
              <Card className="p-6 text-center text-sm">
                <p role="alert" className="font-medium text-rubric">
                  {t.app.failedData}
                </p>
                <p className="mt-2 text-ink-muted">{t.app.failedDataHelp}</p>
                <p className="mt-1 text-xs text-ink-subtle">{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-3 min-h-10 touch:min-h-11 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface-sunken"
                >
                  {t.common.retry}
                </button>
              </Card>
            )}
            <Suspense fallback={<LoadingSkeleton />}>
              {data && showView && view === "home" && (
                <HomeView
                  data={data}
                  lastReads={lastReads.slice(0, lastReadCount)}
                  onOpen={navigateReader}
                  onSearch={() => openSearch()}
                  onActivity={() => setView("activity")}
                  hifdh={hifdh}
                  marks={marks}
                  onHifdhPlan={() => {
                    presetTab(ACTIVITY_TAB_KEY, "hifdh");
                    setActivityKey((k) => k + 1);
                    setView("activity");
                  }}
                />
              )}
              {data && showView && view === "dashboard" && (
                <DashboardView
                  key={dashKey}
                  data={data}
                  settings={settings}
                  colorMode={colorMode}
                  onColorMode={setColorMode}
                  onOpen={navigateReader}
                  onSearch={openSearch}
                  lastRead={lastReads[0]?.id}
                  marked={marked}
                  hifdh={hifdh}
                  onExplore={explore}
                />
              )}
              {data && showView && view === "structure" && (
                <StructureView data={data} onOpen={navigateReader} />
              )}
              {data && showView && view === "activity" && (
                <ActivityView
                  key={activityKey}
                  data={data}
                  marks={marks}
                  onMarks={setMarks}
                  hifdh={hifdh}
                  onHifdh={setHifdh}
                  onOpen={navigateReader}
                  lastRead={lastReads[0]?.id}
                />
              )}
              {showView && view === "settings" && (
                <SettingsView
                  surahs={data?.surahs ?? []}
                  settings={settings}
                  onSettings={setSettings}
                  lastReadCount={lastReadCount}
                  onLastReadCount={setLastReadCount}
                  onAbout={() => setAboutOpen(true)}
                  onWelcome={() => setWelcomeAgain(true)}
                />
              )}
            </Suspense>
            {data && (
              <NowPlayingBar
                surahs={data.surahs}
                verses={data.verses}
                onOpen={openPlaying}
              />
            )}
          </main>
        </div>
        {!reading && <BottomTabs {...navProps} />}

        <Suspense fallback={null}>
          {data && showWelcome && (
            <Welcome
              open
              onDone={finishWelcome}
              editions={data.editions.editions}
              edition={edition}
              onEdition={setEdition}
              onAbout={() => setAboutOpen(true)}
            />
          )}

          {aboutUsed && (
            <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
          )}

          {data && searchUsed && (
            <GlobalSearchModal
              key={searchSeed.n}
              initialQuery={searchSeed.q}
              editionId={edition}
              latinEditionId={searchEditionFor(lang, edition, data.editions.editions)}
              open={searchOpen}
              onClose={() => setSearchOpen(false)}
              verses={data.verses}
              surahs={data.surahs}
              colorMode={colorMode}
              palette={theme.palette}
              onOpenReader={navigateReader}
            />
          )}
        </Suspense>
      </div>
    </RecitationProvider>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 pt-5">
      <Skeleton className="h-24" />
      <Skeleton className="h-[calc(60*var(--zvh))]" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Skeleton className="h-80" />
      <Skeleton className="h-[calc(60*var(--zvh))]" />
    </div>
  );
}
