import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Surah, Verse } from "../../types/quran";
import { ayahAt, buildMapLayout } from "../../data/mushafMap";
import { ayahPlace } from "../../data/selectors";
import { tokens } from "../../theme/tokens";
import { useElementWidth } from "../../lib/useElementWidth";

const H = 8;

/**
 * The whole Qur'an as one thin strip (each ayah as wide as its text, in its
 * place colour) under the reader's head: the scope being read at full
 * strength, the rest faded, and a mark where the reader is. Click to jump.
 */
export function QuranStrip({
  verses,
  surahMap,
  dark,
  from,
  to,
  at,
  onPick,
  label,
}: {
  verses: Verse[];
  surahMap: Map<number, Surah>;
  dark: boolean;
  from: number;
  to: number;
  at: number | undefined;
  onPick: (id: number) => void;
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useElementWidth(wrap);
  const layout = useMemo(() => buildMapLayout(verses, () => 1), [verses]);
  const [title, setTitle] = useState<string>(label);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || width <= 0) return;
    const zoom = cv.getBoundingClientRect().width / (cv.offsetWidth || 1) || 1;
    const scale = (window.devicePixelRatio || 1) * zoom;
    cv.width = Math.round(width * scale);
    cv.height = Math.round(H * scale);
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, width, H);
    const tk = tokens(dark);
    const colour = { Meccan: tk.makki, Medinan: tk.madani, Hijra: tk.hijra };
    for (const v of verses) {
      const x = layout.x0[v.id] * width;
      g.globalAlpha = v.id >= from && v.id <= to ? 1 : 0.22;
      g.fillStyle = colour[ayahPlace(v, surahMap)];
      g.fillRect(x, 2, Math.max(0.5, layout.x1[v.id] * width - x), H - 4);
    }
    g.globalAlpha = 1;
    // The scope's extent, underlined (at least 6px, so a short surah shows).
    if (verses[from - 1] && verses[to - 1]) {
      const x = layout.x0[from] * width;
      g.fillStyle = tk["ink-muted"];
      g.fillRect(x, H - 1.5, Math.max(6, layout.x1[to] * width - x), 1.5);
    }
    if (at && verses[at - 1]) {
      g.fillStyle = tk.ink;
      g.fillRect(Math.min(width - 2, layout.x0[at] * width), 0, 2, H);
    }
  }, [verses, surahMap, dark, from, to, at, width, layout]);

  const idAt = (e: MouseEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget;
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width || 1);
    return ayahAt(layout, 0, x);
  };

  return (
    <div ref={wrap} className="h-2 w-full shrink-0">
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        title={title}
        className="block h-2 w-full cursor-pointer"
        onMouseMove={(e) => {
          const v = verses[idAt(e) - 1];
          if (v) setTitle(`${v.s}:${v.a} · ${surahMap.get(v.s)?.nameEn ?? ""}`);
        }}
        onClick={(e) => onPick(idAt(e))}
      />
    </div>
  );
}
