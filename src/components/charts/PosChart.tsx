import type { PosDatum } from "../../types/quran";
import { HorizontalBarChart } from "./HorizontalBarChart";
import { TooltipShell } from "../tooltips";
import { useI18n } from "../../i18n/I18nContext";

interface TipProps {
  active?: boolean;
  payload?: { payload: PosDatum }[];
}

function PosTooltip({ active, payload }: TipProps) {
  const { t, n } = useI18n();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipShell>
      <div className="mb-0.5 font-semibold text-slate-800 dark:text-slate-100">
        {d.label} <span className="text-[11px] text-slate-400">({d.tag})</span>
      </div>
      <div className="tabular-nums text-slate-600 dark:text-slate-300">
        {t.charts.segments(n(d.count))}
      </div>
    </TooltipShell>
  );
}

/** Horizontal bar chart of part-of-speech frequency from the corpus. */
export function PosChart({
  pos,
  primary,
  dark,
  limit = 18,
}: {
  pos: PosDatum[];
  primary: string;
  dark: boolean;
  limit?: number;
}) {
  const data = pos.slice(0, limit) as (PosDatum & Record<string, unknown>)[];
  return (
    <HorizontalBarChart<PosDatum & Record<string, unknown>>
      data={data}
      categoryKey="label"
      valueKey="count"
      categoryWidth={150}
      color={primary}
      dark={dark}
      tooltip={<PosTooltip />}
    />
  );
}
