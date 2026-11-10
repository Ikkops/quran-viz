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
import type { Surah, Verse } from "../../types/quran";
import { TooltipRow, TooltipShell } from "../tooltips";
import { axisColor, type ChartContext } from "./common";
import { useI18n } from "../../i18n/I18nContext";

export type Division = "manzil" | "ruku";

interface Row {
  n: number;
  words: number;
  verses: number;
  first: Verse;
  last: Verse;
}

function DivisionTooltip({
  active,
  payload,
  division,
  surahMap,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  division: Division;
  surahMap: Map<number, Surah>;
}) {
  const { t, n } = useI18n();
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const from = surahMap.get(r.first.s)?.nameEn ?? r.first.s;
  const to = surahMap.get(r.last.s)?.nameEn ?? r.last.s;
  return (
    <TooltipShell>
      <div className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
        {t.scope[division]} {r.n}
      </div>
      <p className="mb-1.5 text-[11px] text-slate-400">
        {from} {r.first.s}:{r.first.a} – {r.first.s === r.last.s ? "" : `${to} `}
        {r.last.s}:{r.last.a}
      </p>
      <TooltipRow label={t.common.verses} value={r.verses} />
      <TooltipRow label={t.common.words} value={n(r.words)} />
    </TooltipShell>
  );
}

/** Words per manzil (1–7) or ruku' (1–558). Ruku' bars alternate colour by
 *  surah, so the surah boundaries show; click a bar to read that division. */
export function DivisionBreakdown({
  verses,
  surahMap,
  division,
  ctx,
}: {
  verses: Verse[];
  surahMap: Map<number, Surah>;
  division: Division;
  ctx: ChartContext;
}) {
  const { t } = useI18n();
  const rows = useMemo(() => {
    const acc = new Map<number, Row>();
    for (const v of verses) {
      const n = v[division];
      const r = acc.get(n);
      if (!r) acc.set(n, { n, words: v.w, verses: 1, first: v, last: v });
      else {
        r.words += v.w;
        r.verses += 1;
        if (v.id < r.first.id) r.first = v;
        if (v.id > r.last.id) r.last = v;
      }
    }
    return [...acc.values()].sort((a, b) => a.n - b.n);
  }, [verses, division]);

  const many = rows.length > 60;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows}
        margin={{ top: 8, right: 12, bottom: 24, left: 0 }}
        barCategoryGap={many ? 0 : "10%"}
      >
        <XAxis
          dataKey="n"
          tick={{ fontSize: 10, fill: axisColor(ctx.dark) }}
          interval={many ? 49 : 0}
          label={{
            value: t.scope[division],
            position: "insideBottom",
            offset: -12,
            fontSize: 11,
            fill: axisColor(ctx.dark),
          }}
        />
        <YAxis tick={{ fontSize: 11, fill: axisColor(ctx.dark) }} />
        <Tooltip
          content={<DivisionTooltip division={division} surahMap={surahMap} />}
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
        />
        <Bar
          dataKey="words"
          name={t.common.words}
          radius={many ? 0 : [3, 3, 0, 0]}
          cursor="pointer"
          isAnimationActive={false}
          onClick={(d: unknown) => {
            const r = d as Row;
            ctx.onOpen?.({ scope: division, value: r.n, anchor: r.first.id });
          }}
        >
          {rows.map((r) => (
            <Cell
              key={r.n}
              fill={
                (division === "ruku" ? r.first.s : r.n) % 2 === 0
                  ? ctx.palette.pie[0]
                  : ctx.palette.pie[1]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
