import { useMemo } from "react";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import type { QuranData } from "../types/quran";
import { surahMapOf } from "../data/selectors";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { Card, SectionTitle, SegmentedControl } from "../components/ui";
import type { ChartContext, ReaderTarget } from "../components/charts/common";
import { StructureOverview } from "../components/charts/StructureOverview";
import { JuzBreakdown } from "../components/charts/JuzBreakdown";
import { HizbBreakdown } from "../components/charts/HizbBreakdown";
import { SajdaMarkers } from "../components/charts/SajdaMarkers";
import { DivisionBreakdown } from "../components/charts/DivisionBreakdown";
import { SimilarArcs } from "../components/charts/SimilarArcs";
import { useSimilar } from "../data/useSimilar";

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
  const similar = useSimilar(tab === "similar");

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
      <div className="h-[calc(64*var(--zvh))] min-h-[440px] w-full">
        {tab === "overview" && (
          <StructureOverview surahs={data.surahs} meta={data.meta} />
        )}
        {tab === "juz" && <JuzBreakdown verses={data.verses} ctx={ctx} />}
        {tab === "hizb" && <HizbBreakdown verses={data.verses} ctx={ctx} />}
        {(tab === "manzil" || tab === "ruku") && (
          <DivisionBreakdown
            verses={data.verses}
            surahMap={surahMap}
            division={tab}
            ctx={ctx}
          />
        )}
        {tab === "similar" &&
          (similar.data ? (
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
                <button
                  type="button"
                  onClick={similar.retry}
                  className="rounded-lg border border-ink-subtle/50 px-3 py-1 text-xs font-medium text-ink-muted hover:bg-paper"
                >
                  {t.common.retry}
                </button>
              )}
            </div>
          ))}
        {tab === "sajda" && (
          <SajdaMarkers verses={data.verses} surahMap={surahMap} ctx={ctx} />
        )}
      </div>
    </Card>
  );
}
