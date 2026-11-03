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

/** Words per hizb (1–60), coloured by parent juz. */
export function HizbBreakdown({ verses, ctx }: { verses: Verse[]; ctx: ChartContext }) {
  const rows = useMemo(() => {
    const words = new Map<
      number,
      { words: number; juz: number; first: number; firstS: number }
    >();
    for (const v of verses) {
      const r = words.get(v.hizb) ?? { words: 0, juz: v.juz, first: v.id, firstS: v.s };
      r.words += v.w;
      if (v.id < r.first) {
        r.first = v.id;
        r.firstS = v.s;
      }
      words.set(v.hizb, r);
    }
    return [...words.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hizb, r]) => ({
        name: `H${hizb}`,
        hizb,
        words: r.words,
        juz: r.juz,
        first: r.first,
        firstS: r.firstS,
      }));
  }, [verses]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 9, fill: axisColor(ctx.dark) }}
          interval={rows.length > 30 ? 1 : 0}
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
            const r = d as { firstS: number; first: number };
            ctx.onOpen?.({ scope: "surah", value: r.firstS, anchor: r.first });
          }}
        >
          {rows.map((r) => (
            <Cell
              key={r.hizb}
              fill={r.juz % 2 === 0 ? ctx.palette.pie[0] : ctx.palette.pie[1]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
