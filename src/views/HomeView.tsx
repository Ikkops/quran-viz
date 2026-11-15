import type { Hifdh } from "../lib/hifdh";
import { useHifdhPlan } from "../components/hifdh/plan";
import { useMemo } from "react";
import {
  ListChecks,
  BookOpen,
  Flame,
  History,
  Bookmark as BookmarkIcon,
  Pin as PinIcon,
} from "lucide-react";
import type { Marks, Pin } from "../lib/marks";
import type { QuranData } from "../types/quran";
import type { ReaderTarget } from "../components/charts/common";
import { currentStreak, dayDate, dayKey } from "../data/readingLog";
import { useReadingGoal, useReadingLog } from "../lib/readingStore";
import type { ReadStretch } from "../lib/lastRead";
import { useI18n } from "../i18n/I18nContext";
import { Button, cx } from "../components/ui";
import { QuranIndex } from "../components/home/QuranIndex";
import { KhatamRow } from "../components/home/Khatam";
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
  hifdh,
  onHifdhPlan,
  marks,
}: {
  data: QuranData;
  /** Where recent reading stopped, newest first (already cut to the setting). */
  lastReads: ReadStretch[];
  onOpen: (t: ReaderTarget) => void;
  onSearch: () => void;
  onActivity: () => void;
  /** What the learner has memorised, and the way to today's plan. */
  hifdh: Hifdh;
  onHifdhPlan: () => void;
  /** Pins and collections, shown on the last-read cards of their surah. */
  marks: Marks;
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
  // Per surah: its placed pins (by ayah) and how many of its ayahs are saved.
  const marksBySurah = useMemo(() => {
    const out = new Map<number, { pins: (Pin & { a: number })[]; saved: number }>();
    const entry = (s: number) => {
      let e = out.get(s);
      if (!e) out.set(s, (e = { pins: [], saved: 0 }));
      return e;
    };
    for (const p of marks.pins) {
      const v = p.ayah ? data.verses[p.ayah - 1] : undefined;
      if (v) entry(v.s).pins.push({ ...p, a: v.a });
    }
    const saved = new Set(marks.collections.flatMap((c) => c.items.map((i) => i.id)));
    for (const id of saved) {
      const v = data.verses[id - 1];
      if (v) entry(v.s).saved++;
    }
    for (const e of out.values()) e.pins.sort((x, y) => x.a - y.a);
    return out;
  }, [marks, data.verses]);
  const { plan } = useHifdhPlan(hifdh, data.verses);
  const hasHifdh = /[123]/.test(hifdh.status);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      {/* Where reading starts: carry on (or begin), then today against the goal. */}
      <div className="flex flex-col gap-4">
        <section aria-label={h.lastRead} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-eyebrow text-ink-subtle">
            <History size={14} aria-hidden /> {h.lastRead}
          </h2>
          {lastReads.length === 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button
                variant="primary"
                icon={<BookOpen size={16} aria-hidden />}
                onClick={() => onOpen({ scope: "surah", value: 1 })}
              >
                {t.app.startReading}
              </Button>
              <span className="text-sm text-ink-muted">
                {h.startAt(data.surahs[0]?.name ?? "")}
              </span>
            </div>
          ) : (
            // One row that scrolls sideways, bleeding past main's px-4 so a cut-off card shows there is more.
            <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4">
              {lastReads.map((e, i) => {
                const v = data.verses[e.id - 1];
                const s = data.surahs.find((x) => x.id === e.s);
                if (!v || !s) return null;
                const m = marksBySurah.get(e.s);
                return (
                  <button
                    key={e.s}
                    type="button"
                    onClick={() => onOpen(lastReadTarget(e))}
                    className={cx(
                      "flex min-h-[3.25rem] w-44 shrink-0 snap-start flex-col justify-center gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                      i === 0
                        ? "border-illumination bg-illumination/10 hover:bg-illumination/15"
                        : "border-line bg-surface hover:bg-surface-sunken",
                    )}
                  >
                    <span className="truncate text-heading text-ink">
                      {s.name}{" "}
                      <span className="font-normal tabular-nums text-ink-muted">
                        {v.s}:{v.a}
                      </span>
                    </span>
                    <span className="truncate text-xs text-ink-subtle">{ago(e.at)}</span>
                    {m && (
                      <span className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-xs tabular-nums text-ink-muted">
                        <span className="sr-only">
                          {[
                            m.pins.length > 0 &&
                              h.pinsAt(m.pins.map((p) => n(p.a)).join(", ")),
                            m.saved > 0 && h.savedCount(m.saved, n(m.saved)),
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                        {m.pins.slice(0, 2).map((p) => (
                          <span
                            key={p.id}
                            aria-hidden
                            className="flex shrink-0 items-center gap-0.5"
                          >
                            <PinIcon
                              size={12}
                              style={{ color: p.color }}
                              fill={p.color}
                            />
                            {n(p.a)}
                          </span>
                        ))}
                        {m.pins.length > 2 && (
                          <span aria-hidden className="shrink-0">
                            +{n(m.pins.length - 2)}
                          </span>
                        )}
                        {m.saved > 0 && (
                          <span
                            aria-hidden
                            className="flex shrink-0 items-center gap-0.5"
                          >
                            <BookmarkIcon size={12} className="text-ink-subtle" />
                            {n(m.saved)}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={onActivity}
          className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left shadow-soft transition-colors hover:bg-surface-sunken"
        >
          <Flame
            size={20}
            aria-hidden
            className={cx(
              "shrink-0",
              todaySec >= goal * 60 ? "text-illumination" : "text-ink-subtle",
            )}
          />
          <span className="min-w-0 flex-1 text-heading tabular-nums text-ink">
            {h.todayLine(t.activity.duration(todaySec), goal)}
          </span>
          <span className="shrink-0 text-sm tabular-nums text-ink-muted">
            {h.streakLine(n(streak))}
          </span>
        </button>

        <KhatamRow
          currentPage={(lastReads[0] && data.verses[lastReads[0].id - 1]?.page) || 1}
          onOpen={() =>
            onOpen(
              lastReads[0] ? lastReadTarget(lastReads[0]) : { scope: "surah", value: 1 },
            )
          }
        />

        {hasHifdh && (
          <button
            type="button"
            onClick={onHifdhPlan}
            className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left shadow-soft transition-colors hover:bg-surface-sunken"
          >
            <ListChecks size={20} aria-hidden className="shrink-0 text-ink-subtle" />
            <span className="min-w-0 flex-1 text-heading text-ink">
              {t.hifdh.homeTitle}
            </span>
            <span className="shrink-0 text-sm tabular-nums text-ink-muted">
              {t.hifdh.homeLine(
                n(plan.learning.length),
                n(plan.recent.length),
                n(plan.old.length),
              )}
            </span>
          </button>
        )}
      </div>

      <QuranIndex data={data} onOpen={onOpen} onSearch={onSearch} />
    </div>
  );
}
