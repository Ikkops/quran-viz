import { useMemo } from "react";
import type { Verse, Surah } from "../../types/quran";
import { boxStats } from "../../data/stats";
import { categorizeOpening } from "../../data/fawatih";
import { FAWATIH_COLORS } from "../../theme/palettes";
import { axisColor, hitMark, type ChartContext } from "./common";

/**
 * Verse word-length distribution per surah, drawn as scrollable SVG box plots.
 * (Min–Q1–median–Q3–max of the word count of each verse in the surah.)
 */
export function BoxPlots({
  verses,
  order,
  surahMap,
  ctx,
}: {
  verses: Verse[];
  order: number[];
  surahMap: Map<number, Surah>;
  ctx: ChartContext;
}) {
  const { boxes, globalMax } = useMemo(() => {
    const grouped = new Map<number, number[]>();
    for (const v of verses) {
      const arr = grouped.get(v.s) ?? [];
      arr.push(v.w);
      grouped.set(v.s, arr);
    }
    let max = 1;
    const boxes = order
      .filter((id) => grouped.has(id))
      .map((id) => {
        const stats = boxStats(grouped.get(id)!);
        max = Math.max(max, stats.max);
        return { id, name: surahMap.get(id)?.name ?? `#${id}`, ...stats };
      });
    return { boxes, globalMax: max };
  }, [verses, order, surahMap]);

  const COL = 22;
  const H = 320;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 56;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const width = Math.max(boxes.length * COL + 20, 320);
  const y = (val: number) => PAD_TOP + plotH - (val / globalMax) * plotH;

  // Colour + opacity per surah, honouring `colorMode` and the legend filter
  // (`activeKeys`) the same way the other dashboard charts do.
  const colorFor = (id: number): string =>
    ctx.colorMode === "fawatih"
      ? (FAWATIH_COLORS[categorizeOpening(id)] ?? FAWATIH_COLORS.Unknown)
      : surahMap.get(id)?.type === "Meccan"
        ? ctx.palette.pie[0]
        : ctx.palette.pie[1];
  const opacityFor = (id: number): number => {
    if (!ctx.activeKeys || ctx.activeKeys.size === 0) return 1;
    const key =
      ctx.colorMode === "fawatih"
        ? categorizeOpening(id)
        : (surahMap.get(id)?.type ?? "");
    return ctx.activeKeys.has(key) ? 1 : 0.18;
  };

  return (
    <div className="h-full w-full overflow-x-auto">
      <svg width={width} height={H} className="select-none">
        {boxes.map((b, i) => {
          const cx = 10 + i * COL + COL / 2;
          const w = COL * 0.6;
          const color = colorFor(b.id);
          const op = opacityFor(b.id);
          return (
            <g
              key={b.id}
              onClick={() => hitMark(ctx, { scope: "surah", value: b.id })}
              style={{ cursor: "pointer", opacity: op }}
            >
              {/* whisker */}
              <line
                x1={cx}
                x2={cx}
                y1={y(b.max)}
                y2={y(b.min)}
                stroke={color}
                strokeWidth={1}
              />
              <line x1={cx - 4} x2={cx + 4} y1={y(b.max)} y2={y(b.max)} stroke={color} />
              <line x1={cx - 4} x2={cx + 4} y1={y(b.min)} y2={y(b.min)} stroke={color} />
              {/* box */}
              <rect
                x={cx - w / 2}
                y={y(b.q3)}
                width={w}
                height={Math.max(y(b.q1) - y(b.q3), 1)}
                fill={color}
                fillOpacity={0.35}
                stroke={color}
              />
              {/* median */}
              <line
                x1={cx - w / 2}
                x2={cx + w / 2}
                y1={y(b.median)}
                y2={y(b.median)}
                stroke={color}
                strokeWidth={2}
              />
              <text
                x={cx}
                y={H - PAD_BOTTOM + 10}
                fontSize={8}
                fill={axisColor(ctx.dark)}
                textAnchor="end"
                transform={`rotate(-60 ${cx} ${H - PAD_BOTTOM + 10})`}
              >
                {b.name.length > 10 ? `${b.name.slice(0, 9)}…` : b.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
