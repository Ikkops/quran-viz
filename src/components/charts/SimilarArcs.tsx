import { useMemo, useState } from "react";
import type { SimilarData, Surah, Verse } from "../../types/quran";
import { filterSimilar, type SimilarPair } from "../../data/similar";
import { Select, Slider } from "../ui";
import type { ChartContext } from "./common";
import { useI18n } from "../../i18n/I18nContext";

// SVG user space; stretched to the container with preserveAspectRatio="none",
// so strokes use vector-effect="non-scaling-stroke" and labels live in HTML.
const W = 1000;
const BASE = 360; // arc baseline
const BAND = 22; // surah band height under the baseline
const H = BASE + BAND + 2;
const ARC_RATIO = (BASE - 12) / (W / 2); // the widest arc nearly reaches the top

/**
 * Arc diagram of similar verses (QUL similar-ayah): the mushaf runs left to
 * right as a band of surahs; each arc joins two verses whose wording overlaps.
 * Click an arc to read the first verse; click a surah to focus its arcs.
 */
export function SimilarArcs({
  data,
  verses,
  surahMap,
  ctx,
}: {
  data: SimilarData;
  verses: Verse[];
  surahMap: Map<number, Surah>;
  ctx: ChartContext;
}) {
  const { t, n } = useI18n();
  const [minScore, setMinScore] = useState(80);
  const [focus, setFocus] = useState<number | null>(null);
  const [hover, setHover] = useState<SimilarPair | null>(null);

  const byId = useMemo(() => new Map(verses.map((v) => [v.id, v])), [verses]);
  const maxId = verses.length;
  const x = (id: number) => ((id - 0.5) / maxId) * W;

  const bands = useMemo(() => {
    const m = new Map<number, { s: number; first: number; last: number }>();
    for (const v of verses) {
      const b = m.get(v.s);
      if (!b) m.set(v.s, { s: v.s, first: v.id, last: v.id });
      else b.last = Math.max(b.last, v.id);
    }
    return [...m.values()];
  }, [verses]);

  const pairs = useMemo(
    () => filterSimilar(data, minScore, focus, (id) => byId.get(id)?.s),
    [data, minScore, focus, byId],
  );
  // Draw weakest first so the strongest arcs sit on top.
  const drawOrder = useMemo(() => [...pairs].reverse(), [pairs]);

  const key = (id: number) => {
    const v = byId.get(id);
    return v ? `${v.s}:${v.a}` : String(id);
  };
  const label = (id: number) => {
    const v = byId.get(id);
    return v ? `${surahMap.get(v.s)?.nameEn ?? v.s} ${v.s}:${v.a}` : String(id);
  };
  const open = (id: number) => {
    const v = byId.get(id);
    if (v) ctx.onOpen?.({ scope: "surah", value: v.s, anchor: id });
  };
  const arc = (p: SimilarPair) => {
    const x1 = x(p.a);
    const x2 = x(p.b);
    const rx = Math.max((x2 - x1) / 2, 0.5);
    return `M ${x1} ${BASE} A ${rx} ${rx * ARC_RATIO} 0 0 1 ${x2} ${BASE}`;
  };
  const opacity = (score: number) => 0.18 + ((score - 50) / 50) * 0.5;
  const bandColor = (s: number) =>
    surahMap.get(s)?.type === "Medinan" ? ctx.palette.pie[1] : ctx.palette.pie[0];

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <Slider
            label={t.structure.minScore}
            min={50}
            max={100}
            step={5}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
        </div>
        <div className="w-64">
          <Select
            label={t.structure.focus}
            value={focus ?? ""}
            onChange={(e) => setFocus(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t.structure.allSurahs}</option>
            {bands.map((b) => (
              <option key={b.s} value={b.s}>
                {b.s}. {surahMap.get(b.s)?.nameEn}
              </option>
            ))}
          </Select>
        </div>
        <p className="pb-1 text-sm text-ink-muted dark:text-ink-subtle">
          {t.structure.pairs(n(pairs.length))}
        </p>
      </div>

      <div className="relative min-h-[220px] flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label={t.structure.arcAria}
          onMouseLeave={() => setHover(null)}
        >
          {drawOrder.map((p) => {
            const hot = hover === p;
            return (
              <g key={`${p.a}-${p.b}`}>
                <path
                  d={arc(p)}
                  fill="none"
                  stroke={ctx.primary}
                  strokeOpacity={hot ? 1 : opacity(p.score)}
                  strokeWidth={hot ? 2.5 : 1}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                {/* Wider invisible stroke so thin arcs are easy to hover/click. */}
                <path
                  d={arc(p)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={7}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(p)}
                  onClick={() => open(p.a)}
                />
              </g>
            );
          })}
          {bands.map((b) => (
            <rect
              key={b.s}
              x={x(b.first) - W / maxId / 2}
              y={BASE + 2}
              width={((b.last - b.first + 1) / maxId) * W}
              height={BAND}
              fill={bandColor(b.s)}
              fillOpacity={focus === null || focus === b.s ? (b.s % 2 ? 0.9 : 0.6) : 0.2}
              className="cursor-pointer"
              onClick={() => setFocus(focus === b.s ? null : b.s)}
            >
              <title>
                {b.s}. {surahMap.get(b.s)?.nameEn} {t.structure.clickFocus}
              </title>
            </rect>
          ))}
        </svg>
      </div>

      <p className="min-h-[1.25rem] text-sm text-ink-muted">
        {hover ? (
          <>
            <span className="font-medium">{label(hover.a)}</span> ↔{" "}
            <span className="font-medium">{label(hover.b)}</span>{" "}
            {t.structure.pairInfo(hover.score, hover.words)}
          </>
        ) : (
          <span className="text-ink-subtle">
            {t.structure.arcHint} {data.source}.
          </span>
        )}
      </p>

      {focus !== null && pairs.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-lg border border-line p-2 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {pairs.slice(0, 200).map((p) => (
              <span key={`${p.a}-${p.b}`} className="tabular-nums">
                <button className="hover:underline" onClick={() => open(p.a)}>
                  {key(p.a)}
                </button>
                {" ↔ "}
                <button className="hover:underline" onClick={() => open(p.b)}>
                  {key(p.b)}
                </button>
                <span className="text-ink-subtle"> ({p.score})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
