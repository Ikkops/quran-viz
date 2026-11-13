import { useEffect, useState, type RefObject } from "react";

/**
 * An element's width in its own CSS px, kept current with a ResizeObserver.
 * `clientWidth` is unaffected by the app root's CSS zoom, so layout decisions
 * made from it hold at every Interface scale (media queries would not).
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
