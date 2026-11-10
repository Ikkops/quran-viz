import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import type { QuranData } from "../types/quran";
import {
  aggregateBySurah,
  DEFAULT_FILTER,
  exceptionsBySurah,
  ayahPlace,
  filterVerses,
  sanitizeFilter,
  surahMapOf,
  type FilterState,
} from "../data/selectors";
import { wordFrequency } from "../data/arabic";
import { useTranslation } from "../data/useTranslation";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { downloadCsv, exportElementToPng } from "../lib/export";
import { parseHash, serializeHash } from "../lib/hash";
import { rootSurahCounts, topRootsInScope } from "../data/roots";
import { Card, IconButton, SectionTitle, SegmentedControl, cx } from "../components/ui";
import { ControlPanel } from "../components/controls/ControlPanel";
import type { ChartContext, ColorMode, ReaderTarget } from "../components/charts/common";
import { SurahBarChart, type Metric } from "../components/charts/SurahBarChart";
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
import {
  dashboardToParams,
  METRICS,
  migrateStoredViz,
  seedDashboardFromHash,
  VIZ_BY_ID,
  VIZ_DEFS,
  type CloudLang,
  type VizId,
} from "./vizDefs";

// Rewrite legacy `qv.viz` values (words/letters/…, cloud-ar/cloud-en) once,
// before the persisted state below reads them.
migrateStoredViz();

const VIZ_IDS = VIZ_DEFS.map((d) => d.value);
const METRIC_IDS = METRICS.map((m) => m.value);

export function DashboardView({
  data,
  settings,
  colorMode,
  onColorMode: setColorMode,
  onOpen,
  onSearch,
}: {
  data: QuranData;
  settings: ChartSettings;
  colorMode: ColorMode;
  onColorMode: (m: ColorMode) => void;
  onOpen: (t: ReaderTarget) => void;
  /** Open global search with a query (word-cloud click). */
  onSearch?: (query: string) => void;
}) {
  const theme = useTheme();
  const { t, n } = useI18n();
  // A shared link's view (in the hash) wins over the remembered one. Runs
  // before the persisted state below initialises from storage.
  useState(() => {
    seedDashboardFromHash(window.location.hash);
    return true;
  });
  const [viz, setViz] = usePersistentState<VizId>(
    "qv.viz",
    "length",
    persisted.oneOf(VIZ_IDS),
  );
  const [metric, setMetric] = usePersistentState<Metric>(
    "qv.metric",
    "wordCount",
    persisted.oneOf(METRIC_IDS),
  );
  const [cloudLang, setCloudLang] = usePersistentState<CloudLang>(
    "qv.cloudLang",
    "ar",
    persisted.oneOf(["ar", "en"] as const),
  );
  const [filter, setFilter] = usePersistentState<FilterState>(
    "qv.filter",
    DEFAULT_FILTER,
    sanitizeFilter,
  );
  const [horizontal, setHorizontal] = usePersistentState("qv.horizontal", false);
  const [activeKeys, setActiveKeys] = usePersistentState<string[]>("qv.activeKeys", []);
  const [rootBw, setRootBw] = usePersistentState("qv.root", "ktb");
  const [topicId, setTopicId] = usePersistentState<number | null>("qv.topic", null);
  const [openingCat, setOpeningCat] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const def = VIZ_BY_ID[viz];

  // Switching colour mode invalidates the legend selection (the keys differ).
  const changeColorMode = (m: ColorMode) => {
    setColorMode(m);
    setActiveKeys([]);
  };
  const toggleKey = (k: string) =>
    setActiveKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const reset = () => {
    setViz("length");
    setMetric("wordCount");
    setFilter(DEFAULT_FILTER);
    setColorMode("type");
    setHorizontal(false);
    setActiveKeys([]);
  };

  const surahMap = useMemo(() => surahMapOf(data.surahs), [data.surahs]);
  const exceptions = useMemo(() => exceptionsBySurah(data.verses), [data.verses]);
  // Views that ignore the range see the whole Qur'an.
  const effectiveFilter = def.uses.range ? filter : DEFAULT_FILTER;
  const filteredVerses = useMemo(
    () => filterVerses(data.verses, effectiveFilter, surahMap),
    [data.verses, effectiveFilter, surahMap],
  );
  const surahData = useMemo(
    () =>
      aggregateBySurah(
        filteredVerses,
        surahMap,
        def.uses.sort ? effectiveFilter.sort : "quran",
      ),
    [filteredVerses, surahMap, def.uses.sort, effectiveFilter.sort],
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
      viz === "cloud" && cloudLang === "ar"
        ? wordFrequency(
            filteredVerses.map((v) => v.ar),
            { arabic: true },
          )
        : [],
    [viz, cloudLang, filteredVerses],
  );
  const englishEdition = useTranslation(
    viz === "cloud" && cloudLang === "en" ? data.editions.default : null,
  );
  const englishCloud = useMemo(() => {
    if (viz !== "cloud" || cloudLang !== "en" || !englishEdition.data) return [];
    return wordFrequency(
      filteredVerses.map((v) => englishEdition.data![v.id] ?? ""),
      { arabic: false },
    );
  }, [viz, cloudLang, filteredVerses, englishEdition.data]);

  // Lazy data, loaded only for the views that need it.
  const morphState = useMorphology(viz === "pos");
  const morph = morphState.data;
  const rootsState = useRoots(viz === "roots" || viz === "root-explorer");
  const topicsState = useTopics(viz === "topic-explorer");

  // Mirror the view into the link (replaceState: no history entry per click),
  // keeping any open reader target.
  useEffect(() => {
    const cur = parseHash(window.location.hash);
    if (cur.view !== "dashboard") return;
    const next = serializeHash(
      "dashboard",
      cur.reader,
      dashboardToParams({ viz, metric, cloudLang, filter }),
    );
    if (window.location.hash.slice(1) !== next)
      window.history.replaceState(null, "", `#${next}`);
  }, [viz, metric, cloudLang, filter]);

  const handleExport = async () => {
    if (chartRef.current)
      await exportElementToPng(chartRef.current, `quran-${viz}`, theme.dark);
  };

  /** The rows behind the current view, for CSV export. */
  const csvRows = (): Record<string, unknown>[] => {
    const surahRows = () =>
      surahData.map((d) => ({
        surah: d.id,
        name: d.name,
        arabic: d.nameAr,
        type: d.type,
        revelation_order: d.revelationOrder,
        ayahs: d.ayahCount,
        words: d.wordCount,
        letters: d.letterCount,
        avg_words_per_ayah: d.avgWords.toFixed(2),
        meccan_ayahs: d.split.v.Meccan,
        medinan_ayahs: d.split.v.Medinan,
        hijra_ayahs: d.split.v.Hijra,
        opening_category: d.category,
      }));
    const verseRows = () =>
      filteredVerses.map((v) => ({
        surah: v.s,
        ayah: v.a,
        words: v.w,
        letters: v.l,
        place: ayahPlace(v, surahMap),
        juz: v.juz,
        page: v.page,
      }));
    const perSurah = (item: { v: number[] }) => {
      const inScope = new Map(filteredVerses.map((v) => [v.id, v]));
      const counts = rootSurahCounts(item, inScope);
      return surahData.map((d) => ({
        surah: d.id,
        name: d.name,
        count: counts.get(d.id)?.count ?? 0,
      }));
    };
    switch (viz) {
      case "length":
      case "correlation":
      case "opening":
      case "boxplots":
        return surahRows();
      case "histogram":
      case "extremes":
        return verseRows();
      case "cloud":
        return (cloudLang === "ar" ? arabicCloud : englishCloud).map((w) => ({
          word: w.text,
          count: w.value,
        }));
      case "roots":
        return rootsState.data
          ? topRootsInScope(
              rootsState.data,
              new Set(filteredVerses.map((v) => v.id)),
              200,
            ).map(({ root, count }) => ({
              root: root.ar,
              buckwalter: root.bw,
              gloss: root.gloss,
              count,
            }))
          : [];
      case "root-explorer": {
        const r = rootsState.data?.find((x) => x.bw === rootBw) ?? rootsState.data?.[0];
        return r ? perSurah(r).map((row) => ({ root: r.ar, ...row })) : [];
      }
      case "topic-explorer": {
        const t =
          topicsState.data?.find((x) => x.id === topicId) ?? topicsState.data?.[0];
        return t ? perSurah(t).map((row) => ({ topic: t.name, ...row })) : [];
      }
      case "pos":
        return (
          morph?.pos.map((p) => ({
            tag: p.tag,
            label: t.pos[p.tag] ?? p.label,
            count: p.count,
          })) ?? []
        );
      default:
        return [];
    }
  };

  const scopeLine = t.dashboard.scope(surahData.length, n(filteredVerses.length));
  const subtitle =
    viz === "pos"
      ? morph
        ? t.dashboard.posSub(n(morph.totalSegments))
        : t.dashboard.loadingCorpus
      : viz === "roots" || viz === "root-explorer"
        ? `${scopeLine} · ${t.dashboard.rootsSub}`
        : viz === "topic-explorer"
          ? `${scopeLine} · ${t.dashboard.topicsSub(topicsState.data ? n(topicsState.data.length) : "…")}`
          : viz === "cloud"
            ? `${scopeLine} · ${t.dashboard.cloudSub}`
            : viz === "opening"
              ? `${scopeLine} · ${t.dashboard.openingSub}`
              : def.autoHeight
                ? scopeLine
                : `${scopeLine} · ${t.dashboard.resizeSub}`;

  const headerControls =
    viz === "length" ? (
      <SegmentedControl<Metric>
        value={metric}
        onChange={setMetric}
        ariaLabel={t.dashboard.metric}
        options={METRICS.map((m) => ({ value: m.value, label: t.viz.metrics[m.value] }))}
      />
    ) : viz === "cloud" ? (
      <SegmentedControl<CloudLang>
        value={cloudLang}
        onChange={setCloudLang}
        ariaLabel={t.dashboard.cloudLang}
        options={[
          { value: "ar", label: t.dashboard.arabic },
          { value: "en", label: t.dashboard.english },
        ]}
      />
    ) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit p-4">
        <ControlPanel
          vizDefs={VIZ_DEFS}
          viz={viz}
          onViz={setViz}
          uses={def.uses}
          surahs={data.surahs}
          filter={filter}
          onFilter={setFilter}
          colorMode={colorMode}
          onColorMode={changeColorMode}
          horizontal={horizontal}
          onHorizontal={setHorizontal}
          onReset={reset}
        />
      </Card>

      <Card className="min-w-0 p-4">
        <SectionTitle
          title={t.viz.labels[viz]}
          subtitle={subtitle}
          right={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {headerControls}
              <IconButton onClick={handleExport} title={t.dashboard.png}>
                <Download size={15} /> PNG
              </IconButton>
              <IconButton
                onClick={() => downloadCsv(csvRows(), `quran-${viz}`)}
                title={t.dashboard.csv}
              >
                <FileSpreadsheet size={15} /> CSV
              </IconButton>
            </div>
          }
        />
        <div
          className={cx(
            "w-full rounded-xl",
            !def.autoHeight &&
              "h-[calc(60*var(--zvh))] max-h-[calc(88*var(--zvh))] min-h-[360px] resize-y overflow-hidden",
          )}
        >
          <div ref={chartRef} className={cx("w-full", !def.autoHeight && "h-full")}>
            {renderChart()}
          </div>
        </div>
        {def.uses.color && (
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700/60">
            <Legend
              colorMode={colorMode}
              pie={theme.palette.pie}
              activeKeys={activeKeySet}
              onToggle={toggleKey}
              ayahLevel={viz === "length" && metric !== "avgWords"}
            />
          </div>
        )}
      </Card>
    </div>
  );

  function renderChart() {
    switch (viz) {
      case "length":
        return (
          <SurahBarChart
            data={surahData}
            metric={metric}
            horizontal={horizontal}
            ctx={ctx}
          />
        );
      case "correlation":
        return <CorrelationScatter data={surahData} ctx={ctx} />;
      case "opening":
        return (
          <OpeningCategories
            data={surahData}
            ctx={ctx}
            surahMap={surahMap}
            exceptions={exceptions}
            selected={openingCat}
            onSelect={setOpeningCat}
          />
        );
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
        return rootsState.data ? (
          <RootChart
            roots={rootsState.data}
            verses={filteredVerses}
            primary={theme.primary}
            dark={theme.dark}
            onPick={(bw) => {
              setRootBw(bw);
              setViz("root-explorer");
            }}
          />
        ) : (
          <LoadState error={rootsState.error} onRetry={rootsState.retry} />
        );
      case "root-explorer":
        return rootsState.data ? (
          <RootExplorer
            roots={rootsState.data}
            verses={filteredVerses}
            surahMap={surahMap}
            ctx={ctx}
            selectedBw={rootBw}
            onSelectBw={setRootBw}
          />
        ) : (
          <LoadState error={rootsState.error} onRetry={rootsState.retry} />
        );
      case "topic-explorer":
        return topicsState.data ? (
          <TopicExplorer
            topics={topicsState.data}
            verses={filteredVerses}
            surahMap={surahMap}
            ctx={ctx}
            selectedId={topicId}
            onSelectId={setTopicId}
          />
        ) : (
          <LoadState error={topicsState.error} onRetry={topicsState.retry} />
        );
      case "pos":
        return morph ? (
          <PosChart pos={morph.pos} primary={theme.primary} dark={theme.dark} />
        ) : (
          <LoadState error={morphState.error} onRetry={morphState.retry} />
        );
      case "cloud":
        return cloudLang === "ar" ? (
          <WordCloud
            words={arabicCloud}
            arabic
            primary={theme.primary}
            onWordClick={onSearch}
          />
        ) : englishEdition.loading ? (
          <LoadState error={englishEdition.error} />
        ) : (
          <WordCloud
            words={englishCloud}
            arabic={false}
            primary={theme.primary}
            onWordClick={onSearch}
          />
        );
      default:
        return null;
    }
  }
}

function LoadState({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className={cx(
        "flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-sm",
        error ? "text-rose-500" : "text-slate-400",
      )}
      role={error ? "alert" : "status"}
    >
      {error ? t.common.failedToLoad(error) : t.common.loading}
      {error && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t.common.retry}
        </button>
      )}
    </div>
  );
}
