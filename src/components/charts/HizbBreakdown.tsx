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
import { axisColor, CURSOR_FILL, type ChartContext } from "./common";
import { useI18n } from "../../i18n/I18nContext";

/** Words per hizb (1–60), coloured by parent juz. */
export function HizbBreakdown({ verses, ctx }: { verses: Verse[]; ctx: ChartContext }) {
  const { t } = useI18n();
  const rows = useMemo(() => {
    const words = new Map<number, { words: number; juz: number; first: number }>();
    for (const v of verses) {
      const r = words.get(v.hizb) ?? { words: 0, juz: v.juz, first: v.id };
      r.words += v.w;
      r.first = Math.min(r.first, v.id);
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
          content={<GenericTooltip unit={t.tooltip.units.words} />}
          cursor={{ fill: CURSOR_FILL }}
        />
        <Bar
          dataKey="words"
          name={t.common.words}
          radius={[3, 3, 0, 0]}
          cursor="pointer"
          isAnimationActive={false}
          onClick={(d: unknown) => {
            const r = d as { hizb: number; first: number };
            ctx.onOpen?.({ scope: "hizb", value: r.hizb, anchor: r.first });
          }}
        >
          {rows.map((r) => (
            <Cell
              key={r.hizb}
              fill={ctx.primary}
              // Alternate juz in tone: Makki/Madani colours mean place only.
              fillOpacity={r.juz % 2 === 0 ? 1 : 0.55}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
