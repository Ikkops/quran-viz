import type { ReactNode } from "react";
import type { SurahDatum } from "../../data/selectors";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-600 dark:bg-slate-800/95">
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        {color && (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        )}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: SurahDatum }[];
}

export function SurahTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <Shell>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {d.id}. {d.name}
        </span>
        <span className="font-arabic text-base text-slate-600 dark:text-slate-300">
          {d.nameAr}
        </span>
      </div>
      <p className="mb-1.5 text-[11px] italic text-slate-400">{d.meaning}</p>
      <Row label="Type" value={d.type} />
      <Row label="Verses" value={d.ayahCount} />
      <Row label="Words" value={d.wordCount.toLocaleString()} />
      <Row label="Letters" value={d.letterCount.toLocaleString()} />
      <Row label="Avg words/verse" value={d.avgWords.toFixed(1)} />
      <p className="mt-1.5 border-t border-slate-100 pt-1 text-[11px] text-slate-400 dark:border-slate-700">
        Opening: {d.category}
      </p>
    </Shell>
  );
}

export function GenericTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color?: string }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <Shell>
      {label !== undefined && (
        <div className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <Row
          key={i}
          label={p.name}
          value={`${p.value.toLocaleString()}${unit ? ` ${unit}` : ""}`}
          color={p.color}
        />
      ))}
    </Shell>
  );
}

export { Shell as TooltipShell, Row as TooltipRow };
