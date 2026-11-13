import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ACTIVITY_PERIODS,
  GOAL_CHOICES,
  activityView,
  currentStreak,
  dayDate,
  dayKey,
  longestStreak,
  shiftAnchor,
  type ActivityBucket,
  type ActivityPeriod,
  type ActivityView,
} from "../../data/readingLog";
import { useReadingLog } from "../../lib/readingStore";
import { persisted, usePersistentState } from "../../lib/usePersistentState";
import { useI18n } from "../../i18n/I18nContext";
import { Card, QuietIconButton, SegmentedControl, cx } from "../ui";

function useDateFormats() {
  const { lang } = useI18n();
  return useMemo(() => {
    const locale = lang === "id" ? "id-ID" : "en-GB";
    const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o);
    const weekday = f({ weekday: "short" });
    const day = f({ day: "numeric" });
    const month = f({ month: "short" });
    const monthYear = f({ month: "long", year: "numeric" });
    const shortMonthYear = f({ month: "short", year: "2-digit" });
    const full = f({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const dayMonth = f({ day: "numeric", month: "short" });
    const dayMonthYear = f({ day: "numeric", month: "short", year: "numeric" });
    return {
      /** Axis label under a bar. */
      tick: (b: ActivityBucket, view: ActivityView) => {
        const d = dayDate(b.from);
        if (view.period === "week") return weekday.format(d);
        if (view.unit === "day") return day.format(d);
        if (view.unit === "year") return b.from.slice(0, 4);
        return view.period === "all" ? shortMonthYear.format(d) : month.format(d);
      },
      /** What a bar covers, for the readout and screen readers. */
      bucket: (b: ActivityBucket, view: ActivityView) => {
        const d = dayDate(b.from);
        if (view.unit === "day") return full.format(d);
        if (view.unit === "year") return b.from.slice(0, 4);
        return monthYear.format(d);
      },
      /** The period's own name: "8–14 Nov 2026", "November 2026", "2026". */
      range: (view: ActivityView) => {
        const from = dayDate(view.from);
        const to = dayDate(view.to);
        if (view.period === "week")
          return `${dayMonth.format(from)} – ${dayMonthYear.format(to)}`;
        if (view.period === "month") return monthYear.format(from);
        if (view.period === "year") return view.from.slice(0, 4);
        return null;
      },
    };
  }, [lang]);
}

function Stat({
  label,
  value,
  note,
  done,
}: {
  label: string;
  value: string;
  note?: string;
  done?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5">
      <p className="truncate text-xs text-ink-subtle">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xl font-semibold tabular-nums text-ink">
        <span className="truncate">{value}</span>
        {done && <Check size={17} className="shrink-0 text-illumination" aria-hidden />}
      </p>
      {note && <p className="truncate text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

/** Bars for one period. A bar is a button: pressing it pins its figures in the
 *  readout under the chart (the same figures are its accessible name). */
function Bars({
  view,
  goalSec,
  picked,
  onPick,
  describe,
  tick,
}: {
  view: ActivityView;
  goalSec: number;
  picked: number | null;
  onPick: (i: number | null) => void;
  describe: (b: ActivityBucket) => string;
  tick: (b: ActivityBucket) => string;
}) {
  const daily = view.unit === "day";
  const top = Math.max(daily ? goalSec : 0, ...view.buckets.map((b) => b.seconds), 1);
  const n = view.buckets.length;
  // Month by day has 28–31 bars: label every fifth so the axis stays readable.
  const every = n > 16 ? 5 : n > 12 ? 2 : 1;
  return (
    <div className="relative">
      <div className="relative flex h-40 items-end gap-[3px]">
        {daily && (
          // The daily goal, as a hairline across the bars.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-subtle/60"
            style={{ bottom: `${(100 * goalSec) / top}%` }}
          />
        )}
        {view.buckets.map((b, i) => {
          const metGoal = daily ? b.seconds >= goalSec : b.seconds > 0;
          return (
            <button
              key={b.from}
              type="button"
              disabled={b.future}
              onClick={() => onPick(picked === i ? null : i)}
              aria-pressed={picked === i}
              aria-label={describe(b)}
              title={describe(b)}
              className="group flex h-full min-w-0 flex-1 items-end rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-illumination"
            >
              <span
                className={cx(
                  "block w-full rounded-t-sm transition-[height] motion-reduce:transition-none",
                  b.seconds === 0
                    ? "bg-line"
                    : metGoal
                      ? "bg-illumination"
                      : "bg-illumination/45",
                  picked === i && "ring-2 ring-ink ring-offset-1 ring-offset-surface",
                )}
                style={{
                  height:
                    b.seconds === 0 ? "2px" : `${Math.max(3, (100 * b.seconds) / top)}%`,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px]" aria-hidden>
        {view.buckets.map((b, i) => (
          <span
            key={b.from}
            className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-xs tabular-nums text-ink-subtle"
          >
            {i % every === 0 ? tick(b) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Reading time and streak: today against the goal, the current and longest
 * streak, and time per week, month, year or for all time, with earlier
 * periods one step away.
 */
export function ActivityPanel({
  goal,
  onGoal,
}: {
  /** Daily goal in minutes (owned by Home, which shows it too). */
  goal: number;
  onGoal: (minutes: number) => void;
}) {
  const { t, n } = useI18n();
  const a = t.activity;
  const log = useReadingLog();
  const goalSec = goal * 60;
  const [period, setPeriod] = usePersistentState<ActivityPeriod>(
    "qv.activity.period",
    "week",
    persisted.oneOf(ACTIVITY_PERIODS),
  );
  const today = dayKey(new Date());
  const [anchor, setAnchor] = useState(today);
  const [picked, setPicked] = useState<number | null>(null);
  const fmt = useDateFormats();

  const view = useMemo(
    () => activityView(log, period, anchor, today, goalSec),
    [log, period, anchor, today, goalSec],
  );
  const streak = currentStreak(log, today, goalSec);
  const longest = longestStreak(log, goalSec);
  const allSeconds = useMemo(() => Object.values(log).reduce((x, s) => x + s, 0), [log]);
  const allDays = Object.keys(log).length;
  const todaySec = log[today] ?? 0;

  const describe = (b: ActivityBucket) =>
    view.unit === "day"
      ? `${fmt.bucket(b, view)}: ${a.duration(b.seconds)}`
      : `${fmt.bucket(b, view)}: ${a.duration(b.seconds)}, ${a.daysRead(b.daysRead)}`;
  const move = (delta: 1 | -1) => {
    setAnchor(shiftAnchor(period, anchor, delta));
    setPicked(null);
  };
  const pickedBucket = picked !== null ? view.buckets[picked] : null;
  const rangeName = fmt.range(view);

  return (
    <section aria-label={a.title} className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
        <Stat
          label={a.today}
          value={a.duration(todaySec)}
          note={a.ofGoal(goal)}
          done={todaySec >= goalSec}
        />
        <Stat label={a.streak} value={a.days(streak)} note={a.streakNote(goal)} />
        <Stat label={a.longest} value={a.days(longest)} />
        <Stat label={a.total} value={a.duration(allSeconds)} note={a.daysRead(allDays)} />
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl<ActivityPeriod>
            ariaLabel={a.period}
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setAnchor(today);
              setPicked(null);
            }}
            options={ACTIVITY_PERIODS.map((p) => ({ value: p, label: a.periods[p] }))}
          />
          {rangeName && (
            <div className="flex items-center gap-1">
              <QuietIconButton
                label={a.earlier}
                onClick={() => move(-1)}
                disabled={!view.hasPrev}
              >
                <ChevronLeft size={18} />
              </QuietIconButton>
              <p
                className="min-w-[8.5rem] text-center text-sm font-medium tabular-nums text-ink"
                aria-live="polite"
              >
                {rangeName}
              </p>
              <QuietIconButton
                label={a.later}
                onClick={() => move(1)}
                disabled={!view.hasNext}
              >
                <ChevronRight size={18} />
              </QuietIconButton>
            </div>
          )}
        </div>

        <Bars
          view={view}
          goalSec={goalSec}
          picked={picked}
          onPick={setPicked}
          describe={describe}
          tick={(b) => fmt.tick(b, view)}
        />

        <p className="min-h-[1.25rem] text-sm text-ink-muted" aria-live="polite">
          {pickedBucket ? (
            <span className="font-medium text-ink">{describe(pickedBucket)}</span>
          ) : allDays === 0 ? (
            a.empty
          ) : (
            a.summary(
              a.duration(view.seconds),
              n(view.daysRead),
              n(view.daysElapsed),
              a.duration(view.daysRead > 0 ? view.seconds / view.daysRead : 0),
            )
          )}
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          {a.goal}
          <select
            value={goal}
            onChange={(e) => onGoal(Number(e.target.value))}
            className="min-h-10 rounded-md border border-line bg-surface px-2 text-sm text-ink touch:min-h-11"
          >
            {GOAL_CHOICES.map((g) => (
              <option key={g} value={g}>
                {a.minutes(g)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-ink-subtle">{a.how}</p>
      </div>
    </section>
  );
}
