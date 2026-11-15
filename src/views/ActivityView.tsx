import type { ReactNode } from "react";
import type { QuranData } from "../types/quran";
import type { ReaderTarget } from "../components/charts/common";
import type { Marks } from "../lib/marks";
import type { Messages } from "../i18n/en";
import { useReadingGoal } from "../lib/readingStore";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { useI18n } from "../i18n/I18nContext";
import { SegmentedControl } from "../components/ui";
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
};

function Stats() {
  const [goal, setGoal] = useReadingGoal();
  return <ActivityPanel goal={goal} onGoal={setGoal} />;
}

// To add a tab, add one entry here (and its label in both i18n files).
const TABS = [
  { id: "stats", label: (t: Messages) => t.activity.tabs.stats, render: () => <Stats /> },
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
  const current = TABS.find((x) => x.id === tab) ?? TABS[0];
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <SegmentedControl<ActivityTab>
        ariaLabel={t.activity.sections}
        value={tab}
        onChange={setTab}
        options={TABS.map((x) => ({ value: x.id, label: x.label(t) }))}
        fullWidth
      />
      {current.render(props)}
    </div>
  );
}
