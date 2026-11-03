import type { RootDatum } from "../../types/quran";
import { axisColor } from "./common";
import { HorizontalBarChart } from "./HorizontalBarChart";
import { TooltipShell } from "../tooltips";

interface TipProps {
  active?: boolean;
  payload?: { payload: RootDatum }[];
}

function RootTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipShell>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-arabic text-base text-slate-800 dark:text-slate-100">
          {d.ar}
        </span>
        <span className="text-[11px] text-slate-400">({d.bw})</span>
      </div>
      {d.gloss && <p className="mb-1 text-[11px] italic text-slate-400">{d.gloss}</p>}
      <div className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {d.count.toLocaleString()} occurrences
      </div>
    </TooltipShell>
  );
}

/** Horizontal bar chart of the most frequent triliteral roots in the Quran. */
export function RootChart({
  roots,
  primary,
  dark,
  limit = 30,
}: {
  roots: RootDatum[];
  primary: string;
  dark: boolean;
  limit?: number;
}) {
  void axisColor(dark); // keep import side consistent with sibling charts
  const data = roots.slice(0, limit) as (RootDatum & Record<string, unknown>)[];
  return (
    <HorizontalBarChart<RootDatum & Record<string, unknown>>
      data={data}
      categoryKey="ar"
      valueKey="count"
      categoryWidth={70}
      color={primary}
      dark={dark}
      tickStyle={{ fontSize: 16, fontFamily: "var(--font-arabic)" }}
      tooltip={<RootTooltip />}
    />
  );
}
