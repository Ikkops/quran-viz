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
import type { Surah, Topic, Verse } from "../../types/quran";
import { rootSurahCounts, searchTopics } from "../../data/roots";
import { cx, SegmentedControl } from "../ui";
import { TooltipRow, TooltipShell } from "../tooltips";
import { axisColor, type ChartContext } from "./common";
import { useI18n } from "../../i18n/I18nContext";

type Measure = "count" | "density";

/** Tagged verses listed before "Show all" (about three rows). */
const TAGGED_PREVIEW = 36;

interface SurahRow {
  s: number;
  name: string;
  type: Surah["type"];
  count: number;
  density: number; // tagged verses per 100 verses
  first: number;
}

function SurahRowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: SurahRow }[];
}) {
  const { t } = useI18n();
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipShell>
      <div className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
        {r.s}. {r.name}
      </div>
      <TooltipRow label={t.charts.tagged} value={r.count} />
      <TooltipRow label={t.charts.per100} value={r.density.toFixed(1)} />
    </TooltipShell>
  );
}

/**
 * Pick a QUL topic and see which surahs carry it (raw, or per 100 verses so
 * long surahs don't dominate), plus every tagged verse as a link into the
 * reader. Respects the dashboard filter through `verses`.
 */
export function TopicExplorer({
  topics,
  verses,
  surahMap,
  ctx,
  selectedId,
  onSelectId: setSelectedId,
}: {
  topics: Topic[];
  verses: Verse[];
  surahMap: Map<number, Surah>;
  ctx: ChartContext;
  /** Selected topic id, owned by the dashboard so it is remembered. */
  selectedId: number | null;
  onSelectId: (id: number) => void;
}) {
  const { t: t2, n } = useI18n();
  const [measure, setMeasure] = useState<Measure>("count");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const inScope = useMemo(() => new Map(verses.map((v) => [v.id, v])), [verses]);
  const surahIds = useMemo(() => [...new Set(verses.map((v) => v.s))], [verses]);
  const versesBySurah = useMemo(() => {
    const m = new Map<number, number>();
    for (const v of verses) m.set(v.s, (m.get(v.s) ?? 0) + 1);
    return m;
  }, [verses]);

  const selected = topics.find((t) => t.id === selectedId) ?? topics[0];
  const found = useMemo(() => searchTopics(topics, query, 10), [topics, query]);
  // Keep the selected topic visible as a chip even when it isn't a match.
  const matches = found.includes(selected) ? found : [selected, ...found.slice(0, 9)];

  const rows: SurahRow[] = useMemo(() => {
    const counts = rootSurahCounts(selected, inScope);
    return surahIds.map((s) => {
      const c = counts.get(s);
      const n = versesBySurah.get(s) ?? 0;
      const count = c?.count ?? 0;
      return {
        s,
        name: surahMap.get(s)?.nameEn ?? String(s),
        type: surahMap.get(s)?.type ?? "Meccan",
        count,
        density: n ? (count / n) * 100 : 0,
        first: c?.first ?? 0,
      };
    });
  }, [selected, inScope, surahIds, versesBySurah, surahMap]);

  const tagged = useMemo(
    () => selected.v.map((id) => inScope.get(id)).filter((v): v is Verse => !!v),
    [selected, inScope],
  );
  const inSurahs = rows.filter((r) => r.count > 0).length;
  const ac = axisColor(ctx.dark);
  const open = (v: Verse) => ctx.onOpen?.({ scope: "surah", value: v.s, anchor: v.id });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t2.charts.findTopic}
          aria-label={t2.charts.findTopicAria}
          className="w-56 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <SegmentedControl<Measure>
          value={measure}
          onChange={setMeasure}
          ariaLabel={t2.charts.measure}
          options={[
            { value: "count", label: t2.charts.count },
            { value: "density", label: t2.charts.per100 },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {matches.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSelectedId(t.id);
              setShowAll(false);
            }}
            title={t2.charts.nVerses(n(t.v.length))}
            className={cx(
              "rounded-full border px-2.5 py-0.5 text-sm transition",
              t.id === selected.id
                ? "border-transparent text-white"
                : "border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800",
            )}
            style={t.id === selected.id ? { backgroundColor: ctx.primary } : undefined}
          >
            {t.name}
          </button>
        ))}
        {found.length === 0 && (
          <span className="text-sm text-slate-400">{t2.charts.noTopic(query)}</span>
        )}
      </div>

      <div className="text-sm text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {selected.name}
        </span>
        {selected.ar && (
          <>
            {" "}
            <bdi className="font-arabic text-base">{selected.ar}</bdi>
          </>
        )}{" "}
        {t2.charts.topicSummary(n(tagged.length), inSurahs, surahIds.length)}
        {selected.desc && (
          <p className="mt-0.5 text-xs text-slate-400">{selected.desc}</p>
        )}
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
            <XAxis
              dataKey="s"
              tick={{ fontSize: 10, fill: ac }}
              interval={rows.length > 40 ? 9 : 0}
              label={{
                value: t2.common.surah,
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
              {rows.map((r) => (
                <Cell
                  key={r.s}
                  fill={r.type === "Meccan" ? ctx.palette.pie[0] : ctx.palette.pie[1]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-slate-200 p-2 text-sm tabular-nums dark:border-slate-700">
        <div className="mb-1 text-xs text-slate-400">{t2.charts.taggedClick}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(showAll ? tagged : tagged.slice(0, TAGGED_PREVIEW)).map((v) => (
            <button
              key={v.id}
              onClick={() => open(v)}
              className="text-slate-600 hover:underline dark:text-slate-300"
            >
              {v.s}:{v.a}
            </button>
          ))}
          {tagged.length > TAGGED_PREVIEW && (
            <button
              onClick={() => setShowAll((x) => !x)}
              className="font-medium hover:underline"
              style={{ color: ctx.primary }}
            >
              {showAll ? t2.charts.showFewer : t2.charts.showAllN(n(tagged.length))}
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">{t2.charts.topicSource}</p>
    </div>
  );
}
