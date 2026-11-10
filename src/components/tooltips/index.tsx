import type { ReactNode } from "react";
import type { SurahDatum } from "../../data/selectors";
import { useI18n } from "../../i18n/I18nContext";

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

const METRIC_SPLIT = {
  wordCount: ["w", "words"],
  letterCount: ["l", "letters"],
  ayahCount: ["v", "verses"],
} as const;

type I18nT = ReturnType<typeof useI18n>;

/** "incl. 132 in Medinan ayahs" lines for the stacked bar metric. */
function exceptionNote(
  d: SurahDatum,
  metric: keyof typeof METRIC_SPLIT,
  i: I18nT,
): string | null {
  const [key, unitKey] = METRIC_SPLIT[metric];
  const unit = i.t.tooltip.units[unitKey];
  const sp = d.split[key];
  const parts = (["Meccan", "Medinan", "Hijra"] as const)
    .filter((p) => p !== d.type && sp[p] > 0)
    .map((p) =>
      p === "Hijra"
        ? i.t.tooltip.inHijra(i.n(sp[p]), unit)
        : i.t.tooltip.inPlace(i.n(sp[p]), unit, i.place(p)),
    );
  return parts.length ? i.t.tooltip.incl(parts.join(", ")) : null;
}

export function SurahTooltip({
  active,
  payload,
  metric,
}: TooltipProps & { metric?: string }) {
  const i = useI18n();
  const { t, n } = i;
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const note =
    metric && metric in METRIC_SPLIT
      ? exceptionNote(d, metric as keyof typeof METRIC_SPLIT, i)
      : null;
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
      <p className="mb-1.5 text-[11px] italic text-slate-400">{i.meaning(d)}</p>
      <Row label={t.tooltip.type} value={i.place(d.type)} />
      <Row label={t.tooltip.revealed} value={`#${d.revelationOrder}`} />
      <Row label={t.common.verses} value={d.ayahCount} />
      <Row label={t.common.words} value={n(d.wordCount)} />
      <Row label={t.common.letters} value={n(d.letterCount)} />
      <Row
        label={t.tooltip.avgWords}
        value={d.avgWords.toLocaleString(t.locale, {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })}
      />
      {note && (
        <p className="mt-1 max-w-56 text-[11px] text-slate-500 dark:text-slate-400">
          {note}
        </p>
      )}
      <p className="mt-1.5 border-t border-slate-100 pt-1 text-[11px] text-slate-400 dark:border-slate-700">
        {t.tooltip.opening(i.category(d.category))}
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
  const { n } = useI18n();
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
          value={`${n(p.value)}${unit ? ` ${unit}` : ""}`}
          color={p.color}
        />
      ))}
    </Shell>
  );
}

export { Shell as TooltipShell, Row as TooltipRow };
