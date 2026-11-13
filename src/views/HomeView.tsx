import { BookOpen, Flame, History } from "lucide-react";
import type { QuranData } from "../types/quran";
import type { ReaderTarget } from "../components/charts/common";
import { currentStreak, dayDate, dayKey } from "../data/readingLog";
import { useReadingGoal, useReadingLog } from "../lib/readingStore";
import type { ReadStretch } from "../lib/lastRead";
import { useI18n } from "../i18n/I18nContext";
import { cx } from "../components/ui";
import { QuranIndex } from "../components/home/QuranIndex";
import { preferredDivision, scopeField } from "../components/reader/readerShared";

/** When a stretch was last read: "today, 14:05", "yesterday, 21:30",
 *  "3 days ago, 06:12", and past a week the date ("2 Nov, 06:12"). */
function useWhen() {
  const { lang } = useI18n();
  const locale = lang === "id" ? "id" : "en";
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const today = dayDate(dayKey(new Date())).getTime();
  return (at: number) => {
    if (!at) return "";
    const d = new Date(at);
    const days = Math.min(
      0,
      Math.round((dayDate(dayKey(d)).getTime() - today) / 86_400_000),
    );
    const day = days < -6 ? date.format(d) : rel.format(days, "day");
    return `${day}, ${time.format(d)}`;
  };
}

/**
 * Home: where reading starts. The places last read (one per stretch of
 * reading), today's time against the goal, then the index of surahs, juz and
 * manzils.
 */
export function HomeView({
  data,
  lastReads,
  onOpen,
  onSearch,
  onActivity,
}: {
  data: QuranData;
  /** Where recent reading stopped, newest first (already cut to the setting). */
  lastReads: ReadStretch[];
  onOpen: (t: ReaderTarget) => void;
  onSearch: () => void;
  onActivity: () => void;
}) {
  const { t, n } = useI18n();
  const h = t.home;
  const log = useReadingLog();
  const [goal] = useReadingGoal();
  const today = dayKey(new Date());
  const todaySec = log[today] ?? 0;
  const streak = currentStreak(log, today, goal * 60);
  // Back where you were, in the division you last read by (juz, page…).
  const lastReadTarget = (e: ReadStretch): ReaderTarget => {
    const d = preferredDivision();
    const v = data.verses[e.id - 1];
    return d === "surah" || !v
      ? { scope: "surah", value: e.s, anchor: e.id }
      : { scope: d, value: scopeField(v, d), anchor: e.id };
  };
  const ago = useWhen();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <section aria-label={h.lastRead} className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-subtle">
          <History size={15} aria-hidden /> {h.lastRead}
        </h2>
        {lastReads.length === 0 ? (
          <button
            type="button"
            onClick={() => onOpen({ scope: "surah", value: 1 })}
            className="flex items-center gap-3 self-start rounded-xl bg-illumination px-4 py-3 text-left text-white transition-opacity hover:opacity-90 dark:text-paper"
          >
            <BookOpen size={20} aria-hidden className="shrink-0" />
            <span>
              <span className="block text-base font-semibold">{t.app.startReading}</span>
              <span className="block text-sm opacity-90">
                {h.startAt(data.surahs[0]?.name ?? "")}
              </span>
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-2">
            {lastReads.map((e, i) => {
              const v = data.verses[e.id - 1];
              const s = data.surahs.find((x) => x.id === e.s);
              if (!v || !s) return null;
              return (
                <button
                  key={e.s}
                  type="button"
                  onClick={() => onOpen(lastReadTarget(e))}
                  className={cx(
                    "flex min-h-[3.25rem] flex-col justify-center rounded-xl border px-3 py-2 text-left transition-colors",
                    i === 0
                      ? "border-illumination bg-illumination/10 hover:bg-illumination/15"
                      : "border-line bg-surface hover:border-ink-subtle",
                  )}
                >
                  <span className="truncate text-base font-semibold text-ink">
                    {s.name}{" "}
                    <span className="font-normal tabular-nums text-ink-muted">
                      {v.s}:{v.a}
                    </span>
                  </span>
                  <span className="truncate text-xs text-ink-subtle">{ago(e.at)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={onActivity}
        className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-left transition-colors hover:border-ink-subtle"
      >
        <Flame
          size={20}
          aria-hidden
          className={cx(
            "shrink-0",
            todaySec >= goal * 60 ? "text-illumination" : "text-ink-subtle",
          )}
        />
        <span className="min-w-0 flex-1 text-base font-semibold tabular-nums text-ink">
          {h.todayLine(t.activity.duration(todaySec), goal)}
        </span>
        <span className="shrink-0 text-sm text-ink-muted">{h.streakLine(n(streak))}</span>
      </button>

      <QuranIndex data={data} onOpen={onOpen} onSearch={onSearch} />
    </div>
  );
}
