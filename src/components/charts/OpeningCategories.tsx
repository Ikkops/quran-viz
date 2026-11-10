import { useMemo } from "react";
import { X } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlaceException, SurahDatum } from "../../data/selectors";
import type { Surah } from "../../types/quran";
import { ALL_CATEGORIES } from "../../data/fawatih";
import { FAWATIH_COLORS } from "../../theme/palettes";
import { GenericTooltip } from "../tooltips";
import { SurahCard } from "../cards/SurahCard";
import { axisColor, type ChartContext } from "./common";
import { useI18n } from "../../i18n/I18nContext";

/** Surah counts per opening category. Click a bar to list its surahs as
 *  cards below the chart (in the dashboard's sort order and range). */
export function OpeningCategories({
  data,
  ctx,
  surahMap,
  exceptions,
  selected,
  onSelect,
}: {
  data: SurahDatum[];
  ctx: ChartContext;
  surahMap: Map<number, Surah>;
  exceptions: Map<number, PlaceException[]>;
  selected: string | null;
  onSelect: (category: string | null) => void;
}) {
  const { t, category } = useI18n();
  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of data) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
    return ALL_CATEGORIES.map((cat) => ({
      category: cat,
      label: category(cat),
      count: counts.get(cat) ?? 0,
    })).filter((r) => r.count > 0);
  }, [data, category]);
  const members = selected ? data.filter((d) => d.category === selected) : [];

  return (
    <div className="flex flex-col gap-3">
      <div style={{ height: rows.length * 34 + 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: axisColor(ctx.dark) }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={170}
              interval={0}
              tick={{ fontSize: 11, fill: axisColor(ctx.dark) }}
            />
            <Tooltip
              content={<GenericTooltip unit={t.charts.surahsClick} />}
              cursor={{ fill: "rgba(148,163,184,0.12)" }}
            />
            <Bar
              dataKey="count"
              name={t.common.surahs}
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(d: unknown) => {
                const cat = (d as { payload: { category: string } }).payload.category;
                onSelect(cat === selected ? null : cat);
              }}
            >
              {rows.map((r) => (
                <Cell
                  key={r.category}
                  fill={FAWATIH_COLORS[r.category] ?? FAWATIH_COLORS.Unknown}
                  fillOpacity={selected && selected !== r.category ? 0.3 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {selected ? (
        <section aria-label={t.charts.listAria(category(selected))}>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm"
              style={{
                backgroundColor: FAWATIH_COLORS[selected] ?? FAWATIH_COLORS.Unknown,
              }}
            />
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {category(selected)} · {t.charts.surahsN(members.length)}
            </h4>
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label={t.charts.closeList}
              className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((d) => {
              const s = surahMap.get(d.id)!;
              return (
                <SurahCard
                  key={d.id}
                  surah={s}
                  exceptions={exceptions.get(d.id) ?? []}
                  palette={ctx.palette}
                  onOpen={() => ctx.onSelectSurah?.(d.id)}
                />
              );
            })}
          </div>
        </section>
      ) : (
        <p className="text-xs text-slate-400">{t.charts.clickBar}</p>
      )}
    </div>
  );
}
