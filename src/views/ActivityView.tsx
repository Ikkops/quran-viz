import type { ReactNode } from "react";
import type { QuranData } from "../types/quran";
import type { ReaderTarget } from "../components/charts/common";
import type { Marks } from "../lib/marks";
import type { Messages } from "../i18n/en";
import { useReadingGoal } from "../lib/readingStore";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { useSwipePager } from "../lib/useSwipePager";
import { useI18n } from "../i18n/I18nContext";
import { SegmentedControl, cx } from "../components/ui";
import { ActivityPanel } from "../components/home/ActivityPanel";
import { MarksPanel } from "../components/marks/MarksPanel";
import { HifdhPanel } from "../components/hifdh/HifdhPanel";
import type { Hifdh } from "../lib/hifdh";

type ActivityProps = {
  data: QuranData;
  marks: Marks;
  onMarks: (m: Marks) => void;
  hifdh: Hifdh;
  onHifdh: (h: Hifdh) => void;
  onOpen: (t: ReaderTarget) => void;
  /** Global id of the newest last-read ayah, if any. */
  lastRead?: number;
};

function Stats({ data, lastRead }: ActivityProps) {
  const [goal, setGoal] = useReadingGoal();
  const page = lastRead ? (data.verses[lastRead - 1]?.page ?? 1) : 1;
  return <ActivityPanel goal={goal} onGoal={setGoal} currentPage={page} />;
}

// To add a tab, add one entry here (and its label in both i18n files).
const TABS = [
  {
    id: "stats",
    label: (t: Messages) => t.activity.tabs.stats,
    render: (p: ActivityProps) => <Stats {...p} />,
  },
  {
    id: "marks",
    label: (t: Messages) => t.activity.tabs.marks,
    render: (p: ActivityProps): ReactNode => (
      <MarksPanel data={p.data} marks={p.marks} onMarks={p.onMarks} onOpen={p.onOpen} />
    ),
  },
  {
    id: "hifdh",
    label: (t: Messages) => t.activity.tabs.hifdh,
    render: (p: ActivityProps): ReactNode => (
      <HifdhPanel data={p.data} hifdh={p.hifdh} onHifdh={p.onHifdh} onOpen={p.onOpen} />
    ),
  },
] as const;

export type ActivityTab = (typeof TABS)[number]["id"];
export const ACTIVITY_TAB_KEY = "qv.activity.tab";
const TAB_IDS: readonly ActivityTab[] = TABS.map((x) => x.id);

/** Activity: reading time and streak, and the learner's pins and collections. */
export function ActivityView(props: ActivityProps) {
  const { t } = useI18n();
  const [tab, setTab] = usePersistentState<ActivityTab>(
    ACTIVITY_TAB_KEY,
    "stats",
    persisted.oneOf(TAB_IDS),
  );
  const index = Math.max(0, TAB_IDS.indexOf(tab));
  // A sideways swipe on the panel moves between tabs, stopping at the ends.
  const { handlers, sides, trackRef } = useSwipePager({
    current: tab,
    canGo: (d) => index + d >= 0 && index + d < TABS.length,
    onCommit: (d) => setTab(TAB_IDS[index + d]),
  });
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <SegmentedControl<ActivityTab>
        ariaLabel={t.activity.sections}
        value={tab}
        onChange={setTab}
        options={TABS.map((x) => ({ value: x.id, label: x.label(t) }))}
        fullWidth
      />
      {/* Clipped only while the neighbours are mounted (a swipe), so cards
          keep their shadows and focus rings. */}
      <div
        data-testid="activity-pager"
        className={cx(
          "touch-pan-y touch-pinch-zoom",
          sides.length > 0 && "overflow-hidden",
        )}
        {...handlers}
      >
        <div ref={trackRef} className="relative">
          {TABS[index].render(props)}
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
              {TABS[index + d].render(props)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
