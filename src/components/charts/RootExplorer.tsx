import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RootEntry, Surah, Verse } from "../../types/quran";
import { rootSurahCounts, searchRoots, topRootsForSurah } from "../../data/roots";
import { cx, SegmentedControl, Select } from "../ui";
import { TooltipRow, TooltipShell } from "../tooltips";
import { HorizontalBarChart } from "./HorizontalBarChart";
import { axisColor, type ChartContext } from "./common";

type Mode = "root" | "surah";
type Measure = "count" | "density";

interface SurahRow {
  s: number;
  name: string;
  type: Surah["type"];
  count: number;
  density: number; // occurrences per 1,000 words
  first: number;
}

function SurahRowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: SurahRow }[];
}) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipShell>
      <div className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
        {r.s}. {r.name}
      </div>
      <TooltipRow label="Occurrences" value={r.count} />
      <TooltipRow label="Per 1,000 words" value={r.density.toFixed(1)} />
    </TooltipShell>
  );
}

interface RootRow extends Record<string, unknown> {
  ar: string;
  bw: string;
  gloss: string;
  count: number;
}

function RootRowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RootRow }[];
}) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipShell>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-arabic text-base text-slate-800 dark:text-slate-100">
          {r.ar}
        </span>
        <span className="text-[11px] text-slate-400">({r.bw})</span>
      </div>
      {r.gloss && <p className="mb-1 text-[11px] italic text-slate-400">{r.gloss}</p>}
      <TooltipRow label="In this surah" value={r.count} />
      <p className="mt-1 text-[11px] text-slate-400">Click to see it across all surahs</p>
    </TooltipShell>
  );
}

/**
 * Explore the corpus roots two ways: pick a root and see where it occurs across
 * the surahs (raw or per 1,000 words), or pick a surah and see its top roots.
 * Respects the dashboard filter through `verses`.
 */
export function RootExplorer({
  roots,
  verses,
  surahMap,
  ctx,
}: {
  roots: RootEntry[];
  verses: Verse[];
  surahMap: Map<number, Surah>;
  ctx: ChartContext;
}) {
  const [mode, setMode] = useState<Mode>("root");
  const [measure, setMeasure] = useState<Measure>("count");
  const [query, setQuery] = useState("");
  const [selectedBw, setSelectedBw] = useState("ktb");
  const [surah, setSurah] = useState<number | null>(null);

  const inScope = useMemo(() => new Map(verses.map((v) => [v.id, v])), [verses]);
  const surahIds = useMemo(() => [...new Set(verses.map((v) => v.s))], [verses]);
  const wordsBySurah = useMemo(() => {
    const m = new Map<number, number>();
    for (const v of verses) m.set(v.s, (m.get(v.s) ?? 0) + v.w);
    return m;
  }, [verses]);

  const selected = roots.find((r) => r.bw === selectedBw) ?? roots[0];
  // Keep the selected root visible as a chip even when it isn't a match.
  const found = useMemo(() => searchRoots(roots, query, 10), [roots, query]);
  const matches = found.includes(selected) ? found : [selected, ...found.slice(0, 9)];

  const surahRows: SurahRow[] = useMemo(() => {
    const counts = rootSurahCounts(selected, inScope);
    return surahIds.map((s) => {
      const c = counts.get(s);
      const words = wordsBySurah.get(s) ?? 0;
      const count = c?.count ?? 0;
      return {
        s,
        name: surahMap.get(s)?.nameEn ?? String(s),
        type: surahMap.get(s)?.type ?? "Meccan",
        count,
        density: words ? (count / words) * 1000 : 0,
        first: c?.first ?? 0,
      };
    });
  }, [selected, inScope, surahIds, wordsBySurah, surahMap]);

  const activeSurah = surah !== null && surahIds.includes(surah) ? surah : surahIds[0];
  const rootRows: RootRow[] = useMemo(
    () =>
      mode === "surah" && activeSurah !== undefined
        ? topRootsForSurah(roots, inScope, activeSurah, 25).map(({ root, count }) => ({
            ar: root.ar,
            bw: root.bw,
            gloss: root.gloss,
            count,
          }))
        : [],
    [mode, roots, inScope, activeSurah],
  );

  const total = surahRows.reduce((n, r) => n + r.count, 0);
  const inSurahs = surahRows.filter((r) => r.count > 0).length;
  const ac = axisColor(ctx.dark);

  const pickRoot = (bw: string) => {
    setSelectedBw(bw);
    setMode("root");
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          ariaLabel="Explore by"
          options={[
            { value: "root", label: "By root" },
            { value: "surah", label: "By surah" },
          ]}
        />
        {mode === "root" ? (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a root: كتب, ktb, write…"
              aria-label="Find a root"
              className="w-44 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <SegmentedControl<Measure>
              value={measure}
              onChange={setMeasure}
              ariaLabel="Measure"
              options={[
                { value: "count", label: "Count" },
                { value: "density", label: "Per 1k words" },
              ]}
            />
          </>
        ) : (
          <div className="w-64">
            <Select
              value={activeSurah}
              onChange={(e) => setSurah(Number(e.target.value))}
              aria-label="Surah"
            >
              {surahIds.map((s) => (
                <option key={s} value={s}>
                  {s}. {surahMap.get(s)?.nameEn}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {mode === "root" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {matches.map((r) => (
              <button
                key={r.bw}
                onClick={() => setSelectedBw(r.bw)}
                title={`${r.bw} · ${r.gloss} · ${r.v.length.toLocaleString()} occurrences`}
                className={cx(
                  "rounded-full border px-2.5 py-0.5 font-arabic text-base transition",
                  r.bw === selected.bw
                    ? "border-transparent text-white"
                    : "border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800",
                )}
                style={
                  r.bw === selected.bw ? { backgroundColor: ctx.primary } : undefined
                }
              >
                {r.ar}
              </button>
            ))}
            {found.length === 0 && (
              <span className="text-sm text-slate-400">No root matches “{query}”.</span>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-arabic text-lg text-slate-800 dark:text-slate-100">
              {selected.ar}
            </span>{" "}
            <span className="text-slate-400">({selected.bw})</span>
            {selected.gloss && (
              <span className="italic text-slate-400"> “{selected.gloss}”</span>
            )}{" "}
            — {total.toLocaleString()} occurrences in {inSurahs} of {surahIds.length}{" "}
            surahs. Click a bar to read the first one.
          </p>
          <div className="min-h-[240px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={surahRows}
                margin={{ top: 8, right: 12, bottom: 24, left: 0 }}
              >
                <XAxis
                  dataKey="s"
                  tick={{ fontSize: 10, fill: ac }}
                  interval={surahRows.length > 40 ? 9 : 0}
                  label={{
                    value: "Surah",
                    position: "insideBottom",
                    offset: -12,
                    fontSize: 11,
                    fill: ac,
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: ac }}
                  allowDecimals={measure === "density"}
                />
                <Tooltip
                  content={<SurahRowTooltip />}
                  cursor={{ fill: "rgba(148,163,184,0.12)" }}
                />
                <Bar
                  dataKey={measure}
                  radius={[2, 2, 0, 0]}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(d: unknown) => {
                    const r = (d as { payload: SurahRow }).payload;
                    if (r.count)
                      ctx.onOpen?.({ scope: "surah", value: r.s, anchor: r.first });
                  }}
                >
                  {surahRows.map((r) => (
                    <Cell
                      key={r.s}
                      fill={r.type === "Meccan" ? ctx.palette.pie[0] : ctx.palette.pie[1]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {mode === "surah" && (
        <div className="min-h-[240px] flex-1">
          <HorizontalBarChart<RootRow>
            data={rootRows}
            categoryKey="ar"
            valueKey="count"
            categoryWidth={70}
            color={ctx.primary}
            dark={ctx.dark}
            tickStyle={{ fontSize: 16, fontFamily: "var(--font-arabic)" }}
            tooltip={<RootRowTooltip />}
            onBarClick={(r) => pickRoot(r.bw)}
          />
        </div>
      )}
    </div>
  );
}
