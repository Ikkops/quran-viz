import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  HandHeart,
  Heart,
  Hourglass,
  Landmark,
  Leaf,
  Scale,
  Scroll,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Surah, Verse } from "../../types/quran";
import { rootSurahCounts } from "../../data/roots";
import {
  formatRun,
  groupBySurah,
  searchTopicTree,
  topicName,
  topicPath,
  type TopicTree,
} from "../../data/topics";
import { cx, SegmentedControl } from "../ui";
import { TooltipRow, TooltipShell } from "../tooltips";
import { axisColor, CURSOR_FILL, type ChartContext } from "./common";
import { useI18n } from "../../i18n/I18nContext";

type Measure = "count" | "density";

/** Surah rows listed before "Show all". */
const SURAH_PREVIEW = 12;
/** Subtopics listed before "Show all" (the top level always lists all). */
const KIDS_PREVIEW = 9;
const SEARCH_LIMIT = 30;
const NO_AYAHS: number[] = [];

/** Icon per top category (keys from scripts/data/topic_taxonomy.json). */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  aqidah: Sparkles,
  akhirat: Hourglass,
  ibadah: HandHeart,
  akhlak: Heart,
  jiwa: Heart,
  keluarga: Users,
  muamalah: Scale,
  siyasah: Landmark,
  sejarah: Scroll,
  ilmu: GraduationCap,
  alam: Leaf,
};

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
      <div className="mb-1 font-semibold text-ink">
        {r.s}. {r.name}
      </div>
      <TooltipRow label={t.charts.tagged} value={r.count} />
      <TooltipRow label={t.charts.per100} value={r.density.toFixed(1)} />
    </TooltipShell>
  );
}

/**
 * Browse the curated topic tree (category → subtopic → …), or search it in
 * Indonesian, English or Arabic. The selected topic shows which surahs carry
 * it (raw, or per 100 verses) and its verses grouped by surah, each a link
 * into the reader. A topic counts its subtopics' verses too. Respects the
 * dashboard filter through `verses`.
 */
export function TopicExplorer({
  tree,
  verses,
  surahMap,
  ctx,
  selectedKey,
  onSelectKey,
}: {
  tree: TopicTree;
  verses: Verse[];
  surahMap: Map<number, Surah>;
  ctx: ChartContext;
  /** Selected node key (null = top level), owned by the dashboard so it is remembered. */
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
}) {
  const { t: t2, n, lang } = useI18n();
  const [measure, setMeasure] = useState<Measure>("count");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [allKids, setAllKids] = useState(false);

  const inScope = useMemo(() => new Map(verses.map((v) => [v.id, v])), [verses]);
  const surahIds = useMemo(() => [...new Set(verses.map((v) => v.s))], [verses]);
  const versesBySurah = useMemo(() => {
    const m = new Map<number, number>();
    for (const v of verses) m.set(v.s, (m.get(v.s) ?? 0) + 1);
    return m;
  }, [verses]);

  const sel = selectedKey != null ? (tree.byKey.get(selectedKey) ?? null) : null;
  const path = sel != null ? topicPath(tree, sel) : [];
  const kids = sel != null ? tree.children[sel] : tree.roots;
  const name = (i: number) => topicName(tree.nodes[i], lang);
  const other = (i: number) => topicName(tree.nodes[i], lang === "id" ? "en" : "id");
  const countIn = (i: number) => {
    let c = 0;
    for (const id of tree.all[i]) if (inScope.has(id)) c++;
    return c;
  };

  const select = (i: number | null) => {
    onSelectKey(i == null ? null : tree.nodes[i].k);
    setShowAll(false);
    setAllKids(false);
    setQuery("");
  };

  const found = useMemo(() => searchTopicTree(tree, query, SEARCH_LIMIT), [tree, query]);
  const selAll = sel != null ? tree.all[sel] : NO_AYAHS;
  const tagged = useMemo(() => selAll.filter((id) => inScope.has(id)), [selAll, inScope]);
  const groups = useMemo(() => groupBySurah(tagged, inScope), [tagged, inScope]);

  const rows: SurahRow[] = useMemo(() => {
    const counts = rootSurahCounts({ v: tagged }, inScope);
    return surahIds.map((s) => {
      const c = counts.get(s);
      const total = versesBySurah.get(s) ?? 0;
      const count = c?.count ?? 0;
      return {
        s,
        name: surahMap.get(s)?.name ?? String(s),
        type: surahMap.get(s)?.type ?? "Meccan",
        count,
        density: total ? (count / total) * 100 : 0,
        first: c?.first ?? 0,
      };
    });
  }, [tagged, inScope, surahIds, versesBySurah, surahMap]);

  const ac = axisColor(ctx.dark);
  const openAyah = (id: number) => {
    const v = inScope.get(id);
    if (v) ctx.onOpen?.({ scope: "surah", value: v.s, anchor: id });
  };
  const node = sel != null ? tree.nodes[sel] : null;

  const rowButton = (i: number, opts: { hint?: string; icon?: LucideIcon }) => {
    const c = countIn(i);
    const Icon = opts.icon;
    const hasKids = tree.children[i].length > 0;
    return (
      <button
        key={i}
        onClick={() => select(i)}
        className={cx(
          "flex w-full items-center gap-2.5 rounded-lg border border-line px-2.5 py-2 text-left text-sm transition hover:bg-paper dark:hover:bg-surface",
          c === 0 && "opacity-50",
        )}
      >
        {Icon && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken dark:bg-surface"
            style={{ color: ctx.primary }}
          >
            <Icon size={16} aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink">{name(i)}</span>
          {opts.hint && (
            <span className="block truncate text-xs text-ink-subtle">{opts.hint}</span>
          )}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-ink-muted dark:text-ink-subtle">
          {n(c)}
        </span>
        {hasKids && (
          <ChevronRight size={14} className="shrink-0 text-ink-subtle" aria-hidden />
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t2.charts.findTopic}
          aria-label={t2.charts.findTopicAria}
          className="w-64 max-w-full rounded-lg min-h-10 touch:min-h-11 border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
        />
        {node && (
          <SegmentedControl<Measure>
            value={measure}
            onChange={setMeasure}
            ariaLabel={t2.charts.measure}
            options={[
              { value: "count", label: t2.charts.count },
              { value: "density", label: t2.charts.per100 },
            ]}
          />
        )}
      </div>

      <nav
        aria-label={t2.charts.topicBreadcrumb}
        className="flex flex-wrap items-center gap-1 text-sm"
      >
        <button
          onClick={() => select(null)}
          className={cx(
            "hover:underline",
            sel == null ? "font-semibold text-ink" : "text-ink-muted",
          )}
        >
          {t2.charts.allTopics}
        </button>
        {path.map((i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={12} className="text-ink-subtle" aria-hidden />
            <button
              onClick={() => select(i)}
              className={cx(
                "hover:underline",
                i === sel ? "font-semibold text-ink" : "text-ink-muted",
              )}
            >
              {name(i)}
            </button>
          </span>
        ))}
      </nav>

      {query.trim() ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-1.5">
          {found.map((i) =>
            rowButton(i, {
              hint: topicPath(tree, i)
                .slice(0, -1)
                .map((j) => name(j))
                .join(" › "),
            }),
          )}
          {found.length === 0 && (
            <span className="text-sm text-ink-subtle">{t2.charts.noTopic(query)}</span>
          )}
        </div>
      ) : (
        <>
          {node && sel != null && (
            <div className="text-sm text-ink-muted">
              <span className="text-base font-semibold text-ink">{name(sel)}</span>
              {other(sel) !== name(sel) && (
                <span className="text-ink-subtle"> · {other(sel)}</span>
              )}
              {node.ar && (
                <>
                  {" "}
                  <bdi lang="ar" className="font-arabic text-base">
                    {node.ar}
                  </bdi>
                </>
              )}{" "}
              {t2.charts.topicSummary(n(tagged.length), groups.length, surahIds.length)}
              {node.desc && <p className="mt-0.5 text-xs text-ink-subtle">{node.desc}</p>}
            </div>
          )}

          {kids.length > 0 && (
            <div>
              {sel != null && (
                <div className="mb-1 text-xs text-ink-subtle">{t2.charts.subtopics}</div>
              )}
              {sel == null && (
                <p className="mb-2 text-xs text-ink-subtle">{t2.charts.pickTopic}</p>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-1.5">
                {(sel == null || allKids ? kids : kids.slice(0, KIDS_PREVIEW)).map((i) =>
                  rowButton(i, {
                    icon:
                      sel == null
                        ? (CATEGORY_ICONS[tree.nodes[i].k] ?? BookOpen)
                        : undefined,
                    hint: sel == null ? other(i) : undefined,
                  }),
                )}
              </div>
              {sel != null && kids.length > KIDS_PREVIEW && (
                <button
                  onClick={() => setAllKids((x) => !x)}
                  className="mt-1 text-sm font-medium hover:underline"
                  style={{ color: ctx.primary }}
                >
                  {allKids ? t2.charts.showFewer : t2.charts.showAllN(n(kids.length))}
                </button>
              )}
            </div>
          )}

          {node && tagged.length > 0 && (
            <>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rows}
                    margin={{ top: 8, right: 12, bottom: 24, left: 0 }}
                  >
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
                      cursor={{ fill: CURSOR_FILL }}
                    />
                    <Bar
                      dataKey={measure}
                      radius={[2, 2, 0, 0]}
                      cursor="pointer"
                      isAnimationActive={false}
                      onClick={(d: unknown) => {
                        const r = (d as { payload: SurahRow }).payload;
                        if (r.count) openAyah(r.first);
                      }}
                    >
                      {rows.map((r) => (
                        <Cell
                          key={r.s}
                          fill={
                            r.type === "Meccan" ? ctx.palette.pie[0] : ctx.palette.pie[1]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border border-line p-2 text-sm">
                <div className="mb-1.5 text-xs text-ink-subtle">
                  {t2.charts.versesBySurah}
                </div>
                <ul className="divide-y divide-surface-sunken dark:divide-surface">
                  {(showAll ? groups : groups.slice(0, SURAH_PREVIEW)).map((g) => (
                    <li
                      key={g.s}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5"
                    >
                      <span className="w-44 shrink-0 text-ink">
                        <span className="tabular-nums text-ink-subtle">{g.s}.</span>{" "}
                        {surahMap.get(g.s)?.name ?? g.s}{" "}
                        <span className="text-xs tabular-nums text-ink-subtle">
                          ({n(g.count)})
                        </span>
                      </span>
                      <span className="flex flex-1 flex-wrap gap-x-2.5 gap-y-1 tabular-nums">
                        {g.runs.map((r) => (
                          <button
                            key={r[2]}
                            onClick={() => openAyah(r[2])}
                            className="text-ink-muted hover:underline"
                          >
                            {formatRun(r)}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
                {groups.length > SURAH_PREVIEW && (
                  <button
                    onClick={() => setShowAll((x) => !x)}
                    className="mt-1 text-sm font-medium hover:underline"
                    style={{ color: ctx.primary }}
                  >
                    {showAll ? t2.charts.showFewer : t2.charts.showAllN(n(groups.length))}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
      <p className="text-xs text-ink-subtle">{t2.charts.topicSource}</p>
    </div>
  );
}
