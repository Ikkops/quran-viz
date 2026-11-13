import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useQuranData } from "./data/useQuranData";
import { persisted, readPersisted, usePersistentState } from "./lib/usePersistentState";
import { useTheme } from "./theme/ThemeContext";
import type { ColorMode, ReaderTarget } from "./components/charts/common";
import { Card, Skeleton } from "./components/ui";
import { BOOKMARKS_KEY } from "./lib/bookmarks";
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
const DashboardView = lazy(() =>
  import("./views/DashboardView").then((m) => ({ default: m.DashboardView })),
);
const StructureView = lazy(() =>
  import("./views/StructureView").then((m) => ({ default: m.StructureView })),
);
const HomeView = lazy(() =>
  import("./views/HomeView").then((m) => ({ default: m.HomeView })),
);
const ActivityView = lazy(() =>
  import("./views/ActivityView").then((m) => ({ default: m.ActivityView })),
);
const SettingsView = lazy(() =>
  import("./views/SettingsView").then((m) => ({ default: m.SettingsView })),
);
import { DashboardPage, DASHBOARD_TAB_KEY } from "./views/DashboardPage";
/** The Activity page's tab (views/ActivityView.tsx, kept out of this chunk). */
const ACTIVITY_TAB_KEY = "qv.activity.tab";
const ReaderView = lazy(() =>
  import("./components/reader/ReaderView").then((m) => ({ default: m.ReaderView })),
);
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
import { BottomTabs, TopBar, type NavProps } from "./components/shell/Navigation";
import { useI18n } from "./i18n/I18nContext";
import { searchEditionFor } from "./data/searchEdition";
import { installBackButton } from "./lib/androidBack";
import { useReadingTimer } from "./lib/readingStore";

/** Current hash, parsed. Dashboard params are kept when the reader opens or
 *  closes so a shared link reopens the same chart. */
const readHash = () =>
  parseHash(typeof window !== "undefined" ? window.location.hash : "");

/** Set a persisted tab before the view that owns it mounts. */
const presetTab = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

export default function App() {
  const { data, loading, error } = useQuranData();
  const theme = useTheme();
  const { t, lang } = useI18n();
  const initial = readHash();
  // An old `#browse` (Map) link opens the dashboard on its Map tab.
  useState(() => {
    if (initial.params.tab === "map") presetTab(DASHBOARD_TAB_KEY, "map");
  });
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
  const showReader = (t: ReaderTarget | null) => {
    if (t && !readerRef.current) scrollUnderReader.current = window.scrollY;
    readerRef.current = t;
    setReader(t);
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
    presetTab(DASHBOARD_TAB_KEY, "charts");
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
  const showWelcome = !!data && ((!welcomed && !deepLinked && !reader) || welcomeAgain);
  const finishWelcome = (choice: WelcomeChoice) => {
    setWelcomed(true);
    setWelcomeAgain(false);
    if (choice === "read") openRead();
    else if (choice === "map") {
      presetTab(DASHBOARD_TAB_KEY, "map");
      setView("dashboard");
    }
  };
  const reading = !!(data && reader);
  // Reading time (Home → Activity) counts while the reader is open.
  useReadingTimer(reading);
  const marked = useMemo(() => markedAyahs(marks), [marks]);
  const navProps: NavProps = {
    view,
    reading,
    onView: setView,
    onSearch: () => openSearch(),
    ready: !!data,
  };

  return (
    <div
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
      <div className="min-w-0">
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
              onRead={noteRead}
              onExplore={explore}
              phone={!wide}
              dark={theme.dark}
            />
          </Suspense>
        )}
        <main
          hidden={reading}
          className="mx-auto max-w-7xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5"
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
            {data && view === "home" && (
              <HomeView
                data={data}
                lastReads={lastReads.slice(0, lastReadCount)}
                onOpen={navigateReader}
                onSearch={() => openSearch()}
                onActivity={() => setView("activity")}
              />
            )}
            {data && view === "dashboard" && (
              <DashboardPage
                data={data}
                lastRead={lastReads[0]?.id}
                marked={marked}
                onOpen={navigateReader}
                onExplore={explore}
                charts={
                  <DashboardView
                    key={dashKey}
                    data={data}
                    settings={settings}
                    colorMode={colorMode}
                    onColorMode={setColorMode}
                    onOpen={navigateReader}
                    onSearch={openSearch}
                  />
                }
              />
            )}
            {data && view === "structure" && (
              <StructureView data={data} onOpen={navigateReader} />
            )}
            {data && view === "activity" && (
              <ActivityView
                key={activityKey}
                data={data}
                marks={marks}
                onMarks={setMarks}
                onOpen={navigateReader}
              />
            )}
            {view === "settings" && (
              <SettingsView
                settings={settings}
                onSettings={setSettings}
                lastReadCount={lastReadCount}
                onLastReadCount={setLastReadCount}
                onAbout={() => setAboutOpen(true)}
                onWelcome={() => setWelcomeAgain(true)}
              />
            )}
          </Suspense>
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

        {aboutUsed && <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />}

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
