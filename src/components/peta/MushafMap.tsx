import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";

type CanvasPoint = { currentTarget: HTMLCanvasElement; clientX: number; clientY: number };
import type { Surah, Verse } from "../../types/quran";
import {
  ayahAt,
  ayahInNextRow,
  REVEAL_FADE,
  revealAlpha,
  revealStarts,
  type MapLayout,
} from "../../data/mushafMap";
import { ayahPlace } from "../../data/selectors";
import { tokens } from "../../theme/tokens";
import { useElementWidth } from "../../lib/useElementWidth";

/** Row geometry in CSS px (before the app's zoom). */
const ROW_H = 14;
const GAP = 7;
const TOP = 5;
const LABEL_W = 30;

export interface MapMarks {
  sajda: boolean;
  lastRead?: number;
  bookmarks?: number[];
}

/** mouse click · touch tap · Enter key · arrow-key move (select only). */
export type PickHow = "mouse" | "touch" | "key" | "move";

/**
 * The canvas behind the Peta Mushaf: draws every ayah of a `MapLayout` in its
 * place colour, dims everything outside `highlight`, and marks sajdah,
 * bookmarks, the last-read ayah and the selection. Pointer and arrow keys move
 * over ayahs; `onPick` reports a click / tap / Enter.
 */
export function MushafMap({
  layout,
  verses,
  surahMap,
  dark,
  highlight,
  marks,
  hoverId,
  selectedId,
  onHover,
  onPick,
  label,
  describedBy,
  reveal,
  onRevealSurah,
}: {
  layout: MapLayout;
  verses: Verse[];
  surahMap: Map<number, Surah>;
  dark: boolean;
  highlight: Set<number> | null;
  marks: MapMarks;
  hoverId: number | null;
  selectedId: number | null;
  onHover: (id: number | null) => void;
  onPick: (id: number, how: PickHow) => void;
  label: string;
  describedBy?: string;
  /** Play the opening reveal over `ms`; a new object replays it. */
  reveal?: { ms: number } | null;
  /** The surah now appearing during the reveal; null when it ends. */
  onRevealSurah?: (s: Surah | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = useElementWidth(wrapRef);
  const mapW = Math.max(0, width - LABEL_W);
  const height = TOP + layout.rows.length * (ROW_H + GAP);

  // Opening reveal (DESIGN.md: the one orchestrated moment): ayahs appear
  // surah by surah in revelation order, then the map stands in mushaf order.
  const starts = useMemo(
    () => revealStarts(verses, (s) => surahMap.get(s)?.revelationOrder),
    [verses, surahMap],
  );

  /** Draw the map; `p` is the reveal's progress (0–1), or null when settled. */
  const paint = useCallback(
    (p: number | null) => {
      const cv = canvasRef.current;
      if (!cv || mapW <= 0) return;
      // Backing store in device pixels: CSS px × devicePixelRatio × the app zoom.
      const zoom = cv.getBoundingClientRect().width / (cv.offsetWidth || 1) || 1;
      const scale = (window.devicePixelRatio || 1) * zoom;
      const bw = Math.round(mapW * scale);
      const bh = Math.round(height * scale);
      if (cv.width !== bw) cv.width = bw;
      if (cv.height !== bh) cv.height = bh;
      const g = cv.getContext("2d");
      if (!g) return;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.clearRect(0, 0, mapW, height);
      const tk = tokens(dark);
      const colour = { Meccan: tk.makki, Medinan: tk.madani, Hijra: tk.hijra };
      const yOf = (r: number) => TOP + r * (ROW_H + GAP);
      const span = (id: number, minW: number) => {
        const x = layout.x0[id] * mapW;
        return [x, Math.max(minW, layout.x1[id] * mapW - x)] as const;
      };
      const shown = (id: number) => (p === null ? 1 : revealAlpha(starts[id], p));

      // Base: every ayah in its place colour, dimmed when outside the highlight.
      for (const v of verses) {
        const a = shown(v.id);
        if (a <= 0) continue;
        const [x, w] = span(v.id, 0.6);
        g.globalAlpha = (highlight && !highlight.has(v.id) ? 0.16 : 1) * a;
        g.fillStyle = colour[ayahPlace(v, surahMap)];
        g.fillRect(x, yOf(layout.row[v.id]), w, ROW_H);
      }
      g.globalAlpha = 1;
      // Surah starts: a hairline of paper, so surahs read as separate runs.
      g.fillStyle = tk.paper;
      for (const v of verses)
        if (v.a === 1 && v.id !== layout.rows[layout.row[v.id]].first)
          g.fillRect(layout.x0[v.id] * mapW - 0.5, yOf(layout.row[v.id]), 1, ROW_H);
      // Highlighted ayahs again, at least 2px wide, so single ayahs stay visible.
      if (highlight) {
        for (const id of highlight) {
          const v = verses[id - 1];
          if (!v) continue;
          g.globalAlpha = shown(id);
          const [x, w] = span(id, 2);
          g.fillStyle = colour[ayahPlace(v, surahMap)];
          g.fillRect(x, yOf(layout.row[id]), w, ROW_H);
        }
        g.globalAlpha = 1;
      }
      if (p !== null) return; // marks and rings once the map has settled
      const dot = (id: number, above: boolean, fill: string) => {
        const [x, w] = span(id, 0);
        const y = yOf(layout.row[id]) + (above ? -3.5 : ROW_H + 3.5);
        g.beginPath();
        g.arc(x + w / 2, y, 2.2, 0, Math.PI * 2);
        g.fillStyle = fill;
        g.fill();
      };
      if (marks.sajda)
        for (const v of verses) if (v.sajda === 1) dot(v.id, true, tk.rubric);
      for (const id of marks.bookmarks ?? [])
        if (verses[id - 1]) dot(id, false, tk.illumination);
      if (marks.lastRead && verses[marks.lastRead - 1]) {
        const [x, w] = span(marks.lastRead, 0);
        g.fillStyle = tk.ink;
        g.fillRect(x + w / 2 - 1, yOf(layout.row[marks.lastRead]) - 3, 2, ROW_H + 6);
      }
      const ring = (id: number | null, lw: number) => {
        if (!id || !verses[id - 1]) return;
        const [x, w] = span(id, 4);
        g.lineWidth = lw;
        g.strokeStyle = tk.ink;
        g.strokeRect(x - 1, yOf(layout.row[id]) - 1, w + 2, ROW_H + 2);
      };
      ring(hoverId, 1);
      ring(selectedId, 2);
    },
    [
      layout,
      verses,
      surahMap,
      dark,
      highlight,
      marks,
      hoverId,
      selectedId,
      mapW,
      height,
      starts,
    ],
  );

  // The reveal in progress (its frame handle), so a redraw does not cut it short.
  const anim = useRef<{ frame: number; finish: () => void } | null>(null);
  const paintRef = useRef(paint);
  const progressRef = useRef(onRevealSurah);
  useLayoutEffect(() => {
    paintRef.current = paint;
    progressRef.current = onRevealSurah;
  });

  useEffect(() => {
    if (!anim.current) paint(null);
  }, [paint]);

  const ready = mapW > 0;
  useEffect(() => {
    if (!reveal || !ready) return;
    // Surahs by revelation order, to name the one now appearing.
    const byOrder = [...surahMap.values()].sort(
      (a, b) => a.revelationOrder - b.revelationOrder,
    );
    let last = -1;
    const t0 = performance.now();
    const finish = () => {
      if (!anim.current) return;
      cancelAnimationFrame(anim.current.frame);
      anim.current = null;
      progressRef.current?.(null);
      paintRef.current(null);
    };
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / reveal.ms);
      if (p >= 1) return finish();
      const i = Math.min(byOrder.length - 1, Math.floor((p / (1 - REVEAL_FADE)) * 114));
      if (i !== last && byOrder[i]) {
        last = i;
        progressRef.current?.(byOrder[i]);
      }
      paintRef.current(p);
      if (anim.current) anim.current.frame = requestAnimationFrame(step);
    };
    anim.current = { frame: requestAnimationFrame(step), finish };
    return finish;
  }, [reveal, ready, surahMap]);

  /** Any press or key during the reveal ends it at once. */
  const skipReveal = () => anim.current?.finish();

  /** Ayah under a pointer event, from its position in CSS px. */
  const ayahFromEvent = useCallback(
    (e: CanvasPoint): number | null => {
      const cv = e.currentTarget;
      const rect = cv.getBoundingClientRect();
      const k = rect.width / (cv.offsetWidth || 1) || 1;
      const x = (e.clientX - rect.left) / k;
      const y = (e.clientY - rect.top) / k;
      const r = Math.min(
        layout.rows.length - 1,
        Math.max(0, Math.floor((y - TOP + GAP / 2) / (ROW_H + GAP))),
      );
      return mapW > 0 ? ayahAt(layout, r, x / mapW) : null;
    },
    [layout, mapW],
  );

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    skipReveal();
    const cur = selectedId ?? hoverId ?? layout.rows[0]?.first ?? 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = Math.min(verses.length, cur + 1);
    else if (e.key === "ArrowLeft") next = Math.max(1, cur - 1);
    else if (e.key === "ArrowDown") next = ayahInNextRow(layout, cur, 1);
    else if (e.key === "ArrowUp") next = ayahInNextRow(layout, cur, -1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = verses.length;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(cur, "key");
      return;
    }
    if (next !== null) {
      e.preventDefault();
      onPick(next, "move");
    }
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      onKeyDown={onKey}
      onPointerDown={skipReveal}
      className="relative flex w-full rounded-md"
    >
      <div className="shrink-0" style={{ width: LABEL_W }} aria-hidden>
        {layout.rows.map((r, i) => (
          <div
            key={r.n}
            className="absolute text-xs tabular-nums leading-none text-ink-subtle"
            style={{ top: TOP + i * (ROW_H + GAP) + 2, left: 0 }}
          >
            {r.n}
          </div>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        className="block cursor-pointer touch-manipulation"
        style={{ width: mapW, height }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") onHover(ayahFromEvent(e));
        }}
        onPointerLeave={() => onHover(null)}
        onClick={(e) => {
          const id = ayahFromEvent(e);
          // A click is a PointerEvent in current browsers; without a type, a mouse.
          const type = (e.nativeEvent as Partial<PointerEvent>).pointerType;
          if (id) onPick(id, type === "touch" || type === "pen" ? "touch" : "mouse");
        }}
      />
    </div>
  );
}
