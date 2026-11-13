import { useMemo, useState } from "react";
import type { RootEntry, Verse } from "../../types/quran";
import { topRootsInScope } from "../../data/roots";
import { HorizontalBarChart } from "./HorizontalBarChart";
import { TooltipShell } from "../tooltips";
import { Slider } from "../ui";
import { useI18n } from "../../i18n/I18nContext";

interface RootRow extends Record<string, unknown> {
  label: string;
  ar: string;
  bw: string;
  gloss: string;
  count: number;
}

function RootTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RootRow }[];
}) {
  const { t, n } = useI18n();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipShell>
      <div className="mb-1 flex items-center gap-2">
        <span lang="ar" className="font-arabic text-base text-ink">
          {d.ar}
        </span>
        <span className="text-xs text-ink-subtle">({d.bw})</span>
      </div>
      {d.gloss && <p className="mb-1 text-xs italic text-ink-subtle">{d.gloss}</p>}
      <div className="font-semibold tabular-nums text-ink">
        {t.charts.occurrences(n(d.count))}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">{t.charts.exploreRoot}</p>
    </TooltipShell>
  );
}

/** Row height that leaves room for Arabic ascenders and descenders. */
const ROW_PX = 26;

/** The most frequent roots within the dashboard range (from roots.json). */
export function RootChart({
  roots,
  verses,
  primary,
  dark,
  onPick,
}: {
  roots: RootEntry[];
  verses: Verse[];
  primary: string;
  dark: boolean;
  onPick?: (bw: string) => void;
}) {
  const { t } = useI18n();
  const [limit, setLimit] = useState(20);
  const scope = useMemo(() => new Set(verses.map((v) => v.id)), [verses]);
  const rows: RootRow[] = useMemo(
    () =>
      topRootsInScope(roots, scope, limit).map(({ root, count }) => ({
        label: `${root.ar} · ${root.bw}`,
        ar: root.ar,
        bw: root.bw,
        gloss: root.gloss,
        count,
      })),
    [roots, scope, limit],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="w-56">
        <Slider
          label={t.charts.rootsShown}
          min={10}
          max={40}
          step={5}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        />
      </div>
      <div style={{ height: rows.length * ROW_PX + 40 }}>
        <HorizontalBarChart<RootRow>
          data={rows}
          categoryKey="label"
          valueKey="count"
          categoryWidth={110}
          color={primary}
          dark={dark}
          tickStyle={{ fontSize: 13, fontFamily: '"Amiri", serif' }}
          tooltip={<RootTooltip />}
          onBarClick={onPick && ((r) => onPick(r.bw))}
        />
      </div>
    </div>
  );
}
