import type { AyahPlace, Surah } from "../../types/quran";
import type { Palette } from "../../theme/palettes";
import type { PlaceException } from "../../data/selectors";
import { placeColor } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";

/** Thin strip across the surah's ayahs, marking ayahs whose traditional place
 *  differs from the surah's (e.g. 7:163–170 Medinan in a Meccan surah). */
export function PlaceStrip({
  surah,
  exceptions,
  palette,
}: {
  surah: Surah;
  exceptions: PlaceException[];
  palette: Palette;
}) {
  const n = surah.ayahCount;
  return (
    <div
      className="relative h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: placeColor(surah.type, palette) }}
      aria-hidden
    >
      {exceptions.map((e) => (
        <span
          key={e.a}
          className="absolute top-0 h-full"
          style={{
            left: `${((e.a - 1) / n) * 100}%`,
            width: `${Math.max(100 / n, 1.2)}%`,
            backgroundColor: placeColor(e.p, palette),
          }}
        />
      ))}
    </div>
  );
}

function summarize(exceptions: PlaceException[], i: ReturnType<typeof useI18n>): string {
  const by = new Map<AyahPlace, number[]>();
  for (const e of exceptions) by.set(e.p, [...(by.get(e.p) ?? []), e.a]);
  return [...by.entries()]
    .map(([p, as]) => `${as.length} ${p === "Hijra" ? i.t.card.duringHijra : i.place(p)}`)
    .join(" · ");
}

/** A surah as a clickable card: names, place, revelation rank, sizes, and
 *  where its exception ayahs fall. */
export function SurahCard({
  surah,
  exceptions,
  palette,
  onOpen,
  extra,
}: {
  surah: Surah;
  exceptions: PlaceException[];
  palette: Palette;
  onOpen: () => void;
  extra?: string | string[];
}) {
  const i = useI18n();
  const { t, n } = i;
  const color = placeColor(surah.type, palette);
  const pages =
    surah.firstPage === surah.lastPage
      ? `p. ${surah.firstPage}`
      : `pp. ${surah.firstPage}–${surah.lastPage}`;
  const juz =
    surah.firstJuz === surah.lastJuz
      ? `Juz ${surah.firstJuz}`
      : `Juz ${surah.firstJuz}–${surah.lastJuz}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-500"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums text-white"
          style={{ backgroundColor: color }}
        >
          {surah.id}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
            {surah.nameEn}
          </div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
            {i.meaning(surah)}
          </div>
        </div>
        <span className="font-arabic text-lg leading-tight text-slate-700 dark:text-slate-200">
          {surah.nameAr.replace(/^سورة\s+/, "")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span
          className="rounded-full px-1.5 py-0.5 font-medium"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {i.place(surah.type)}
        </span>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {t.card.revealed(surah.revelationOrder)}
        </span>
        {(Array.isArray(extra) ? extra : extra ? [extra] : []).map((x) => (
          <span
            key={x}
            className="rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            {x}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
        <div>
          <div className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {surah.ayahCount}
          </div>
          {t.browse.ayahs}
        </div>
        <div>
          <div className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {n(surah.wordCount)}
          </div>
          {t.browse.words}
        </div>
        <div>
          <div className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {pages.replace(/^pp?\. /, "")}
          </div>
          {pages.startsWith("pp") ? t.browse.pages : t.browse.page}
        </div>
        <div>
          <div className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {juz.replace("Juz ", "")}
          </div>
          {t.browse.juz}
        </div>
      </div>
      <PlaceStrip surah={surah} exceptions={exceptions} palette={palette} />
      <div className="min-h-[14px] text-[10px] text-slate-400">
        {exceptions.length > 0
          ? t.card.exceptions(summarize(exceptions, i))
          : t.card.allAyahs(i.place(surah.type))}
      </div>
    </button>
  );
}
