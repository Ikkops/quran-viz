import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SurahDatum } from "../../data/selectors";
import { ALL_CATEGORIES } from "../../data/fawatih";
import { FAWATIH_COLORS } from "../../theme/palettes";
import { GenericTooltip } from "../tooltips";
import { axisColor, type ChartContext } from "./common";

export function OpeningCategories({
  data,
  ctx,
}: {
  data: SurahDatum[];
  ctx: ChartContext;
}) {
  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of data) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
    return ALL_CATEGORIES.map((cat) => ({
      category: cat,
      count: counts.get(cat) ?? 0,
    })).filter((r) => r.count > 0);
  }, [data]);

  return (
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
          dataKey="category"
          width={150}
          tick={{ fontSize: 11, fill: axisColor(ctx.dark) }}
        />
        <Tooltip
          content={<GenericTooltip unit="surahs" />}
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
        />
        <Bar dataKey="count" name="Surahs" radius={[0, 4, 4, 0]}>
          {rows.map((r) => (
            <Cell
              key={r.category}
              fill={FAWATIH_COLORS[r.category] ?? FAWATIH_COLORS.Unknown}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
