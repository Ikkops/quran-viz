import { useMemo } from "react";
import { Search } from "lucide-react";
import type { ChronologyData, QuranData, RevelationType, Surah } from "../types/quran";
import { exceptionsBySurah, surahMapOf } from "../data/selectors";
import { divisionCards, type DivisionCard } from "../data/sections";
import { asbabCountBySurah, ceRange, groupByTimeline } from "../data/chronology";
import { useChronology } from "../data/useChronology";
import { useAsbab } from "../data/useAsbab";
import type { Palette } from "../theme/palettes";
import type { PlaceException } from "../data/selectors";
import { normalizeArabic } from "../data/arabic";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { Card, SectionTitle, SegmentedControl, Select, cx } from "../components/ui";
import { SurahCard } from "../components/cards/SurahCard";
import { placeColor, type ReaderTarget } from "../components/charts/common";

type Kind = "surah" | "juz" | "manzil";
type SurahSort = "mushaf" | "revelation" | "timeline" | "ayahs" | "words";
type TypeFilter = "all" | RevelationType;

export function BrowseView({
  data,
  onOpen,
}: {
  data: QuranData;
  onOpen: (t: ReaderTarget) => void;
}) {
  const { palette } = useTheme();
  const i18n = useI18n();
  const { t } = i18n;
  const [kind, setKind] = usePersistentState<Kind>(
    "qv.browse.kind",
    "surah",
    persisted.oneOf(["surah", "juz", "manzil"] as const),
  );
  const [query, setQuery] = usePersistentState("qv.browse.query", "");
  const [sort, setSort] = usePersistentState<SurahSort>(
    "qv.browse.sort",
    "mushaf",
    persisted.oneOf(["mushaf", "revelation", "timeline", "ayahs", "words"] as const),
  );
  const [type, setType] = usePersistentState<TypeFilter>(
    "qv.browse.type",
    "all",
    persisted.oneOf(["all", "Meccan", "Medinan"] as const),
  );

  const surahMap = useMemo(() => surahMapOf(data.surahs), [data.surahs]);
  const exceptions = useMemo(() => exceptionsBySurah(data.verses), [data.verses]);
  const juzCards = useMemo(() => divisionCards(data.verses, "juz"), [data.verses]);
  const manzilCards = useMemo(() => divisionCards(data.verses, "manzil"), [data.verses]);
  const timeline = kind === "surah" && sort === "timeline";
  const chronoState = useChronology(timeline);
  const asbabState = useAsbab(timeline);
  const asbabCounts = useMemo(
    () => (asbabState.data ? asbabCountBySurah(asbabState.data, data.verses) : null),
    [asbabState.data, data.verses],
  );

  const surahs = useMemo(() => {
    const q = query.trim();
    const qn = normalizeArabic(q);
    const lower = q.toLowerCase().replace(/[-'\s]/g, "");
    const list = data.surahs.filter((s) => {
      if (type !== "all" && s.type !== type) return false;
      if (!q) return true;
      if (/^\d+$/.test(q)) return String(s.id) === q;
      return (
        s.nameEn
          .toLowerCase()
          .replace(/[-'\s]/g, "")
          .includes(lower) ||
        s.meaning.toLowerCase().includes(q.toLowerCase()) ||
        i18n.meaning(s).toLowerCase().includes(q.toLowerCase()) ||
        normalizeArabic(s.nameAr).includes(qn)
      );
    });
    const by: Record<SurahSort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      mushaf: (a, b) => a.id - b.id,
      revelation: (a, b) => a.revelationOrder - b.revelationOrder,
      timeline: (a, b) => a.revelationOrder - b.revelationOrder,
      ayahs: (a, b) => b.ayahCount - a.ayahCount,
      words: (a, b) => b.wordCount - a.wordCount,
    };
    return [...list].sort(by[sort]);
  }, [data.surahs, query, type, sort, i18n]);

  const subtitle =
    kind === "surah"
      ? `${t.browse.surahSub(surahs.length)} ${t.placeCaveat}`
      : kind === "juz"
        ? t.browse.juzSub
        : t.browse.manzilSub;

  return (
    <Card className="p-4">
      <SectionTitle
        title={t.browse.title}
        subtitle={subtitle}
        right={
          <SegmentedControl<Kind>
            value={kind}
            onChange={setKind}
            ariaLabel={t.browse.browseBy}
            options={[
              { value: "surah", label: t.scope.surah },
              { value: "juz", label: t.scope.juz },
              { value: "manzil", label: t.scope.manzil },
            ]}
          />
        }
      />

      {kind === "surah" && (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.browse.filterPh}
                aria-label={t.browse.filterAria}
                className="w-60 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <div className="w-44">
              <Select
                label={t.browse.sort}
                value={sort}
                onChange={(e) => setSort(e.target.value as SurahSort)}
              >
                <option value="mushaf">{t.browse.mushaf}</option>
                <option value="revelation">{t.browse.revelation}</option>
                <option value="timeline">{t.browse.timeline}</option>
                <option value="ayahs">{t.browse.mostAyahs}</option>
                <option value="words">{t.browse.mostWords}</option>
              </Select>
            </div>
            <SegmentedControl<TypeFilter>
              value={type}
              onChange={setType}
              ariaLabel={t.browse.placeAria}
              options={[
                { value: "all", label: t.common.all },
                { value: "Meccan", label: t.place.Meccan },
                { value: "Medinan", label: t.place.Medinan },
              ]}
            />
          </div>
          {surahs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {t.browse.noMatch(query)}
            </p>
          ) : timeline ? (
            chronoState.data ? (
              <Timeline
                surahs={surahs}
                chrono={chronoState.data}
                keepEmpty={!query.trim() && type === "all"}
                exceptions={exceptions}
                asbabCounts={asbabCounts}
                palette={palette}
                onOpen={(id) => onOpen({ scope: "surah", value: id })}
              />
            ) : (
              <div
                className={
                  chronoState.error
                    ? "flex flex-col items-center gap-2 py-10 text-sm text-rose-500"
                    : "py-10 text-center text-sm text-slate-400"
                }
                role={chronoState.error ? "alert" : "status"}
              >
                {chronoState.error
                  ? t.common.failedToLoad(chronoState.error)
                  : t.browse.timelineLoading}
                {chronoState.error && (
                  <button
                    type="button"
                    onClick={chronoState.retry}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {t.common.retry}
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {surahs.map((s) => (
                <SurahCard
                  key={s.id}
                  surah={s}
                  exceptions={exceptions.get(s.id) ?? []}
                  palette={palette}
                  onOpen={() => onOpen({ scope: "surah", value: s.id })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {kind !== "surah" && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(kind === "juz" ? juzCards : manzilCards).map((c) => (
            <DivisionCardView
              key={c.n}
              card={c}
              kind={kind}
              nameAr={kind === "juz" ? data.meta.juzs[c.n - 1]?.nameAr : undefined}
              surahName={(s) => surahMap.get(s)?.nameEn ?? String(s)}
              surahColor={(s) => placeColor(surahMap.get(s)?.type ?? "Meccan", palette)}
              onOpen={() => onOpen({ scope: kind, value: c.n })}
            />
          ))}
        </div>
      )}
      {kind === "manzil" && (
        <p className="mt-3 text-[11px] text-slate-400">{t.browse.manzilNote}</p>
      )}
    </Card>
  );
}

const GRID = "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/** Surah cards grouped by phase → period → marker event (curated chronology). */
function Timeline({
  surahs,
  chrono,
  keepEmpty,
  exceptions,
  asbabCounts,
  palette,
  onOpen,
}: {
  surahs: Surah[];
  chrono: ChronologyData;
  keepEmpty: boolean;
  exceptions: Map<number, PlaceException[]>;
  asbabCounts: Map<number, number> | null;
  palette: Palette;
  onOpen: (surah: number) => void;
}) {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const phases = useMemo(
    () => groupByTimeline(surahs, chrono, keepEmpty),
    [surahs, chrono, keepEmpty],
  );
  const chips = (s: Surah): string[] => {
    const e = chrono.surahs[String(s.id)];
    const out: string[] = [];
    if (e?.span) out.push(t.card.span(...e.span));
    const n = asbabCounts?.get(s.id);
    if (n) out.push(t.card.asbab(n));
    if (e?.basis === "urutan") out.push(t.card.inferred);
    return out;
  };
  const cardGrid = (list: Surah[]) => (
    <div className={GRID}>
      {list.map((s) => (
        <SurahCard
          key={s.id}
          surah={s}
          exceptions={exceptions.get(s.id) ?? []}
          palette={palette}
          extra={chips(s)}
          onOpen={() => onOpen(s.id)}
        />
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        {t.browse.timelineNote}
      </p>
      {phases.map(({ phase, periods }) => {
        const color = placeColor(phase, palette);
        return (
          <section key={phase} className="flex flex-col gap-4">
            <h3
              className="rounded-lg px-3 py-1.5 text-sm font-semibold"
              style={{ backgroundColor: `${color}1f`, color }}
            >
              {t.browse.phase(i18n.place(phase), ceRange(periods.map((p) => p.period)))}
            </h3>
            <ol className="flex flex-col">
              {periods.map(({ period, groups }) => (
                <li
                  key={period.id}
                  className="relative border-l-2 pb-5 pl-5 last:pb-0"
                  style={{ borderColor: `${color}55` }}
                >
                  <span
                    className="absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100">
                      {period.label[lang]}
                    </h4>
                    <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {period.phase === "Meccan" ? `${period.when[lang]} · ` : ""}
                      {t.browse.periodCe(period.ce)}
                    </span>
                  </div>
                  {groups.length === 0 && (
                    <p className="mb-1.5 text-xs italic text-slate-400">
                      {t.browse.noSurahs}
                    </p>
                  )}
                  <div className="flex flex-col gap-3">
                    {/* Every event in chronological order: with its surahs, or as a bare line. */}
                    {period.events.map((ev, i) => {
                      const g = groups.find((x) => x.event === i);
                      return (
                        <div key={i}>
                          <p
                            className={cx(
                              "text-xs",
                              g
                                ? "mb-1.5 font-medium text-slate-600 dark:text-slate-300"
                                : "text-slate-500 dark:text-slate-400",
                            )}
                          >
                            {ev.label[lang]}
                            <span className="font-normal text-slate-400">
                              {" "}
                              · {ev.when[lang]}
                            </span>
                          </p>
                          {g && cardGrid(g.surahs)}
                        </div>
                      );
                    })}
                    {groups
                      .filter((g) => g.event === null)
                      .map((g) => (
                        <div key="none">
                          {period.events.length > 0 && (
                            <p className="mb-1.5 text-xs text-slate-400">
                              {t.browse.noMarker}
                            </p>
                          )}
                          {cardGrid(g.surahs)}
                        </div>
                      ))}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function DivisionCardView({
  card,
  kind,
  nameAr,
  surahName,
  surahColor,
  onOpen,
}: {
  card: DivisionCard;
  kind: "juz" | "manzil";
  nameAr?: string;
  surahName: (s: number) => string;
  surahColor: (s: number) => string;
  onOpen: () => void;
}) {
  const { t, n } = useI18n();
  const span = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`);
  const shown = card.surahs.slice(0, 8);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-100">
            {t.scope[kind]} {card.n}
          </div>
          <div className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {card.first.s}:{card.first.a} → {card.last.s}:{card.last.a}
          </div>
        </div>
        {nameAr && (
          <span className="font-arabic text-base leading-tight text-slate-700 dark:text-slate-200">
            {nameAr.replace(/^الجزء\s+/, "")}
          </span>
        )}
      </div>
      {/* Each surah's share of the division, coloured by its classification. */}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
        {card.surahs.map((x) => (
          <span
            key={x.s}
            style={{
              width: `${(x.ayahs / card.ayahs) * 100}%`,
              backgroundColor: surahColor(x.s),
            }}
            className="border-r border-white/60 last:border-r-0 dark:border-slate-800/60"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {shown.map((x) => (
          <span
            key={x.s}
            className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            {x.s}. {surahName(x.s)}
          </span>
        ))}
        {card.surahs.length > shown.length && (
          <span className="px-1 py-0.5 text-[11px] text-slate-400">
            {t.browse.more(card.surahs.length - shown.length)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
        <Stat value={card.ayahs} label={t.browse.ayahs} />
        <Stat value={n(card.words)} label={t.browse.words} />
        <Stat value={span(...card.pages)} label={t.browse.pages} />
        {kind === "manzil" ? (
          <Stat value={span(...card.juzs)} label={t.browse.juz} />
        ) : (
          <Stat value={card.surahs.length} label={t.browse.surahs} />
        )}
      </div>
    </button>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </div>
      {label}
    </div>
  );
}
