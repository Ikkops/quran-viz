import { useMemo } from "react";
import type { Surah, Verse } from "../../types/quran";
import { Badge } from "../ui";
import type { ChartContext } from "./common";

/** The 15 prostration (sajda) verses, with their Mushaf location. */
export function SajdaMarkers({
  verses,
  surahMap,
  ctx,
}: {
  verses: Verse[];
  surahMap: Map<number, Surah>;
  ctx: ChartContext;
}) {
  const sajdas = useMemo(() => verses.filter((v) => v.sajda === 1), [verses]);

  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
      {sajdas.map((v) => {
        const s = surahMap.get(v.s);
        return (
          <button
            key={v.id}
            onClick={() => ctx.onOpen?.({ scope: "surah", value: v.s, anchor: v.id })}
            className="rounded-xl border border-slate-200 bg-white p-3 text-right transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60"
          >
            <div className="mb-1.5 flex items-center justify-between" dir="ltr">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {s?.nameEn} · {v.s}:{v.a}
              </span>
              <div className="flex gap-1">
                <Badge>Juz {v.juz}</Badge>
                <Badge color={ctx.primary}>Page {v.page}</Badge>
              </div>
            </div>
            <p dir="rtl" className="quran-text text-slate-800 dark:text-slate-100">
              {v.ar}
            </p>
          </button>
        );
      })}
    </div>
  );
}
