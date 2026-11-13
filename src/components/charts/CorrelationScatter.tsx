import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { SurahDatum } from "../../data/selectors";
import { SurahTooltip } from "../tooltips";
import {
  axisColor,
  gridColor,
  surahColor,
  surahOpacity,
  hitMark,
  type ChartContext,
} from "./common";
import { Cell } from "recharts";
import { useI18n } from "../../i18n/I18nContext";

export function CorrelationScatter({
  data,
  ctx,
}: {
  data: SurahDatum[];
  ctx: ChartContext;
}) {
  const { t } = useI18n();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{ top: 12, right: 16, bottom: 24, left: 8 }}
        accessibilityLayer
      >
        <CartesianGrid stroke={gridColor(ctx.dark)} strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="ayahCount"
          name={t.common.verses}
          tick={{ fontSize: 11, fill: axisColor(ctx.dark) }}
          label={{
            value: t.common.verses,
            position: "insideBottom",
            offset: -12,
            fontSize: 12,
            fill: axisColor(ctx.dark),
          }}
        />
        <YAxis
          type="number"
          dataKey="wordCount"
          name={t.common.words}
          tick={{ fontSize: 11, fill: axisColor(ctx.dark) }}
          label={{
            value: t.common.words,
            angle: -90,
            position: "insideLeft",
            fontSize: 12,
            fill: axisColor(ctx.dark),
          }}
        />
        <ZAxis
          type="number"
          dataKey="letterCount"
          range={[30, 400]}
          name={t.common.letters}
        />
        <Tooltip content={<SurahTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter
          data={data}
          onClick={(d: unknown) =>
            hitMark(ctx, { scope: "surah", value: (d as SurahDatum).id })
          }
        >
          {data.map((d) => (
            <Cell
              key={d.id}
              fill={surahColor(d, ctx)}
              fillOpacity={0.7 * surahOpacity(d, ctx)}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
