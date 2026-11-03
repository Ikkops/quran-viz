import { useMemo, useRef } from "react";
import { Download } from "lucide-react";
import type { QuranData } from "../types/quran";
import {
  aggregateBySurah,
  DEFAULT_FILTER,
  filterVerses,
  surahMapOf,
  type FilterState,
} from "../data/selectors";
import { wordFrequency } from "../data/arabic";
import { useTranslation } from "../data/useTranslation";
import { usePersistentState } from "../lib/usePersistentState";
import { useTheme } from "../theme/ThemeContext";
import { exportElementToPng } from "../lib/export";
import { Card, IconButton, SectionTitle } from "../components/ui";
import { ControlPanel, type VizOption } from "../components/controls/ControlPanel";
import type { ChartContext, ColorMode, ReaderTarget } from "../components/charts/common";
import { SurahBarChart } from "../components/charts/SurahBarChart";
import { CorrelationScatter } from "../components/charts/CorrelationScatter";
import { OpeningCategories } from "../components/charts/OpeningCategories";
import { BoxPlots } from "../components/charts/BoxPlots";
import { LengthHistogram } from "../components/charts/LengthHistogram";
import { WordCloud } from "../components/charts/WordCloud";
import { ExtremesPanel } from "../components/charts/ExtremesPanel";
import { RootChart } from "../components/charts/RootChart";
import { PosChart } from "../components/charts/PosChart";
import { Legend } from "../components/charts/Legend";
import { useMorphology } from "../data/useMorphology";
import { useRoots } from "../data/useRoots";
import { RootExplorer } from "../components/charts/RootExplorer";
import { useTopics } from "../data/useTopics";
import { TopicExplorer } from "../components/charts/TopicExplorer";
import type { ChartSettings } from "../components/panels/SettingsModal";

const VIZ_OPTIONS: VizOption[] = [
  { value: "words", label: "Words per surah", group: "Per surah" },
  { value: "letters", label: "Letters per surah", group: "Per surah" },
  { value: "verses", label: "Verses per surah", group: "Per surah" },
  { value: "avg", label: "Avg words / verse", group: "Per surah" },
  { value: "correlation", label: "Words vs verses (scatter)", group: "Relationships" },
  { value: "opening", label: "Opening categories", group: "Relationships" },
  { value: "histogram", label: "Verse-length distribution", group: "Verse level" },
  { value: "boxplots", label: "Verse-length box plots", group: "Verse level" },
  { value: "extremes", label: "Longest & shortest verses", group: "Verse level" },
  { value: "cloud-ar", label: "Arabic word cloud", group: "Text" },
  { value: "cloud-en", label: "English word cloud", group: "Text" },
  { value: "roots", label: "Most frequent roots", group: "Morphology" },
  { value: "root-explorer", label: "Root explorer", group: "Morphology" },
  { value: "pos", label: "Part-of-speech mix", group: "Morphology" },
  { value: "topic-explorer", label: "Topic explorer", group: "Topics" },
];

const LAYOUT_VIZ = new Set(["words", "letters", "verses", "avg"]);
const COLORMODE_VIZ = new Set(["words", "letters", "verses", "avg", "correlation"]);
const VIZ_LABEL = Object.fromEntries(VIZ_OPTIONS.map((o) => [o.value, o.label]));
const VIZ_VALUES = new Set(VIZ_OPTIONS.map((o) => o.value));

export function DashboardView({
  data,
  settings,
  onOpen,
}: {
  data: QuranData;
  settings: ChartSettings;
  onOpen: (t: ReaderTarget) => void;
}) {
  const theme = useTheme();
  const [vizRaw, setViz] = usePersistentState("qv.viz", "words");
  // A previously-persisted viz may have been removed; fall back to "words".
  const viz = VIZ_VALUES.has(vizRaw) ? vizRaw : "words";
  const [filter, setFilter] = usePersistentState<FilterState>(
    "qv.filter",
    DEFAULT_FILTER,
  );
  const [colorMode, setColorMode] = usePersistentState<ColorMode>("qv.colorMode", "type");
  const [horizontal, setHorizontal] = usePersistentState("qv.horizontal", false);
  const [activeKeys, setActiveKeys] = usePersistentState<string[]>("qv.activeKeys", []);
  const chartRef = useRef<HTMLDivElement>(null);

  // Switching colour mode invalidates the legend selection (the keys differ).
  const changeColorMode = (m: ColorMode) => {
    setColorMode(m);
    setActiveKeys([]);
  };
  const toggleKey = (k: string) =>
    setActiveKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const reset = () => {
    setViz("words");
    setFilter(DEFAULT_FILTER);
    setColorMode("type");
    setHorizontal(false);
    setActiveKeys([]);
  };

  const surahMap = useMemo(() => surahMapOf(data.surahs), [data.surahs]);
  const filteredVerses = useMemo(
    () => filterVerses(data.verses, filter),
    [data.verses, filter],
  );
  const surahData = useMemo(
    () => aggregateBySurah(filteredVerses, surahMap, filter.sort),
    [filteredVerses, surahMap, filter.sort],
  );
  const order = useMemo(() => surahData.map((d) => d.id), [surahData]);

  const activeKeySet = useMemo(() => new Set(activeKeys), [activeKeys]);
  const ctx: ChartContext = useMemo(
    () => ({
      palette: theme.palette,
      primary: theme.primary,
      colorMode,
      dark: theme.dark,
      activeKeys: activeKeySet,
      onOpen,
      onSelectSurah: (id) => onOpen({ scope: "surah", value: id }),
    }),
    [theme.palette, theme.primary, theme.dark, colorMode, activeKeySet, onOpen],
  );

  // Word clouds
  const arabicCloud = useMemo(
    () =>
      viz === "cloud-ar"
        ? wordFrequency(
            filteredVerses.map((v) => v.ar),
            { arabic: true },
          )
        : [],
    [viz, filteredVerses],
  );
  const englishEdition = useTranslation(
    viz === "cloud-en" ? data.editions.default : null,
  );
  const englishCloud = useMemo(() => {
    if (viz !== "cloud-en" || !englishEdition.data) return [];
    return wordFrequency(
      filteredVerses.map((v) => englishEdition.data![v.id] ?? ""),
      { arabic: false },
    );
  }, [viz, filteredVerses, englishEdition.data]);

  // Morphology aggregate (corpus roots + POS), lazy-loaded only for its views.
  const morphState = useMorphology(viz === "roots" || viz === "pos");
  const morph = morphState.data;
  const rootsState = useRoots(viz === "root-explorer");
  const topicsState = useTopics(viz === "topic-explorer");

  const handleExport = async () => {
    if (chartRef.current)
      await exportElementToPng(chartRef.current, `quran-${viz}`, theme.dark);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit p-4">
        <ControlPanel
          vizOptions={VIZ_OPTIONS}
          viz={viz}
          onViz={setViz}
          surahs={data.surahs}
          filter={filter}
          onFilter={setFilter}
          colorMode={colorMode}
          onColorMode={changeColorMode}
          horizontal={horizontal}
          onHorizontal={setHorizontal}
          supportsLayout={LAYOUT_VIZ.has(viz)}
          supportsColorMode={COLORMODE_VIZ.has(viz)}
          onReset={reset}
        />
      </Card>

      <Card className="p-4">
        <SectionTitle
          title={VIZ_LABEL[viz]}
          subtitle={
            viz === "roots" || viz === "pos"
              ? morph
                ? `${morph.distinctRoots.toLocaleString()} distinct roots · ${morph.totalSegments.toLocaleString()} morphological segments · Quranic Arabic Corpus`
                : "Loading the Quranic Arabic Corpus…"
              : viz === "root-explorer"
                ? `${surahData.length} surahs · ${filteredVerses.length.toLocaleString()} verses · Quranic Arabic Corpus roots`
                : viz === "topic-explorer"
                  ? `${surahData.length} surahs · ${filteredVerses.length.toLocaleString()} verses · ${topicsState.data?.length.toLocaleString() ?? "…"} QUL topics`
                  : `${surahData.length} surahs · ${filteredVerses.length.toLocaleString()} verses · drag the chart's corner to resize`
          }
          right={
            <IconButton onClick={handleExport}>
              <Download size={15} /> PNG
            </IconButton>
          }
        />
        <div className="h-[calc(60*var(--zvh))] max-h-[calc(88*var(--zvh))] min-h-[360px] w-full resize-y overflow-hidden rounded-xl">
          <div ref={chartRef} className="h-full w-full">
            {renderChart()}
          </div>
        </div>
        {COLORMODE_VIZ.has(viz) && (
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700/60">
            <Legend
              colorMode={colorMode}
              pie={theme.palette.pie}
              activeKeys={activeKeySet}
              onToggle={toggleKey}
            />
          </div>
        )}
      </Card>
    </div>
  );

  function renderChart() {
    switch (viz) {
      case "words":
        return (
          <SurahBarChart
            data={surahData}
            metric="wordCount"
            horizontal={horizontal}
            ctx={ctx}
          />
        );
      case "letters":
        return (
          <SurahBarChart
            data={surahData}
            metric="letterCount"
            horizontal={horizontal}
            ctx={ctx}
          />
        );
      case "verses":
        return (
          <SurahBarChart
            data={surahData}
            metric="ayahCount"
            horizontal={horizontal}
            ctx={ctx}
          />
        );
      case "avg":
        return (
          <SurahBarChart
            data={surahData}
            metric="avgWords"
            horizontal={horizontal}
            ctx={ctx}
          />
        );
      case "correlation":
        return <CorrelationScatter data={surahData} ctx={ctx} />;
      case "opening":
        return <OpeningCategories data={surahData} ctx={ctx} />;
      case "histogram":
        return (
          <LengthHistogram
            verses={filteredVerses}
            bucketSize={settings.bucketSize}
            ctx={ctx}
          />
        );
      case "boxplots":
        return (
          <BoxPlots verses={filteredVerses} order={order} surahMap={surahMap} ctx={ctx} />
        );
      case "extremes":
        return (
          <ExtremesPanel
            verses={filteredVerses}
            count={settings.extremesCount}
            surahMap={surahMap}
            ctx={ctx}
          />
        );
      case "roots":
        return morph ? (
          <RootChart roots={morph.roots} primary={theme.primary} dark={theme.dark} />
        ) : morphState.error ? (
          <Error loading={false} error={morphState.error} />
        ) : (
          <Loading />
        );
      case "root-explorer":
        return rootsState.data ? (
          <RootExplorer
            roots={rootsState.data}
            verses={filteredVerses}
            surahMap={surahMap}
            ctx={ctx}
          />
        ) : rootsState.error ? (
          <Error loading={false} error={rootsState.error} />
        ) : (
          <Loading />
        );
      case "topic-explorer":
        return topicsState.data ? (
          <TopicExplorer
            topics={topicsState.data}
            verses={filteredVerses}
            surahMap={surahMap}
            ctx={ctx}
          />
        ) : topicsState.error ? (
          <Error loading={false} error={topicsState.error} />
        ) : (
          <Loading />
        );
      case "pos":
        return morph ? (
          <PosChart pos={morph.pos} primary={theme.primary} dark={theme.dark} />
        ) : morphState.error ? (
          <Error loading={false} error={morphState.error} />
        ) : (
          <Loading />
        );
      case "cloud-ar":
        return <WordCloud words={arabicCloud} arabic primary={theme.primary} />;
      case "cloud-en":
        return englishEdition.loading ? (
          <Loading />
        ) : (
          <WordCloud words={englishCloud} arabic={false} primary={theme.primary} />
        );
      default:
        return null;
    }
  }
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading…
    </div>
  );
}

function Error({ error }: { loading: boolean; error: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-rose-500">
      Failed to load: {error}
    </div>
  );
}
