import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  BarChart3,
  Bookmark as BookmarkIcon,
  BookOpen,
  Info,
  Keyboard,
  Languages,
  Layers,
  LayoutGrid,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";
import { useQuranData } from "./data/useQuranData";
import { persisted, usePersistentState } from "./lib/usePersistentState";
import { useTheme } from "./theme/ThemeContext";
import type { ColorMode, ReaderTarget } from "./components/charts/common";
import {
  Card,
  IconButton,
  Modal,
  ModalHeader,
  SegmentedControl,
  Skeleton,
} from "./components/ui";
import { BookmarkList } from "./components/panels/BookmarkList";
import { surahMapOf } from "./data/selectors";
import {
  BOOKMARKS_KEY,
  sanitizeBookmarks,
  toggleBookmark,
  type Bookmark,
} from "./lib/bookmarks";
import { DashboardView } from "./views/DashboardView";
import { StructureView } from "./views/StructureView";
import { BrowseView } from "./views/BrowseView";
import { TranslationCompare } from "./components/panels/TranslationCompare";
import { ReaderModal } from "./components/panels/ReaderModal";
import { GlobalSearchModal } from "./components/panels/GlobalSearchModal";
import { SettingsModal, type ChartSettings } from "./components/panels/SettingsModal";
import { parseHash, serializeHash, type View } from "./lib/hash";
import { SHORTCUTS, shortcutFor } from "./lib/shortcuts";

/** Current hash, parsed. Dashboard params are kept when the reader opens or
 *  closes so a shared link reopens the same chart. */
const readHash = () =>
  parseHash(typeof window !== "undefined" ? window.location.hash : "");

export default function App() {
  const { data, loading, error } = useQuranData();
  const theme = useTheme();
  const initial = readHash();
  const [view, setViewState] = useState<View>(initial.view);
  const [reader, setReader] = useState<ReaderTarget | null>(initial.reader);
  const setView = (v: View) => {
    setViewState(v);
    if (typeof window !== "undefined") window.location.hash = serializeHash(v, reader);
    // (Leaving the dashboard drops its params; it writes them back on return.)
  };
  // Sync view + reader with browser back/forward navigation.
  useEffect(() => {
    const onHash = () => {
      const p = readHash();
      setViewState(p.view);
      setReader(p.reader);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Keep the URL in sync when the reader opens / navigates / closes so verses
  // are deep-linkable and shareable.
  const navigateReader = (t: ReaderTarget | null) => {
    setReader(t);
    if (t) setLastRead(t);
    if (typeof window !== "undefined")
      window.location.hash = serializeHash(
        view,
        t,
        view === "dashboard" ? readHash().params : {},
      );
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [bookmarks, setBookmarks] = usePersistentState<Bookmark[]>(
    BOOKMARKS_KEY,
    [],
    sanitizeBookmarks,
  );
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // App-wide keyboard shortcuts (see lib/shortcuts.ts).
  const modalOpen = !!reader || searchOpen || settingsOpen || bookmarksOpen || helpOpen;
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
      } else if (action.kind === "bookmarks") setBookmarksOpen(true);
      else if (action.kind === "help") setHelpOpen(true);
      else {
        setViewState(action.view);
        window.location.hash = serializeHash(action.view, null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, data]);
  const surahMap = useMemo(() => (data ? surahMapOf(data.surahs) : new Map()), [data]);
  // Last-read position for the "Resume" button.
  const [lastRead, setLastRead] = usePersistentState<ReaderTarget | null>(
    "qv.lastRead",
    null,
  );

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
      // `--zvh` is 1vh corrected for this zoom: use `calc(N*var(--zvh))` instead of
      // `Nvh` anywhere below, since CSS zoom multiplies `vh` lengths.
      style={
        {
          zoom: settings.uiScale,
          "--zvh": `calc(1vh / ${settings.uiScale})`,
        } as CSSProperties
      }
    >
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">
                Quran — Data Visualization
              </h1>
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                {data ? (
                  <>
                    {`${data.meta.totals.surahs} surahs · ${data.meta.totals.ayahs.toLocaleString()} verses · ${data.meta.totals.words.toLocaleString()} words`}
                    <span
                      className="cursor-help"
                      aria-label="About these counts"
                      title={
                        "Word and letter counts are computed from the Uthmani digital text " +
                        "(words = whitespace tokens; letters = Arabic letters after stripping " +
                        "diacritics), excluding the basmala prefixed to each surah. They therefore " +
                        "differ from classical scholarly figures (~77,439 words / ~323,671 letters), " +
                        "which use traditional counting conventions and themselves vary by source. " +
                        "Both are shown side by side in Structure → Overview."
                      }
                    >
                      <Info size={12} className="text-slate-400" />
                    </span>
                  </>
                ) : (
                  "Loading dataset…"
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {lastRead && !reader && data && (
              <button
                onClick={() => navigateReader(lastRead)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title={`Resume at ${lastRead.scope} ${lastRead.value}`}
              >
                <BookOpen size={15} />
                Resume
              </button>
            )}
            {data && (
              <IconButton
                onClick={() => setBookmarksOpen(true)}
                aria-label={`Bookmarks (${bookmarks.length})`}
                title={`Bookmarks (${bookmarks.length})`}
              >
                <BookmarkIcon size={16} />
              </IconButton>
            )}
            <IconButton onClick={() => openSearch()} aria-label="Search the Quran">
              <Search size={16} />
            </IconButton>
            <SegmentedControl<View>
              value={view}
              onChange={setView}
              ariaLabel="Main view"
              options={[
                { value: "dashboard", label: "Dashboard", icon: <BarChart3 size={15} /> },
                { value: "browse", label: "Browse", icon: <LayoutGrid size={15} /> },
                {
                  value: "structure",
                  label: "Structure",
                  icon: <Layers size={15} />,
                },
                { value: "compare", label: "Compare", icon: <Languages size={15} /> },
              ]}
            />
            <IconButton onClick={theme.toggleDark} aria-label="Toggle dark mode">
              {theme.dark ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
            <IconButton
              onClick={() => setHelpOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard size={16} />
            </IconButton>
            <IconButton onClick={() => setSettingsOpen(true)} aria-label="Settings">
              <SettingsIcon size={16} />
            </IconButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {loading && <LoadingSkeleton />}
        {error && (
          <Card className="p-6 text-center text-sm text-red-500">
            Failed to load data: {error}
            <p className="mt-2 text-slate-400">
              Did you run <code>npm run build:data</code>?
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Retry
            </button>
          </Card>
        )}
        {data && view === "dashboard" && (
          <DashboardView
            data={data}
            settings={settings}
            colorMode={colorMode}
            onColorMode={setColorMode}
            onOpen={navigateReader}
            onSearch={openSearch}
          />
        )}
        {data && view === "browse" && <BrowseView data={data} onOpen={navigateReader} />}
        {data && view === "structure" && (
          <StructureView data={data} onOpen={navigateReader} />
        )}
        {data && view === "compare" && (
          <div className="h-[calc(78*var(--zvh))]">
            <TranslationCompare
              surahs={data.surahs}
              verses={data.verses}
              editions={data.editions}
              primary={theme.primary}
            />
          </div>
        )}
      </main>

      {data && reader && (
        <ReaderModal
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
          bookmarks={bookmarks}
          onBookmarks={setBookmarks}
        />
      )}

      {data && (
        <Modal
          open={bookmarksOpen}
          onClose={() => setBookmarksOpen(false)}
          className="max-w-lg"
          ariaLabel="Bookmarks"
        >
          <ModalHeader
            title={`Bookmarks (${bookmarks.length})`}
            onClose={() => setBookmarksOpen(false)}
          />
          <div className="max-h-[calc(60*var(--zvh))] overflow-y-auto px-4 py-2">
            <BookmarkList
              bookmarks={bookmarks}
              verses={data.verses}
              surahMap={surahMap}
              onOpen={(t) => {
                setBookmarksOpen(false);
                navigateReader(t);
              }}
              onRemove={(id) => setBookmarks((b) => toggleBookmark(b, id))}
            />
          </div>
        </Modal>
      )}

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        className="max-w-md"
        ariaLabel="Keyboard shortcuts"
      >
        <ModalHeader title="Keyboard shortcuts" onClose={() => setHelpOpen(false)} />
        <table className="m-4 w-[calc(100%-2rem)] text-sm">
          <tbody>
            {SHORTCUTS.map((sc) => (
              <tr
                key={sc.keys}
                className="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
              >
                <td className="whitespace-nowrap py-1.5 pr-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                  {sc.keys}
                </td>
                <td className="py-1.5 text-slate-700 dark:text-slate-200">{sc.does}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettings={setSettings}
      />

      {data && (
        <GlobalSearchModal
          key={searchSeed.n}
          initialQuery={searchSeed.q}
          editionId={edition}
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          verses={data.verses}
          surahs={data.surahs}
          colorMode={colorMode}
          palette={theme.palette}
          onOpenReader={navigateReader}
        />
      )}
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
