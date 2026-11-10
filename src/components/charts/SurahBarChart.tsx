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
import type { AyahPlace } from "../../types/quran";
import { SurahTooltip } from "../tooltips";
import {
  axisColor,
  placeColor,
  surahColor,
  surahOpacity,
  type ChartContext,
} from "./common";

export type Metric = "wordCount" | "letterCount" | "ayahCount" | "avgWords";

const SPLIT_KEY: Partial<Record<Metric, keyof SurahDatum["split"]>> = {
  wordCount: "w",
  letterCount: "l",
  ayahCount: "v",
};

/** Stack segments, bottom to top: the surah's own place, then the opposite
 *  classification, then Hijra (en route). */
function segmentPlaces(d: SurahDatum): [AyahPlace, AyahPlace, AyahPlace] {
  return d.type === "Medinan"
    ? ["Medinan", "Meccan", "Hijra"]
    : ["Meccan", "Medinan", "Hijra"];
}

type Row = SurahDatum & { seg0: number; seg1: number; seg2: number };

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
  const splitKey = SPLIT_KEY[metric];
  // Ayah-level stacking only in Meccan/Medinan mode and for additive metrics.
  const stacked = ctx.colorMode === "type" && splitKey !== undefined;
  const rows: Row[] = data.map((d) => {
    if (!stacked) return { ...d, seg0: d[metric], seg1: 0, seg2: 0 };
    const sp = d.split[splitKey!];
    const [a, b, c] = segmentPlaces(d);
    return { ...d, seg0: sp[a], seg1: sp[b], seg2: sp[c] };
  });

  const onClick = (d: unknown) =>
    ctx.onSelectSurah?.((d as { payload: SurahDatum }).payload.id);
  const segments = stacked ? ([0, 1, 2] as const) : ([0] as const);
  const radius: [number, number, number, number] = horizontal
    ? [0, 4, 4, 0]
    : [4, 4, 0, 0];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows}
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
        <Tooltip
          content={<SurahTooltip metric={stacked ? metric : undefined} />}
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
        />
        {segments.map((i) => (
          <Bar
            key={i}
            dataKey={`seg${i}`}
            stackId="s"
            radius={stacked ? undefined : radius}
            onClick={onClick}
            isAnimationActive={data.length < 60}
          >
            {rows.map((d) => (
              <Cell
                key={d.id}
                fill={
                  stacked
                    ? placeColor(segmentPlaces(d)[i], ctx.palette)
                    : surahColor(d, ctx)
                }
                fillOpacity={surahOpacity(d, ctx)}
                cursor={ctx.onSelectSurah ? "pointer" : "default"}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
