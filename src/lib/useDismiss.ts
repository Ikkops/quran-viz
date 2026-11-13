import { useEffect, useRef, type RefObject } from "react";

/** While `open`, a press outside `ref` or Escape calls `onClose` (popovers). */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const tgt = e.target as Element | null;
      // A Select's list is portalled out of the popover; a press in it is inside.
      if (tgt?.closest?.("[data-select-popup]")) return;
      if (ref.current && !ref.current.contains(tgt)) close.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [ref, open]);
}
