import { useMemo } from "react";
import type { Surah, Verse } from "../../types/quran";
import { Badge } from "../ui";
import type { ChartContext } from "./common";
import { useI18n } from "../../i18n/I18nContext";

function VerseCard({
  v,
  surahMap,
  ctx,
}: {
  v: Verse;
  surahMap: Map<number, Surah>;
  ctx: ChartContext;
}) {
  const s = surahMap.get(v.s);
  const { t } = useI18n();
  return (
    <button
      onClick={() => ctx.onOpen?.({ scope: "surah", value: v.s, anchor: v.id })}
      className="w-full rounded-xl border border-line bg-paper p-3 text-right transition hover:border-ink-subtle/50 hover:shadow-sm dark:bg-surface/60"
    >
      <div className="mb-1 flex items-center justify-between" dir="ltr">
        <span className="text-xs font-medium text-ink-muted dark:text-ink-subtle">
          {s?.nameEn} {v.s}:{v.a}
        </span>
        <Badge color={ctx.primary}>{t.charts.nWords(v.w)}</Badge>
      </div>
      <p lang="ar" dir="rtl" className="quran-text text-ink">
        {v.ar}
      </p>
    </button>
  );
}

export function ExtremesPanel({
  verses,
  count,
  surahMap,
  ctx,
}: {
  verses: Verse[];
  count: number;
  surahMap: Map<number, Surah>;
  ctx: ChartContext;
}) {
  const { t } = useI18n();
  const { longest, shortest } = useMemo(() => {
    const sorted = [...verses].sort((a, b) => b.w - a.w);
    return {
      longest: sorted.slice(0, count),
      shortest: sorted.slice(-count).reverse(),
    };
  }, [verses, count]);

  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2">
      <div className="space-y-2">
        <h4 className="sticky top-0 bg-surface/80 py-1 text-sm font-semibold text-ink backdrop-blur">
          {t.charts.longest}
        </h4>
        {longest.map((v) => (
          <VerseCard key={v.id} v={v} surahMap={surahMap} ctx={ctx} />
        ))}
      </div>
      <div className="space-y-2">
        <h4 className="sticky top-0 bg-surface/80 py-1 text-sm font-semibold text-ink backdrop-blur">
          {t.charts.shortest}
        </h4>
        {shortest.map((v) => (
          <VerseCard key={v.id} v={v} surahMap={surahMap} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}
