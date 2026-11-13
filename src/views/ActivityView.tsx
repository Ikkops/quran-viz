import type { QuranData } from "../types/quran";
import type { ReaderTarget } from "../components/charts/common";
import type { Marks } from "../lib/marks";
import { useReadingGoal } from "../lib/readingStore";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { useI18n } from "../i18n/I18nContext";
import { SegmentedControl } from "../components/ui";
import { ActivityPanel } from "../components/home/ActivityPanel";
import { MarksPanel } from "../components/marks/MarksPanel";

export type ActivityTab = "stats" | "marks";
export const ACTIVITY_TAB_KEY = "qv.activity.tab";
const TABS: readonly ActivityTab[] = ["stats", "marks"];

/** Activity: reading time and streak, and the learner's pins and collections. */
export function ActivityView({
  data,
  marks,
  onMarks,
  onOpen,
}: {
  data: QuranData;
  marks: Marks;
  onMarks: (m: Marks) => void;
  onOpen: (t: ReaderTarget) => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = usePersistentState<ActivityTab>(
    ACTIVITY_TAB_KEY,
    "stats",
    persisted.oneOf(TABS),
  );
  const [goal, setGoal] = useReadingGoal();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <SegmentedControl<ActivityTab>
        ariaLabel={t.activity.sections}
        value={tab}
        onChange={setTab}
        options={TABS.map((x) => ({ value: x, label: t.activity.tabs[x] }))}
      />
      {tab === "stats" ? (
        <ActivityPanel goal={goal} onGoal={setGoal} />
      ) : (
        <MarksPanel data={data} marks={marks} onMarks={onMarks} onOpen={onOpen} />
      )}
    </div>
  );
}
