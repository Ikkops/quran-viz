import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Verse } from "../../types/quran";
import { histogram, type HistogramBucket } from "../../data/stats";
import { GenericTooltip } from "../tooltips";
import { axisColor, CURSOR_FILL, type ChartContext } from "./common";
import { useI18n } from "../../i18n/I18nContext";

export function LengthHistogram({
  verses,
  bucketSize,
  ctx,
  selected,
  onBucket,
}: {
  verses: Verse[];
  bucketSize: number;
  ctx: ChartContext;
  /** Lower bound of the selected bucket, if any. */
  selected?: number | null;
  /** A bucket was clicked: its word-count range. */
  onBucket?: (range: [number, number]) => void;
}) {
  const { t } = useI18n();
  const buckets = useMemo(
    () =>
      histogram(
        verses.map((v) => v.w),
        bucketSize,
      ),
    [verses, bucketSize],
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={buckets}
        margin={{ top: 8, right: 12, bottom: 24, left: 0 }}
        accessibilityLayer
      >
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: axisColor(ctx.dark) }}
          label={{
            value: t.charts.wordsPerVerse,
            position: "insideBottom",
            offset: -10,
            fontSize: 11,
            fill: axisColor(ctx.dark),
          }}
        />
        <YAxis tick={{ fontSize: 11, fill: axisColor(ctx.dark) }} />
        <Tooltip
          content={<GenericTooltip unit={t.tooltip.units.verses} />}
          cursor={{ fill: CURSOR_FILL }}
        />
        <Bar
          dataKey="count"
          name={t.common.verses}
          fill={ctx.primary}
          radius={[4, 4, 0, 0]}
          cursor={onBucket ? "pointer" : undefined}
          onClick={
            onBucket &&
            ((d: unknown) => onBucket((d as { payload: HistogramBucket }).payload.range))
          }
          // The selected bucket stays solid; the rest step back.
          fillOpacity={1}
          shape={
            selected == null
              ? undefined
              : (props: unknown) => {
                  const p = props as {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    payload: HistogramBucket;
                  };
                  return (
                    <rect
                      x={p.x}
                      y={p.y}
                      width={p.width}
                      height={Math.max(0, p.height)}
                      rx={3}
                      fill={ctx.primary}
                      fillOpacity={p.payload.range[0] === selected ? 1 : 0.35}
                    />
                  );
                }
          }
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
