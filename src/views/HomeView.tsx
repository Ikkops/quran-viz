import { useMemo } from "react";
import { BookOpen, Flame, Search } from "lucide-react";
import type { QuranData, Surah } from "../types/quran";
import type { ReaderTarget } from "../components/charts/common";
import { currentStreak, dayKey } from "../data/readingLog";
import { useReadingGoal, useReadingLog } from "../lib/readingStore";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { searchKeyArabic } from "../data/arabic";
import { useI18n } from "../i18n/I18nContext";
import { SegmentedControl, cx } from "../components/ui";
import { ActivityPanel } from "../components/home/ActivityPanel";

type HomeTab = "surah" | "juz" | "activity";
const TABS: readonly HomeTab[] = ["surah", "juz", "activity"];

/** Latin letters only, lower-case: "Al-Baqara" and "al baqara" match. */
const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]/g, "");

function SurahRow({ s, onOpen }: { s: Surah; onOpen: () => void }) {
  const i = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[3.25rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken dark:hover:bg-surface"
    >
      <span className="w-7 shrink-0 text-right text-sm tabular-nums text-ink-subtle">
        {s.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-ink">{s.nameEn}</span>
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span
            aria-hidden
            className={cx(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              s.type === "Meccan" ? "bg-makki" : "bg-madani",
            )}
          />
          <span className="truncate">
            {i.place(s.type)} · {i.t.home.ayahs(s.ayahCount)} · {i.meaning(s)}
          </span>
        </span>
      </span>
      <span lang="ar" dir="rtl" className="shrink-0 font-reading text-xl text-ink">
        {/* The row already says it is a surah: drop the leading "سورة". */}
        {s.nameAr.replace(/^سُ?ورَ?ةُ?\s+/, "")}
      </span>
    </button>
  );
}

/**
 * Home: where reading starts. Continue where you stopped, today's reading
 * against the goal, then one index at a time: surahs (filterable), juz, or the
 * Activity page.
 */
export function HomeView({
  data,
  lastRead,
  lastReadId,
  onOpen,
  onSearch,
}: {
  data: QuranData;
  lastRead: ReaderTarget | null;
  /** The ayah last read (its anchor, else the first ayah of its scope). */
  lastReadId?: number;
  onOpen: (t: ReaderTarget) => void;
  onSearch: () => void;
}) {
  const { t, n } = useI18n();
  const h = t.home;
  const [tab, setTab] = usePersistentState<HomeTab>(
    "qv.home.tab",
    "surah",
    persisted.oneOf(TABS),
  );
  const [query, setQuery] = usePersistentState("qv.home.query", "");
  const log = useReadingLog();
  const [goal, setGoal] = useReadingGoal();
  const today = dayKey(new Date());
  const todaySec = log[today] ?? 0;
  const streak = currentStreak(log, today, goal * 60);

  const last = lastReadId ? data.verses[lastReadId - 1] : undefined;
  const lastSurah = last ? data.surahs.find((s) => s.number === last.s) : undefined;

  const surahs = useMemo(() => {
    const q = query.trim();
    if (!q) return data.surahs;
    if (/^\d+$/.test(q)) return data.surahs.filter((s) => String(s.number).startsWith(q));
    const latin = plain(q);
    const arabic = searchKeyArabic(q);
    return data.surahs.filter(
      (s) =>
        (latin !== "" && plain(s.nameEn).includes(latin)) ||
        (arabic !== "" && searchKeyArabic(s.nameAr).includes(arabic)),
    );
  }, [data.surahs, query]);

  // Each juz with the ayah it opens on.
  const juzs = useMemo(() => {
    const out: { juz: number; s: number; a: number; name: string }[] = [];
    for (const v of data.verses) {
      if (out.length >= v.juz) continue;
      const s = data.surahs.find((x) => x.number === v.s);
      out.push({ juz: v.juz, s: v.s, a: v.a, name: s?.nameEn ?? "" });
    }
    return out;
  }, [data]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-3">
        <button
          type="button"
          onClick={() => onOpen(lastRead ?? { scope: "surah", value: 1 })}
          className="flex items-center gap-3 rounded-xl bg-illumination px-4 py-3 text-left text-white transition-opacity hover:opacity-90 dark:text-paper"
        >
          <BookOpen size={22} aria-hidden className="shrink-0" />
          <span className="min-w-0">
            <span className="block text-base font-semibold">
              {lastRead ? t.app.continueReading : t.app.startReading}
            </span>
            <span className="block truncate text-sm opacity-90">
              {last && lastSurah
                ? `${lastSurah.nameEn} ${last.s}:${last.a}`
                : h.startAt(data.surahs[0]?.nameEn ?? "")}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("activity")}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-ink-subtle"
        >
          <Flame
            size={22}
            aria-hidden
            className={cx(
              "shrink-0",
              todaySec >= goal * 60 ? "text-illumination" : "text-ink-subtle",
            )}
          />
          <span className="min-w-0">
            <span className="block text-base font-semibold tabular-nums text-ink">
              {h.todayLine(t.activity.duration(todaySec), goal)}
            </span>
            <span className="block truncate text-sm text-ink-muted">
              {h.streakLine(n(streak))}
            </span>
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<HomeTab>
          ariaLabel={h.sections}
          value={tab}
          onChange={setTab}
          options={TABS.map((x) => ({ value: x, label: h.tabs[x] }))}
        />
        {tab === "surah" && (
          <label className="relative min-w-[12rem] flex-1">
            <span className="sr-only">{h.filter}</span>
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={h.filter}
              className="min-h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle touch:min-h-11"
            />
          </label>
        )}
      </div>

      {tab === "surah" && (
        <section aria-label={h.tabs.surah}>
          {surahs.length === 0 ? (
            <p className="px-2 py-6 text-sm text-ink-muted">
              {h.noSurah}{" "}
              <button
                type="button"
                onClick={onSearch}
                className="font-medium text-illumination underline-offset-2 hover:underline"
              >
                {h.searchInstead}
              </button>
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-x-4">
              {surahs.map((s) => (
                <SurahRow
                  key={s.number}
                  s={s}
                  onOpen={() => onOpen({ scope: "surah", value: s.number })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "juz" && (
        <section
          aria-label={h.tabs.juz}
          className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4"
        >
          {juzs.map((j) => (
            <button
              key={j.juz}
              type="button"
              onClick={() => onOpen({ scope: "juz", value: j.juz })}
              className="flex min-h-[3.25rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken dark:hover:bg-surface"
            >
              <span className="w-7 shrink-0 text-right text-sm tabular-nums text-ink-subtle">
                {j.juz}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-medium text-ink">
                  {t.scope.juz} {j.juz}
                </span>
                <span className="block truncate text-xs tabular-nums text-ink-muted">
                  {j.name} {j.s}:{j.a}
                </span>
              </span>
            </button>
          ))}
        </section>
      )}

      {tab === "activity" && <ActivityPanel goal={goal} onGoal={setGoal} />}
    </div>
  );
}
