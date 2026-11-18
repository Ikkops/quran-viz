import {
  cloneElement,
  startTransition,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

/**
 * Recharts' `ResponsiveContainer` (the 100% × 100% form the charts use),
 * except that the chart draws in a transition: React slices its render (some
 * 300 ms on a phone for one bar chart), so a tap or a scroll is never held up
 * by it. The size comes from a ResizeObserver callback, where layout is done.
 */
export function ResponsiveContainer({
  children,
}: {
  width?: string;
  height?: string;
  children: ReactElement<{ width?: number; height?: number }>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      startTransition(() => setSize((s) => (s && s.w === w && s.h === h ? s : { w, h })));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className="recharts-responsive-container"
      style={{ width: "100%", height: "100%" }}
    >
      {size && size.w > 0 && size.h > 0
        ? cloneElement(children, { width: size.w, height: size.h })
        : null}
    </div>
  );
}
