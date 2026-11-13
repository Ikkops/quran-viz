import { lazy, Suspense, useMemo, type ReactNode } from "react";
import { BarChart3, Map as MapIcon } from "lucide-react";
import type { QuranData } from "../types/quran";
import type { ReaderTarget } from "../components/charts/common";
import type { ExploreTarget } from "../components/reader/VerseContextPanel";
import { surahMapOf } from "../data/selectors";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { useI18n } from "../i18n/I18nContext";
import { SegmentedControl, Skeleton } from "../components/ui";

const PetaMushaf = lazy(() =>
  import("../components/peta/PetaMushaf").then((m) => ({ default: m.PetaMushaf })),
);

export type DashboardTab = "charts" | "map";
export const DASHBOARD_TAB_KEY = "qv.dashboard.tab";
const TABS: readonly DashboardTab[] = ["charts", "map"];

/** Dashboard: the charts, or the Peta Mushaf (the old Map view). */
export function DashboardPage({
  data,
  charts,
  lastRead,
  marked,
  onOpen,
  onExplore,
}: {
  data: QuranData;
  /** The charts view (DashboardView), rendered by App with its props. */
  charts: ReactNode;
  /** Ayah id last read, and the ayahs carrying a pin or in a collection. */
  lastRead?: number;
  marked: number[];
  onOpen: (t: ReaderTarget) => void;
  onExplore: (t: ExploreTarget) => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = usePersistentState<DashboardTab>(
    DASHBOARD_TAB_KEY,
    "charts",
    persisted.oneOf(TABS),
  );
  const surahMap = useMemo(() => surahMapOf(data.surahs), [data.surahs]);
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<DashboardTab>
        ariaLabel={t.dashboard.sections}
        value={tab}
        onChange={setTab}
        options={[
          {
            value: "charts",
            label: t.dashboard.charts,
            icon: <BarChart3 size={15} aria-hidden />,
          },
          {
            value: "map",
            label: t.dashboard.map,
            icon: <MapIcon size={15} aria-hidden />,
          },
        ]}
      />
      {tab === "charts" ? (
        charts
      ) : (
        <Suspense fallback={<Skeleton className="h-[calc(60*var(--zvh))]" />}>
          <PetaMushaf
            verses={data.verses}
            surahMap={surahMap}
            lastRead={lastRead}
            bookmarks={marked}
            onOpen={onOpen}
            onExplore={onExplore}
          />
        </Suspense>
      )}
    </div>
  );
}
