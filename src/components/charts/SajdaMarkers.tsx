import { useMemo } from "react";
import type { Surah, Verse } from "../../types/quran";
import { Badge } from "../ui";
import type { ChartContext } from "./common";
import { useI18n } from "../../i18n/I18nContext";

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
  const { t } = useI18n();
  const sajdas = useMemo(() => verses.filter((v) => v.sajda === 1), [verses]);

  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
      {sajdas.map((v) => {
        const s = surahMap.get(v.s);
        return (
          <button
            key={v.id}
            onClick={() => ctx.onOpen?.({ scope: "surah", value: v.s, anchor: v.id })}
            className="rounded-xl border border-line bg-surface p-3 text-right transition hover:shadow-md dark:bg-surface/60"
          >
            <div className="mb-1.5 flex items-center justify-between" dir="ltr">
              <span className="text-sm font-semibold text-ink">
                {s?.nameEn} · {v.s}:{v.a}
              </span>
              <div className="flex gap-1">
                <Badge>
                  {t.scope.juz} {v.juz}
                </Badge>
                <Badge color={ctx.primary}>
                  {t.scope.page} {v.page}
                </Badge>
              </div>
            </div>
            <p lang="ar" dir="rtl" className="quran-text text-ink">
              {v.ar}
            </p>
          </button>
        );
      })}
    </div>
  );
}
