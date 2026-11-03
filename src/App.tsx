import { useEffect, useState, type CSSProperties } from "react";
import {
  BarChart3,
  BookOpen,
  Info,
  Languages,
  LayoutGrid,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";
import { useQuranData } from "./data/useQuranData";
import { usePersistentState } from "./lib/usePersistentState";
import { useTheme } from "./theme/ThemeContext";
import type { ColorMode, ReaderTarget } from "./components/charts/common";
import { READER_SCOPES, type ReaderScope } from "./components/charts/common";
import { Card, IconButton, SegmentedControl, Skeleton } from "./components/ui";
import { DashboardView } from "./views/DashboardView";
import { StructureView } from "./views/StructureView";
import { TranslationCompare } from "./components/panels/TranslationCompare";
import { ReaderModal } from "./components/panels/ReaderModal";
import { GlobalSearchModal } from "./components/panels/GlobalSearchModal";
import { SettingsModal, type ChartSettings } from "./components/panels/SettingsModal";

type View = "dashboard" | "structure" | "compare";

const VIEWS: View[] = ["dashboard", "structure", "compare"];
const SCOPES: readonly ReaderScope[] = READER_SCOPES;

/** Parse the URL hash into a view + optional reader target.
 *  Format: `#<view>` or `#<view>/r/<scope>/<value>[/<anchor>]`. */
function parseHash(): { view: View; reader: ReaderTarget | null } {
  const h = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
  if (!h) return { view: "dashboard", reader: null };
  const [viewPart, ...rest] = h.split("/r/");
  const view = (VIEWS as string[]).includes(viewPart) ? (viewPart as View) : "dashboard";
  const readerPart = rest.join("/r/");
  if (!readerPart) return { view, reader: null };
  const segs = readerPart.split("/");
  if (segs.length < 2) return { view, reader: null };
  const scope = SCOPES.includes(segs[0] as ReaderScope)
    ? (segs[0] as ReaderScope)
    : "surah";
  const value = Number(segs[1]);
  if (!Number.isFinite(value)) return { view, reader: null };
  const anchor = segs[2] !== undefined ? Number(segs[2]) : undefined;
  return {
    view,
    reader: { scope, value, anchor: Number.isFinite(anchor) ? anchor : undefined },
  };
}

/** Serialize a view + reader target back to the hash string (without leading #). */
function serializeHash(view: View, reader: ReaderTarget | null): string {
  if (!reader) return view;
  const anchor = reader.anchor !== undefined ? `/${reader.anchor}` : "";
  return `${view}/r/${reader.scope}/${reader.value}${anchor}`;
}

export default function App() {
  const { data, loading, error } = useQuranData();
  const theme = useTheme();
  const initial = parseHash();
  const [view, setViewState] = useState<View>(initial.view);
  const [reader, setReader] = useState<ReaderTarget | null>(initial.reader);
  const setView = (v: View) => {
    setViewState(v);
    if (typeof window !== "undefined") window.location.hash = serializeHash(v, reader);
  };
  // Sync view + reader with browser back/forward navigation.
  useEffect(() => {
    const onHash = () => {
      const p = parseHash();
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
    if (typeof window !== "undefined") window.location.hash = serializeHash(view, t);
  };
  const [colorMode] = usePersistentState<ColorMode>("qv.colorMode", "type");
  // Remembered across reader/compare opens.
  const [edition, setEdition] = useState("en.sahih");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settings, setSettings] = usePersistentState<ChartSettings>("qv.settings", {
    bucketSize: 5,
    extremesCount: 5,
    uiScale: 1.5,
  });
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

          <div className="flex items-center gap-2">
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
            <IconButton onClick={() => setSearchOpen(true)} aria-label="Search the Quran">
              <Search size={16} />
            </IconButton>
            <SegmentedControl<View>
              value={view}
              onChange={setView}
              ariaLabel="Main view"
              options={[
                { value: "dashboard", label: "Dashboard", icon: <BarChart3 size={15} /> },
                {
                  value: "structure",
                  label: "Structure",
                  icon: <LayoutGrid size={15} />,
                },
                { value: "compare", label: "Compare", icon: <Languages size={15} /> },
              ]}
            />
            <IconButton onClick={theme.toggleDark} aria-label="Toggle dark mode">
              {theme.dark ? <Sun size={16} /> : <Moon size={16} />}
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
          </Card>
        )}
        {data && view === "dashboard" && (
          <DashboardView data={data} settings={settings} onOpen={navigateReader} />
        )}
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
          onNavigate={navigateReader}
          onClose={() => navigateReader(null)}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettings={setSettings}
      />

      {data && (
        <GlobalSearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          verses={data.verses}
          surahs={data.surahs}
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
