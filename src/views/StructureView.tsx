import { useMemo } from "react";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import type { QuranData } from "../types/quran";
import { surahMapOf } from "../data/selectors";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { Button, Card, SectionTitle, SegmentedControl, cx } from "../components/ui";
import type { ChartContext, ReaderTarget } from "../components/charts/common";
import { StructureOverview } from "../components/charts/StructureOverview";
import { JuzBreakdown } from "../components/charts/JuzBreakdown";
import { HizbBreakdown } from "../components/charts/HizbBreakdown";
import { SajdaMarkers } from "../components/charts/SajdaMarkers";
import { DivisionBreakdown } from "../components/charts/DivisionBreakdown";
import { SimilarArcs } from "../components/charts/SimilarArcs";
import { useSimilar } from "../data/useSimilar";
import { useSwipePager } from "../lib/useSwipePager";

type Tab = "overview" | "manzil" | "juz" | "hizb" | "ruku" | "sajda" | "similar";

// "pages" (the 604-page grid) gave way to the Peta Mushaf; a stored "pages"
// falls back to the overview.
const TABS: Tab[] = ["overview", "manzil", "juz", "hizb", "ruku", "sajda", "similar"];

export function StructureView({
  data,
  onOpen,
}: {
  data: QuranData;
  onOpen: (t: ReaderTarget) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [tab, setTab] = usePersistentState<Tab>(
    "qv.structure.tab",
    "overview",
    persisted.oneOf(TABS),
  );
  const surahMap = useMemo(() => surahMapOf(data.surahs), [data.surahs]);
  const index = TABS.indexOf(tab);
  // A sideways swipe on the chart moves between tabs, stopping at the ends.
  const { handlers, sides, trackRef } = useSwipePager({
    current: tab,
    canGo: (d) => index + d >= 0 && index + d < TABS.length,
    onCommit: (d) => setTab(TABS[index + d]),
  });
  const similar = useSimilar(
    tab === "similar" || sides.some((d) => TABS[index + d] === "similar"),
  );

  const ctx: ChartContext = useMemo(
    () => ({
      palette: theme.palette,
      primary: theme.primary,
      colorMode: "type",
      dark: theme.dark,
      onOpen,
      onSelectSurah: (id) => onOpen({ scope: "surah", value: id }),
    }),
    [theme.palette, theme.primary, theme.dark, onOpen],
  );

  const renderTab = (k: Tab) => {
    switch (k) {
      case "overview":
        return <StructureOverview surahs={data.surahs} meta={data.meta} />;
      case "juz":
        return <JuzBreakdown verses={data.verses} ctx={ctx} />;
      case "hizb":
        return <HizbBreakdown verses={data.verses} ctx={ctx} />;
      case "manzil":
      case "ruku":
        return (
          <DivisionBreakdown
            verses={data.verses}
            surahMap={surahMap}
            division={k}
            ctx={ctx}
          />
        );
      case "similar":
        return similar.data ? (
          <SimilarArcs
            data={similar.data}
            verses={data.verses}
            surahMap={surahMap}
            ctx={ctx}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-subtle">
            {similar.error ? t.common.failedToLoad(similar.error) : t.common.loading}
            {similar.error && (
              <Button size="sm" onClick={similar.retry}>
                {t.common.retry}
              </Button>
            )}
          </div>
        );
      case "sajda":
        return <SajdaMarkers verses={data.verses} surahMap={surahMap} ctx={ctx} />;
    }
  };

  return (
    <Card className="p-4">
      <SectionTitle
        title={t.structure.titles[tab]}
        subtitle={t.structure.subtitles[tab]}
        right={
          <SegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            options={TABS.map((k) => ({ value: k, label: t.structure.tabs[k] }))}
          />
        }
      />
      {/* Clipped only while the neighbours are mounted (a swipe); edge to
          edge, so panes slide under the card's edge. */}
      <div
        data-testid="structure-pager"
        className={cx(
          "-mx-4 touch-pan-y touch-pinch-zoom px-4",
          sides.length > 0 && "overflow-hidden",
        )}
        {...handlers}
      >
        <div
          ref={trackRef}
          className="relative h-[calc(64*var(--zvh))] min-h-[440px] w-full"
        >
          {renderTab(tab)}
          {sides.map((d) => (
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
              {renderTab(TABS[index + d])}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
