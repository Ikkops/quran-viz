import { useMemo } from "react";
import { Search } from "lucide-react";
import type { QuranData, RevelationType } from "../types/quran";
import { exceptionsBySurah, surahMapOf } from "../data/selectors";
import { divisionCards, type DivisionCard } from "../data/sections";
import { normalizeArabic } from "../data/arabic";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { useTheme } from "../theme/ThemeContext";
import { Card, SectionTitle, SegmentedControl, Select } from "../components/ui";
import { SurahCard } from "../components/cards/SurahCard";
import { PLACE_CAVEAT, placeColor, type ReaderTarget } from "../components/charts/common";

type Kind = "surah" | "juz" | "manzil";
type SurahSort = "mushaf" | "revelation" | "ayahs" | "words";
type TypeFilter = "all" | RevelationType;

export function BrowseView({
  data,
  onOpen,
}: {
  data: QuranData;
  onOpen: (t: ReaderTarget) => void;
}) {
  const { palette } = useTheme();
  const [kind, setKind] = usePersistentState<Kind>(
    "qv.browse.kind",
    "surah",
    persisted.oneOf(["surah", "juz", "manzil"] as const),
  );
  const [query, setQuery] = usePersistentState("qv.browse.query", "");
  const [sort, setSort] = usePersistentState<SurahSort>(
    "qv.browse.sort",
    "mushaf",
    persisted.oneOf(["mushaf", "revelation", "ayahs", "words"] as const),
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
        normalizeArabic(s.nameAr).includes(qn)
      );
    });
    const by: Record<SurahSort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      mushaf: (a, b) => a.id - b.id,
      revelation: (a, b) => a.revelationOrder - b.revelationOrder,
      ayahs: (a, b) => b.ayahCount - a.ayahCount,
      words: (a, b) => b.wordCount - a.wordCount,
    };
    return [...list].sort(by[sort]);
  }, [data.surahs, query, type, sort]);

  const subtitle =
    kind === "surah"
      ? `${surahs.length} of 114 surahs · click a card to read. ${PLACE_CAVEAT}`
      : kind === "juz"
        ? "The 30 juz · click a card to read from its start"
        : "The 7 manzils (a week's recitation) · click a card to read";

  return (
    <Card className="p-4">
      <SectionTitle
        title="Browse"
        subtitle={subtitle}
        right={
          <SegmentedControl<Kind>
            value={kind}
            onChange={setKind}
            ariaLabel="Browse by"
            options={[
              { value: "surah", label: "Surah" },
              { value: "juz", label: "Juz" },
              { value: "manzil", label: "Manzil" },
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
                placeholder="Name, number or meaning…"
                aria-label="Filter surahs"
                className="w-60 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <div className="w-44">
              <Select
                label="Sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SurahSort)}
              >
                <option value="mushaf">Mushaf order</option>
                <option value="revelation">Revelation order</option>
                <option value="ayahs">Most ayahs</option>
                <option value="words">Most words</option>
              </Select>
            </div>
            <SegmentedControl<TypeFilter>
              value={type}
              onChange={setType}
              ariaLabel="Revelation place"
              options={[
                { value: "all", label: "All" },
                { value: "Meccan", label: "Meccan" },
                { value: "Medinan", label: "Medinan" },
              ]}
            />
          </div>
          {surahs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No surah matches “{query}”.
            </p>
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
        <p className="mt-3 text-[11px] text-slate-400">
          The manzil boundaries spell the mnemonic فمي بشوق (Fami bi-shawq): they start at
          Al-Fatiha, Al-Ma&apos;idah, Yunus, Bani Isra&apos;il, Ash-Shu&apos;ara,
          As-Saffat and Qaf.
        </p>
      )}
    </Card>
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
            {kind === "juz" ? "Juz" : "Manzil"} {card.n}
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
            +{card.surahs.length - shown.length} more
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
        <Stat value={card.ayahs} label="ayahs" />
        <Stat value={card.words.toLocaleString()} label="words" />
        <Stat value={span(...card.pages)} label="pages" />
        {kind === "manzil" ? (
          <Stat value={span(...card.juzs)} label="juz" />
        ) : (
          <Stat value={card.surahs.length} label="surahs" />
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
