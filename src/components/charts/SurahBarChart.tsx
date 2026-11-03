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
import { SurahTooltip } from "../tooltips";
import { axisColor, surahColor, surahOpacity, type ChartContext } from "./common";

type Metric = "wordCount" | "letterCount" | "ayahCount" | "avgWords";

export function SurahBarChart({
  data,
  metric,
  horizontal,
  ctx,
}: {
  data: SurahDatum[];
  metric: Metric;
  horizontal: boolean;
  ctx: ChartContext;
}) {
  const ac = axisColor(ctx.dark);
  const cells = data.map((d) => (
    <Cell
      key={d.id}
      fill={surahColor(d, ctx)}
      fillOpacity={surahOpacity(d, ctx)}
      cursor={ctx.onSelectSurah ? "pointer" : "default"}
    />
  ));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
      >
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: ac }} />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fontSize: 10, fill: ac }}
              interval={data.length > 40 ? Math.floor(data.length / 40) : 0}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: ac }}
              interval={data.length > 30 ? Math.floor(data.length / 30) : 0}
              angle={-35}
              textAnchor="end"
              height={70}
            />
            <YAxis tick={{ fontSize: 11, fill: ac }} />
          </>
        )}
        <Tooltip content={<SurahTooltip />} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
        <Bar
          dataKey={metric}
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          onClick={(d: unknown) =>
            ctx.onSelectSurah?.((d as { payload: SurahDatum }).payload.id)
          }
          isAnimationActive={data.length < 60}
        >
          {cells}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
