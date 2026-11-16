import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  LayoutGrid,
  Table2,
} from "lucide-react";
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
import { Button, Card, SegmentedControl, Sheet, Skeleton, cx } from "../components/ui";
import { QuestionList } from "../components/dashboard/QuestionMenu";
import { FilterBar } from "../components/dashboard/FilterBar";
import { MarkReadout, type Pinned } from "../components/dashboard/MarkReadout";
import { DataTable } from "../components/dashboard/DataTable";
import { useElementWidth } from "../lib/useElementWidth";
import {
  correlationFacts,
  distributionFacts,
  extremesFacts,
  lengthFacts,
  mapFacts,
  openingFacts,
  posFacts,
  spreadFacts,
  spreadOverSurahs,
} from "../data/answers";
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
import { buildTopicTree, topicName } from "../data/topics";
import { TopicExplorer } from "../components/charts/TopicExplorer";
import type { ChartSettings } from "./SettingsView";
import type { Hifdh } from "../lib/hifdh";
import type { ExploreTarget } from "../components/reader/VerseContextPanel";
import { useSwipePager } from "../lib/useSwipePager";
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

const PetaMushaf = lazy(() =>
  import("../components/peta/PetaMushaf").then((m) => ({ default: m.PetaMushaf })),
);

// Rewrite legacy `qv.viz` values (words/letters/…, cloud-ar/cloud-en) once,
// before the persisted state below reads them.
migrateStoredViz();

const VIZ_IDS = VIZ_DEFS.map((d) => d.value);
/** From this dashboard width (CSS px, zoom-safe) the questions sit beside the chart. */
const MENU_PX = 900;
const METRIC_IDS = METRICS.map((m) => m.value);

export function DashboardView({
  data,
  settings,
  colorMode,
  onColorMode: setColorMode,
  onOpen,
  onSearch,
  lastRead,
  marked,
  hifdh,
  onExplore,
}: {
  data: QuranData;
  settings: ChartSettings;
  colorMode: ColorMode;
  onColorMode: (m: ColorMode) => void;
  onOpen: (t: ReaderTarget) => void;
  /** Open global search with a query (word-cloud click). */
  onSearch?: (query: string) => void;
  /** For the mushaf map: ayah id last read, the ayahs carrying a pin or in a
   *  collection, and what the learner has memorised. */
  lastRead?: number;
  marked: number[];
  hifdh: Hifdh;
  onExplore: (t: ExploreTarget) => void;
}) {
  const theme = useTheme();
  const { t, n, lang, place: i18nPlace, category: i18nCategory } = useI18n();
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
  const [topicKey, setTopicKey] = usePersistentState<string | null>(
    "qv.topicKey",
    null,
    (raw) => (typeof raw === "string" || raw === null ? raw : undefined),
  );
  const [openingCat, setOpeningCat] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const sideMenu = width >= MENU_PX;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTable, setShowTable] = usePersistentState(
    "qv.dashboard.table",
    false,
    persisted.bool,
  );
  const [pinned, setPinned] = useState<Pinned | null>(null);
  // The kind of pointer behind the latest press inside the chart: a mouse
  // click opens the reader at once, a tap first pins a readout.
  const pointer = useRef("mouse");
  const pinnedKey = useRef<string | null>(null);
  useEffect(() => {
    pinnedKey.current = pinned?.key ?? null;
  }, [pinned]);
  const def = VIZ_BY_ID[viz];

  // Switching colour mode invalidates the legend selection (the keys differ).
  const changeColorMode = (m: ColorMode) => {
    setColorMode(m);
    setActiveKeys([]);
  };
  const pickViz = (v: VizId) => {
    setViz(v);
    setPinned(null);
    setMenuOpen(false);
  };
  const vizIndex = VIZ_IDS.indexOf(viz);
  const vizAt = (d: number) => VIZ_IDS[(vizIndex + d + VIZ_IDS.length) % VIZ_IDS.length];
  const stepViz = (d: number) => pickViz(vizAt(d));
  // A sideways swipe on the chart steps like the ‹ › stepper, wrapping.
  const { handlers, sides, trackRef } = useSwipePager({
    current: viz,
    canGo: () => true,
    onCommit: (d) => stepViz(d),
  });
  const changeFilter = (f: FilterState) => {
    setFilter(f);
    setPinned(null);
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
    setPinned(null);
  };
  const dirty =
    filter.mode !== "all" ||
    (filter.place ?? "all") !== "all" ||
    filter.sort !== "quran" ||
    colorMode !== "type" ||
    horizontal;

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
  // A neighbour's rows: the current ones unless it reads range or sort
  // differently (computed only while the neighbours are mounted, a swipe).
  const peekScope = (peekViz: VizId) => {
    const pd = VIZ_BY_ID[peekViz];
    if (!pd.uses.range === !def.uses.range && !pd.uses.sort === !def.uses.sort)
      return { verses: filteredVerses, surahData };
    const f = pd.uses.range ? filter : DEFAULT_FILTER;
    const verses = filterVerses(data.verses, f, surahMap);
    return {
      verses,
      surahData: aggregateBySurah(verses, surahMap, pd.uses.sort ? f.sort : "quran"),
    };
  };

  const activeKeySet = useMemo(() => new Set(activeKeys), [activeKeys]);
  const pct = useCallback(
    (x: number) => `${n(x < 0.1 ? Math.round(x * 1000) / 10 : Math.round(x * 100))}%`,
    [n],
  );

  /** Title and detail for a mark's reader target (surah, or an ayah in it). */
  const describe = useCallback(
    (target: ReaderTarget): Omit<Pinned, "key"> => {
      const v = target.anchor ? data.verses[target.anchor - 1] : undefined;
      if (target.scope !== "surah")
        return { title: `${target.scope} ${target.value}`, target };
      const s = surahMap.get(target.value);
      const d = surahData.find((x) => x.id === target.value);
      const title = `${target.value}. ${s?.name ?? ""}`;
      const detail = d
        ? t.dashboard.surahDetail(i18nPlace(d.type), n(d.ayahCount), n(d.wordCount))
        : undefined;
      return {
        title: v ? `${title} · ${v.s}:${v.a}` : title,
        detail: v && !d ? t.dashboard.ayahDetail(n(v.w)) : detail,
        target,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.verses, surahMap, surahData, t, n],
  );

  const onMark = useCallback(
    (target: ReaderTarget) => {
      if (pointer.current !== "touch" && pointer.current !== "pen") {
        onOpen(target);
        return;
      }
      const key = `${target.scope}:${target.value}:${target.anchor ?? ""}`;
      if (pinnedKey.current === key) onOpen(target);
      else setPinned({ key, ...describe(target) });
    },
    [onOpen, describe],
  );

  const ctx: ChartContext = useMemo(
    () => ({
      palette: theme.palette,
      primary: theme.primary,
      colorMode,
      dark: theme.dark,
      activeKeys: activeKeySet,
      onOpen,
      onSelectSurah: (id) => onOpen({ scope: "surah", value: id }),
      onMark,
    }),
    [theme.palette, theme.primary, theme.dark, colorMode, activeKeySet, onOpen, onMark],
  );
  const peekCtx: ChartContext = useMemo(
    () => ({ ...ctx, onMark: undefined, still: true }),
    [ctx],
  );

  /** A histogram bucket: how many ayahs, and the first few to open. */
  const pinBucket = (r: [number, number]) => {
    const inB = filteredVerses.filter((v) => v.w >= r[0] && v.w <= r[1]);
    setPinned({
      key: `b${r[0]}`,
      bucket: r[0],
      title: t.dashboard.bucket(
        r[0] === r[1] ? n(r[0]) : `${n(r[0])}–${n(r[1])}`,
        n(inB.length),
        pct(inB.length / (filteredVerses.length || 1)),
      ),
      examples: inB.slice(0, 8).map((v) => ({
        label: `${v.s}:${v.a}`,
        target: { scope: "surah", value: v.s, anchor: v.id },
      })),
    });
  };

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
  const topicTree = useMemo(
    () => (topicsState.data ? buildTopicTree(topicsState.data) : null),
    [topicsState.data],
  );

  // Mirror the view into the link (replaceState: no history entry per click),
  // keeping any open reader target.
  useEffect(() => {
    const cur = parseHash(window.location.hash);
    if (cur.view !== "dashboard") return;
    const next = serializeHash(
      "dashboard",
      cur.reader,
      dashboardToParams({
        viz,
        metric,
        cloudLang,
        filter,
        root: rootBw,
        topic: topicKey ?? undefined,
      }),
    );
    if (window.location.hash.slice(1) !== next)
      window.history.replaceState(null, "", `#${next}`);
  }, [viz, metric, cloudLang, filter, rootBw, topicKey]);

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
        avg_words_per_ayah: Math.round(d.avgWords * 100) / 100,
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
        const i = topicKey != null ? topicTree?.byKey.get(topicKey) : undefined;
        if (!topicTree || i == null) return [];
        const name = topicName(topicTree.nodes[i], lang);
        return perSurah({ v: topicTree.all[i] }).map((row) => ({ topic: name, ...row }));
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
    viz === "map"
      ? t.peta.subtitle
      : viz === "pos"
        ? morph
          ? t.dashboard.posSub(n(morph.totalSegments))
          : t.dashboard.loadingCorpus
        : viz === "roots" || viz === "root-explorer"
          ? `${scopeLine} · ${t.dashboard.rootsSub}`
          : viz === "topic-explorer"
            ? `${scopeLine} · ${t.dashboard.topicsSub(topicTree ? n(topicTree.nodes.filter((x) => x.k.startsWith("t")).length) : "…")}`
            : viz === "cloud"
              ? `${scopeLine} · ${t.dashboard.cloudSub}`
              : viz === "opening"
                ? `${scopeLine} · ${t.dashboard.openingSub}`
                : scopeLine;

  /** The question's answer, worded from facts computed over the range. */
  const answer = useMemo((): string | null => {
    const name = (id: number) => surahMap.get(id)?.name ?? `#${id}`;
    const a = t.answers;
    switch (viz) {
      case "length": {
        const f = lengthFacts(surahData, metric);
        if (!f) return a.none;
        if (metric === "avgWords")
          return a.lengthAvg(
            f.top.name,
            n(Math.round(f.top.avgWords * 10) / 10),
            f.bottom.name,
            n(Math.round(f.bottom.avgWords * 10) / 10),
          );
        return a.length(
          f.top.name,
          n(f.top[metric]),
          a.units[metric],
          f.share === null ? null : pct(f.share),
          f.bottom.name,
          n(f.bottom[metric]),
        );
      }
      case "correlation": {
        const f = correlationFacts(surahData);
        if (!f) return a.none;
        const r1 = (x: number) => n(Math.round(x * 10) / 10);
        return a.corr(
          f.r,
          n(Math.round(f.r * 100) / 100),
          f.dense.name,
          r1(f.dense.avgWords),
          f.sparse.name,
          r1(f.sparse.avgWords),
        );
      }
      case "opening": {
        const f = openingFacts(surahData);
        return f ? a.opening(i18nCategory(f.category), f.count, f.total) : a.none;
      }
      case "histogram": {
        const f = distributionFacts(filteredVerses);
        return f
          ? a.histogram(n(f.q1), n(f.q3), n(f.median), n(f.mode), pct(f.modeShare))
          : a.none;
      }
      case "boxplots": {
        const f = spreadFacts(filteredVerses);
        return f
          ? a.boxplots(
              name(f.widest.s),
              n(f.widest.min),
              n(f.widest.max),
              name(f.highest.s),
              n(f.highest.median),
            )
          : a.none;
      }
      case "extremes": {
        const f = extremesFacts(filteredVerses);
        return f
          ? a.extremes(
              `${f.longest.s}:${f.longest.a}`,
              name(f.longest.s),
              n(f.longest.w),
              f.shortestWords,
              n(f.shortestCount),
            )
          : a.none;
      }
      case "cloud": {
        const w = cloudLang === "ar" ? arabicCloud : englishCloud;
        return w.length >= 3
          ? a.cloud(w[0].text, n(w[0].value), w[1].text, w[2].text)
          : null;
      }
      case "roots": {
        if (!rootsState.data) return null;
        const top = topRootsInScope(
          rootsState.data,
          new Set(filteredVerses.map((v) => v.id)),
          1,
        )[0];
        return top
          ? a.roots(top.root.ar, top.root.gloss.replace(/[,;]\s*$/, ""), n(top.count))
          : a.none;
      }
      case "root-explorer": {
        const r = rootsState.data?.find((x) => x.bw === rootBw) ?? rootsState.data?.[0];
        if (!r) return null;
        const f = spreadOverSurahs(r.v, new Map(filteredVerses.map((v) => [v.id, v])));
        return f.total ? a.rootWhere(r.ar, name(f.top), n(f.topCount), f.surahs) : a.none;
      }
      case "topic-explorer": {
        const i = topicKey != null ? topicTree?.byKey.get(topicKey) : undefined;
        if (!topicTree) return null;
        if (i == null) return a.pickTopic;
        const f = spreadOverSurahs(
          topicTree.all[i],
          new Map(filteredVerses.map((v) => [v.id, v])),
        );
        return f.total
          ? a.topicWhere(
              topicName(topicTree.nodes[i], lang),
              n(f.total),
              f.surahs,
              name(f.top),
              n(f.topCount),
            )
          : a.none;
      }
      case "map": {
        const f = mapFacts(data.verses, marked);
        return a.map(n(f.surahs), n(f.ayahs), f.marked, n(f.marked));
      }
      case "pos": {
        const f = morph ? posFacts(morph.pos) : null;
        return f
          ? a.pos(
              t.pos[f.first.tag] ?? f.first.label,
              pct(f.firstShare),
              t.pos[f.second.tag] ?? f.second.label,
              pct(f.secondShare),
            )
          : null;
      }
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viz,
    metric,
    surahData,
    filteredVerses,
    surahMap,
    cloudLang,
    arabicCloud,
    englishCloud,
    rootsState.data,
    rootBw,
    topicTree,
    topicKey,
    morph,
    data.verses,
    marked,
    lang,
    t,
    n,
    pct,
  ]);

  /** A data-table row's reader target: an ayah (surah + ayah) or a surah. */
  const targetOfRow = (row: Record<string, unknown>): ReaderTarget | null => {
    const s = Number(row.surah);
    if (!Number.isInteger(s) || s < 1 || s > 114) return null;
    const ay = Number(row.ayah);
    if (Number.isInteger(ay) && ay > 0) {
      const v = filteredVerses.find((x) => x.s === s && x.a === ay);
      if (v) return { scope: "surah", value: s, anchor: v.id };
    }
    return { scope: "surah", value: s };
  };

  const headerControls =
    viz === "length" ? (
      <SegmentedControl<Metric>
        value={metric}
        onChange={(m) => {
          setMetric(m);
          setPinned(null);
        }}
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

  // The map has no rows: no data table or CSV.
  const tabular = viz !== "map";
  const table = showTable && tabular;
  const heading = (id: VizId) => {
    const Icon = VIZ_BY_ID[id].icon;
    return (
      <h2 className="text-title text-ink">
        {sideMenu ? (
          t.viz.labels[id]
        ) : (
          <span className="inline-flex items-start gap-2">
            <Icon size={18} aria-hidden className="mt-1 shrink-0 text-illumination" />
            <span>{t.viz.labels[id]}</span>
          </span>
        )}
      </h2>
    );
  };
  const tall = "h-[calc(100*var(--zvh)-18rem)] max-h-[calc(88*var(--zvh))] min-h-[360px]";
  // Scrubbed charts: fixed height and nothing inside that scrolls itself.
  const chartLocksPan =
    !table && !def.autoHeight && !["extremes", "cloud", "boxplots"].includes(viz);

  return (
    // The question menu sits beside the chart from MENU_PX of dashboard width
    // (measured, not a media query: CSS zoom leaves those reading the window).
    <div ref={rootRef} className="flex items-start gap-4">
      {sideMenu && (
        <Card className="sticky top-4 w-[17rem] shrink-0 p-2">
          <QuestionList defs={VIZ_DEFS} value={viz} onChange={pickViz} />
        </Card>
      )}

      <Card className="min-w-0 flex-1 p-4">
        {!sideMenu && (
          <div className="mb-2 flex items-center gap-2">
            <Button
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              icon={<LayoutGrid size={16} aria-hidden />}
            >
              {t.dashboard.allCharts}
            </Button>
            <div className="flex items-center gap-0.5 text-sm font-medium tabular-nums text-ink-muted">
              <Button
                variant="quiet"
                onClick={() => stepViz(-1)}
                aria-label={t.dashboard.prevChart}
                title={t.dashboard.prevChart}
                className="w-9 px-0 touch:min-w-11"
              >
                <ChevronLeft size={18} aria-hidden />
              </Button>
              <span className="min-w-[3.5rem] text-center">
                {n(vizIndex + 1)} / {n(VIZ_DEFS.length)}
              </span>
              <Button
                variant="quiet"
                onClick={() => stepViz(1)}
                aria-label={t.dashboard.nextChart}
                title={t.dashboard.nextChart}
                className="w-9 px-0 touch:min-w-11"
              >
                <ChevronRight size={18} aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {/* Clipped only mid-swipe, so filter popovers and focus rings show
            otherwise; edge to edge, so panes slide under the card's edge. */}
        <div
          data-testid="dashboard-pager"
          className={cx(
            "-mx-4 touch-pan-y touch-pinch-zoom px-4",
            sides.length > 0 && "overflow-hidden",
          )}
          {...handlers}
        >
          <div ref={trackRef} className="relative">
            <div className="mb-3 flex flex-wrap items-start gap-x-4 gap-y-2">
              <div className="min-w-0 flex-[1_1_20rem]">
                {heading(viz)}
                <p
                  className="mt-1 max-w-[68ch] text-base leading-relaxed text-ink"
                  aria-live="polite"
                >
                  {answer ?? t.common.loading}
                </p>
                <p className="mt-0.5 text-sm text-ink-subtle">{subtitle}</p>
              </div>
              <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
                {headerControls}
                {tabular && (
                  <Button
                    onClick={() => setShowTable(!showTable)}
                    title={showTable ? t.dashboard.showChart : t.dashboard.showData}
                    aria-pressed={showTable}
                    icon={
                      showTable ? (
                        <BarChart3 size={16} aria-hidden />
                      ) : (
                        <Table2 size={16} aria-hidden />
                      )
                    }
                  >
                    {showTable ? t.dashboard.showChart : t.dashboard.showData}
                  </Button>
                )}
                <Button
                  onClick={handleExport}
                  title={t.dashboard.png}
                  disabled={table}
                  icon={<Download size={16} aria-hidden />}
                >
                  PNG
                </Button>
                {tabular && (
                  <Button
                    onClick={() => void downloadCsv(csvRows(), `quran-${viz}`)}
                    title={t.dashboard.csv}
                    icon={<FileSpreadsheet size={16} aria-hidden />}
                  >
                    CSV
                  </Button>
                )}
              </div>
            </div>

            <div className="mb-3">
              <FilterBar
                uses={def.uses}
                surahs={data.surahs}
                filter={filter}
                onFilter={changeFilter}
                colorMode={colorMode}
                onColorMode={changeColorMode}
                horizontal={horizontal}
                onHorizontal={setHorizontal}
                onReset={reset}
                dirty={dirty}
              />
            </div>

            {pinned && !table && (
              <div className="mb-3">
                <MarkReadout
                  pinned={pinned}
                  onOpen={onOpen}
                  onClear={() => setPinned(null)}
                />
              </div>
            )}

            <div
              onPointerDownCapture={(e) => {
                pointer.current = e.pointerType || "mouse";
              }}
              // A finger inside the chart never pages; a fixed-height chart (it
              // fits the screen) also keeps the page still so the tooltip can
              // follow the finger. Tall views, lists and sideways scrollers pan.
              data-no-swipe
              data-touch-lock={chartLocksPan || undefined}
              className={cx(
                "w-full rounded-xl",
                chartLocksPan && "touch-pinch-zoom",
                (table || !def.autoHeight) && tall,
                !table && !def.autoHeight && "resize-y overflow-hidden",
              )}
            >
              {table ? (
                <DataTable rows={csvRows()} targetOf={targetOfRow} onOpen={onOpen} />
              ) : (
                <div ref={chartRef} className={cx("w-full", !def.autoHeight && "h-full")}>
                  {renderChart(viz, filteredVerses, surahData, true)}
                </div>
              )}
            </div>
            {def.uses.color && !table && (
              <div className="mt-3 border-t border-line pt-3">
                <Legend
                  colorMode={colorMode}
                  pie={theme.palette.pie}
                  activeKeys={activeKeySet}
                  onToggle={toggleKey}
                  ayahLevel={viz === "length" && metric !== "avgWords"}
                />
              </div>
            )}

            {sides.map((d) => {
              const peekViz = vizAt(d);
              const scope = peekScope(peekViz);
              return (
                <div
                  key={d}
                  aria-hidden
                  // `inert` is not in React 18's types; passed through as an attribute.
                  {...({ inert: "" } as object)}
                  className={cx(
                    "absolute inset-y-0 w-full overflow-hidden",
                    d === 1 ? "left-full" : "right-full",
                  )}
                >
                  {heading(peekViz)}
                  <div
                    className={cx("mt-3 w-full", !VIZ_BY_ID[peekViz].autoHeight && tall)}
                  >
                    {renderChart(peekViz, scope.verses, scope.surahData, false)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Sheet
        open={menuOpen && !sideMenu}
        onClose={() => setMenuOpen(false)}
        title={t.dashboard.charts}
        side={width < 560 ? "bottom" : "right"}
        closeLabel={t.common.close}
      >
        {/* Rows inset 8px, so their text lines up with the header's 16px. */}
        <div className="px-2 py-3">
          <QuestionList defs={VIZ_DEFS} value={viz} onChange={pickViz} />
        </div>
      </Sheet>
    </div>
  );

  /** The chart for `id` over `verses` / `surahData`. `live` is the current
   *  pane; a swipe's neighbour (`live` false) is drawn still and inert, and
   *  shows a skeleton where its data would need loading or heavy work. */
  function renderChart(
    id: VizId,
    verses: typeof filteredVerses,
    rows: typeof surahData,
    live: boolean,
  ) {
    const c = live ? ctx : peekCtx;
    const noop = () => {};
    const wait = (st: { error: string | null; retry?: () => void }) =>
      live ? (
        <LoadState error={st.error} onRetry={st.retry} />
      ) : (
        <Skeleton className="h-full min-h-[200px]" />
      );
    switch (id) {
      case "length":
        return (
          <SurahBarChart data={rows} metric={metric} horizontal={horizontal} ctx={c} />
        );
      case "correlation":
        return <CorrelationScatter data={rows} ctx={c} />;
      case "opening":
        return (
          <OpeningCategories
            data={rows}
            ctx={c}
            surahMap={surahMap}
            exceptions={exceptions}
            selected={live ? openingCat : null}
            onSelect={live ? setOpeningCat : noop}
          />
        );
      case "histogram":
        return (
          <LengthHistogram
            verses={verses}
            bucketSize={settings.bucketSize}
            ctx={c}
            selected={live ? (pinned?.bucket ?? null) : null}
            onBucket={live ? pinBucket : undefined}
          />
        );
      case "boxplots":
        return (
          <BoxPlots
            verses={verses}
            order={live ? order : rows.map((d) => d.id)}
            surahMap={surahMap}
            ctx={c}
          />
        );
      case "extremes":
        return (
          <ExtremesPanel
            verses={verses}
            count={settings.extremesCount}
            surahMap={surahMap}
            ctx={c}
          />
        );
      case "roots":
        return rootsState.data ? (
          <RootChart
            roots={rootsState.data}
            verses={verses}
            primary={theme.primary}
            dark={theme.dark}
            onPick={(bw) => {
              if (!live) return;
              setRootBw(bw);
              setViz("root-explorer");
            }}
          />
        ) : (
          wait(rootsState)
        );
      case "root-explorer":
        return rootsState.data ? (
          <RootExplorer
            roots={rootsState.data}
            verses={verses}
            surahMap={surahMap}
            ctx={c}
            selectedBw={rootBw}
            onSelectBw={live ? setRootBw : noop}
          />
        ) : (
          wait(rootsState)
        );
      case "topic-explorer":
        return topicTree ? (
          <TopicExplorer
            tree={topicTree}
            verses={verses}
            surahMap={surahMap}
            ctx={c}
            selectedKey={topicKey}
            onSelectKey={live ? setTopicKey : noop}
          />
        ) : (
          wait(topicsState)
        );
      case "pos":
        return morph ? (
          <PosChart pos={morph.pos} primary={theme.primary} dark={theme.dark} />
        ) : (
          wait(morphState)
        );
      case "cloud":
        // Counting the words is too heavy to start mid-swipe.
        if (!live) return <Skeleton className="h-full min-h-[200px]" />;
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
      case "map": {
        const skeleton = <Skeleton className="h-[calc(60*var(--zvh))]" />;
        // Its first showing plays the once-a-session reveal: never as a neighbour.
        if (!live) return skeleton;
        return (
          <Suspense fallback={skeleton}>
            <PetaMushaf
              verses={data.verses}
              surahMap={surahMap}
              lastRead={lastRead}
              bookmarks={marked}
              hifdh={hifdh}
              onOpen={onOpen}
              onExplore={onExplore}
            />
          </Suspense>
        );
      }
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
        error ? "text-rose-500" : "text-ink-subtle",
      )}
      role={error ? "alert" : "status"}
    >
      {error ? t.common.failedToLoad(error) : t.common.loading}
      {error && onRetry && (
        <Button size="sm" onClick={onRetry}>
          {t.common.retry}
        </Button>
      )}
    </div>
  );
}
