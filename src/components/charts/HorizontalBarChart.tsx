import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisColor } from "./common";

interface TickStyle {
  fontSize?: number;
  fill?: string;
  fontFamily?: string;
}

/**
 * Shared horizontal bar chart used by the morphology views (roots, POS).
 * `categoryKey` selects the Y-axis label field; `valueKey` is the bar length.
 * Each datum is rendered as a `<Cell>` filled with `color`. The tooltip is
 * supplied by the caller so it can render datum-specific fields.
 */
export function HorizontalBarChart<T extends Record<string, unknown>>({
  data,
  categoryKey,
  valueKey,
  categoryWidth,
  color,
  dark,
  tickStyle,
  tooltip,
  onBarClick,
  margin = { top: 8, right: 16, bottom: 8, left: 8 },
}: {
  data: T[];
  categoryKey: keyof T & string;
  valueKey: keyof T & string;
  categoryWidth: number;
  color: string;
  dark: boolean;
  tickStyle?: TickStyle;
  tooltip: ReactElement;
  onBarClick?: (d: T) => void;
  margin?: { top: number; right: number; bottom: number; left: number };
}) {
  const ac = axisColor(dark);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={margin}>
        <XAxis type="number" tick={{ fontSize: 11, fill: ac }} />
        <YAxis
          type="category"
          dataKey={categoryKey}
          width={categoryWidth}
          interval={0}
          tick={{ fontSize: 11, fill: ac, ...tickStyle }}
        />
        <Tooltip content={tooltip} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
        <Bar
          dataKey={valueKey}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          cursor={onBarClick ? "pointer" : undefined}
          onClick={
            onBarClick && ((d: unknown) => onBarClick((d as { payload: T }).payload))
          }
        >
          {data.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
