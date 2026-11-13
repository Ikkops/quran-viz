import { useMemo, useState } from "react";
import { LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import type { ChronologyData, QuranData, RevelationType, Surah } from "../../types/quran";
import { exceptionsBySurah, surahMapOf } from "../../data/selectors";
import { divisionCards, type DivisionCard } from "../../data/sections";
import { asbabCountBySurah, ceRange, groupByTimeline } from "../../data/chronology";
import { useChronology } from "../../data/useChronology";
import { useAsbab } from "../../data/useAsbab";
import type { Palette } from "../../theme/palettes";
import type { PlaceException } from "../../data/selectors";
import { normalizeArabic } from "../../data/arabic";
import { persisted, usePersistentState } from "../../lib/usePersistentState";
import { useTheme } from "../../theme/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";
import { SegmentedControl, Select, cx } from "../ui";
import { SurahCard } from "../cards/SurahCard";
import { placeColor, type ReaderTarget } from "../charts/common";
import { DivisionList, type SurahSort } from "../peta/SurahList";
import { SurahRow } from "./SurahRow";

type Kind = "surah" | "juz" | "manzil";
type Layout = "list" | "cards";
type TypeFilter = "all" | RevelationType;

/**
 * The index on Home: surahs, juz or manzils. Surahs come as two-line rows
 * (number, name, meaning and place, calligraphic name) or as cards; the
 * filter is always in reach, and sort, place and layout sit behind one
 * button so the head stays a single row.
 */
export function QuranIndex({
  data,
  onOpen,
  onSearch,
}: {
  data: QuranData;
  onOpen: (t: ReaderTarget) => void;
  /** Open the app-wide search (offered when the filter finds no surah). */
  onSearch: () => void;
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

  const [layout, setLayout] = usePersistentState<Layout>(
    "qv.browse.layout",
    "list",
    persisted.oneOf(["list", "cards"] as const),
  );
  const [optionsOpen, setOptionsOpen] = useState(false);
  const changed = sort !== "mushaf" || type !== "all" || layout !== "list";
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
        [s.nameEn, s.nameId].some((nm) =>
          nm
            .toLowerCase()
            .replace(/[-'\s]/g, "")
            .includes(lower),
        ) ||
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

  const note =
    kind === "surah"
      ? t.placeCaveat
      : kind === "juz"
        ? t.browse.juzSub
        : t.browse.manzilSub;

  return (
    <section aria-label={t.browse.title} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
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
        {kind === "surah" && (
          <label className="relative min-w-[10rem] flex-1">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.browse.filterPh}
              aria-label={t.browse.filterAria}
              className="min-h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle touch:min-h-11"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => setOptionsOpen((o) => !o)}
          aria-expanded={optionsOpen}
          aria-label={t.browse.options}
          title={t.browse.options}
          className={cx(
            "relative ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors touch:h-11 touch:w-11",
            optionsOpen
              ? "border-illumination text-illumination"
              : "border-line text-ink-muted hover:border-ink-subtle hover:text-ink",
          )}
        >
          <SlidersHorizontal size={17} aria-hidden />
          {changed && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-illumination"
            />
          )}
        </button>
      </div>

      {optionsOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3">
          {kind === "surah" && (
            <>
              <div className="w-44">
                <Select<SurahSort>
                  label={t.browse.sort}
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "mushaf", label: t.browse.mushaf },
                    { value: "revelation", label: t.browse.revelation },
                    { value: "timeline", label: t.browse.timeline },
                    { value: "ayahs", label: t.browse.mostAyahs },
                    { value: "words", label: t.browse.mostWords },
                  ]}
                />
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
            </>
          )}
          <SegmentedControl<Layout>
            value={layout}
            onChange={setLayout}
            ariaLabel={t.browse.layoutAria}
            options={[
              {
                value: "list",
                label: t.browse.layoutList,
                icon: <List size={15} aria-hidden />,
              },
              {
                value: "cards",
                label: t.browse.layoutCards,
                icon: <LayoutGrid size={15} aria-hidden />,
              },
            ]}
          />
          <p className="basis-full text-xs text-ink-subtle">{note}</p>
        </div>
      )}

      {kind === "surah" && (
        <>
          {surahs.length === 0 ? (
            <p className="px-2 py-6 text-sm text-ink-muted">
              {t.browse.noMatch(query)}{" "}
              <button
                type="button"
                onClick={onSearch}
                className="font-medium text-illumination underline-offset-2 hover:underline"
              >
                {t.home.searchInstead}
              </button>
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
                    : "py-10 text-center text-sm text-ink-subtle"
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
                    className="rounded-lg border border-ink-subtle px-3 py-1 text-xs font-medium text-ink-muted hover:bg-paper dark:hover:bg-surface"
                  >
                    {t.common.retry}
                  </button>
                )}
              </div>
            )
          ) : layout === "list" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-x-8">
              {surahs.map((x) => (
                <SurahRow
                  key={x.id}
                  s={x}
                  onOpen={() => onOpen({ scope: "surah", value: x.id })}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
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

      {kind !== "surah" && layout === "list" && (
        <DivisionList
          cards={kind === "juz" ? juzCards : manzilCards}
          kind={kind}
          juzNames={kind === "juz" ? (n) => data.meta.juzs[n - 1]?.nameAr : undefined}
          surahName={(s) => surahMap.get(s)?.name ?? String(s)}
          surahColor={(s) => placeColor(surahMap.get(s)?.type ?? "Meccan", palette)}
          onOpen={(n) => onOpen({ scope: kind, value: n })}
        />
      )}
      {kind !== "surah" && layout === "cards" && (
        <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
          {(kind === "juz" ? juzCards : manzilCards).map((c) => (
            <DivisionCardView
              key={c.n}
              card={c}
              kind={kind}
              nameAr={kind === "juz" ? data.meta.juzs[c.n - 1]?.nameAr : undefined}
              surahName={(s) => surahMap.get(s)?.name ?? String(s)}
              surahColor={(s) => placeColor(surahMap.get(s)?.type ?? "Meccan", palette)}
              onOpen={() => onOpen({ scope: kind, value: c.n })}
            />
          ))}
        </div>
      )}
      {kind === "manzil" && (
        <p className="mt-3 text-xs text-ink-subtle">{t.browse.manzilNote}</p>
      )}
    </section>
  );
}

const GRID = "grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]";

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
      <p className="text-xs leading-relaxed text-ink-muted dark:text-ink-subtle">
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
                    className="absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-2 ring-white dark:ring-paper"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h4 className="font-semibold text-ink">{period.label[lang]}</h4>
                    <span className="text-xs tabular-nums text-ink-muted dark:text-ink-subtle">
                      {period.phase === "Meccan" ? `${period.when[lang]} · ` : ""}
                      {t.browse.periodCe(period.ce)}
                    </span>
                  </div>
                  {groups.length === 0 && (
                    <p className="mb-1.5 text-xs italic text-ink-subtle">
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
                                ? "mb-1.5 font-medium text-ink-muted"
                                : "text-ink-muted dark:text-ink-subtle",
                            )}
                          >
                            {ev.label[lang]}
                            <span className="font-normal text-ink-subtle">
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
                            <p className="mb-1.5 text-xs text-ink-subtle">
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
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 text-left transition hover:-translate-y-0.5 hover:border-ink-subtle/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 dark:bg-surface/60 dark:hover:border-ink-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-ink">
            {t.scope[kind]} {card.n}
          </div>
          <div className="text-xs tabular-nums text-ink-muted dark:text-ink-subtle">
            {card.first.s}:{card.first.a} → {card.last.s}:{card.last.a}
          </div>
        </div>
        {nameAr && (
          <span lang="ar" className="font-arabic text-base leading-tight text-ink">
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
            className="border-r border-white/60 last:border-r-0 dark:border-surface/60"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {shown.map((x) => (
          <span
            key={x.s}
            className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-xs text-ink-muted dark:bg-line"
          >
            {x.s}. {surahName(x.s)}
          </span>
        ))}
        {card.surahs.length > shown.length && (
          <span className="px-1 py-0.5 text-xs text-ink-subtle">
            {t.browse.more(card.surahs.length - shown.length)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1 text-center text-xs text-ink-muted dark:text-ink-subtle">
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
      <div className="font-semibold tabular-nums text-ink">{value}</div>
      {label}
    </div>
  );
}
