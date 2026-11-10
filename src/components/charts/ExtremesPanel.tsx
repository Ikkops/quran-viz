import { useMemo } from "react";
import type { Surah, Verse } from "../../types/quran";
import { Badge } from "../ui";
import type { ChartContext } from "./common";

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
  return (
    <button
      onClick={() => ctx.onOpen?.({ scope: "surah", value: v.s, anchor: v.id })}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-right transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
    >
      <div className="mb-1 flex items-center justify-between" dir="ltr">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {s?.nameEn} {v.s}:{v.a}
        </span>
        <Badge color={ctx.primary}>{v.w} words</Badge>
      </div>
      <p dir="rtl" className="quran-text text-slate-800 dark:text-slate-100">
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
        <h4 className="sticky top-0 bg-white/80 py-1 text-sm font-semibold text-slate-700 backdrop-blur dark:bg-slate-800/80 dark:text-slate-200">
          Longest verses
        </h4>
        {longest.map((v) => (
          <VerseCard key={v.id} v={v} surahMap={surahMap} ctx={ctx} />
        ))}
      </div>
      <div className="space-y-2">
        <h4 className="sticky top-0 bg-white/80 py-1 text-sm font-semibold text-slate-700 backdrop-blur dark:bg-slate-800/80 dark:text-slate-200">
          Shortest verses
        </h4>
        {shortest.map((v) => (
          <VerseCard key={v.id} v={v} surahMap={surahMap} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}
