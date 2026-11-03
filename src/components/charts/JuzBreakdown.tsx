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
import type { Verse } from "../../types/quran";
import { GenericTooltip } from "../tooltips";
import { axisColor, type ChartContext } from "./common";

/** Words per juz (1–30); click a bar to read from the start of that juz. */
export function JuzBreakdown({ verses, ctx }: { verses: Verse[]; ctx: ChartContext }) {
  const rows = useMemo(() => {
    const acc = new Map<number, { words: number; first: number }>();
    for (const v of verses) {
      const r = acc.get(v.juz) ?? { words: 0, first: v.id };
      r.words += v.w;
      r.first = Math.min(r.first, v.id);
      acc.set(v.juz, r);
    }
    return [...acc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([juz, r]) => ({ name: `Juz ${juz}`, juz, words: r.words, first: r.first }));
  }, [verses]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
        <XAxis
          dataKey="juz"
          tick={{ fontSize: 10, fill: axisColor(ctx.dark) }}
          label={{
            value: "Juz",
            position: "insideBottom",
            offset: -12,
            fontSize: 11,
            fill: axisColor(ctx.dark),
          }}
        />
        <YAxis tick={{ fontSize: 11, fill: axisColor(ctx.dark) }} />
        <Tooltip
          content={<GenericTooltip unit="words" />}
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
        />
        <Bar
          dataKey="words"
          name="Words"
          radius={[3, 3, 0, 0]}
          cursor="pointer"
          isAnimationActive={false}
          onClick={(d: unknown) => {
            const r = d as { juz: number; first: number };
            ctx.onOpen?.({ scope: "juz", value: r.juz, anchor: r.first });
          }}
        >
          {rows.map((r) => (
            <Cell
              key={r.juz}
              fill={r.juz % 2 === 0 ? ctx.palette.pie[0] : ctx.palette.pie[1]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
