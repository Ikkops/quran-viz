import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Verse } from "../../types/quran";
import { histogram } from "../../data/stats";
import { GenericTooltip } from "../tooltips";
import { axisColor, type ChartContext } from "./common";

export function LengthHistogram({
  verses,
  bucketSize,
  ctx,
}: {
  verses: Verse[];
  bucketSize: number;
  ctx: ChartContext;
}) {
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
      <BarChart data={buckets} margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: axisColor(ctx.dark) }}
          label={{
            value: "Words per verse",
            position: "insideBottom",
            offset: -10,
            fontSize: 11,
            fill: axisColor(ctx.dark),
          }}
        />
        <YAxis tick={{ fontSize: 11, fill: axisColor(ctx.dark) }} />
        <Tooltip
          content={<GenericTooltip unit="verses" />}
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
        />
        <Bar dataKey="count" name="Verses" fill={ctx.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
