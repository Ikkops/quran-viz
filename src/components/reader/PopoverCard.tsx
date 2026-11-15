import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { BookOpen, Play, X } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { useDismiss } from "../../lib/useDismiss";
import { popupRoot, rootZoom } from "../ui/popup";
import type { PickRect } from "./wordPick";

/**
 * The small card the reader opens by a tapped word or ayah (the word popup,
 * the ayah popup): portalled into the app root, under the spot or above it
 * when there is no room, kept inside the screen; closes on an outside press
 * or Escape.
 */
export function PopoverCard({
  rect,
  label,
  onClose,
  children,
}: {
  rect: PickRect;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, true, onClose);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  // Re-placed after every render (content that loads changes the height);
  // the state only changes when the place does, so it settles.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const z = rootZoom(popupRoot());
    const vw = window.innerWidth / z;
    const vh = (window.visualViewport?.height ?? window.innerHeight) / z;
    const width = Math.min(320, vw - 24);
    const h = el.offsetHeight;
    const mid = (rect.left + rect.right) / 2 / z;
    const left = Math.min(Math.max(12, mid - width / 2), vw - 12 - width);
    const below = rect.bottom / z + 6;
    const top = below + h + 12 > vh ? Math.max(12, rect.top / z - 6 - h) : below;
    setStyle((s) =>
      s.left === left && s.top === top && s.width === width
        ? s
        : { position: "fixed", left, top, width },
    );
  });

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      style={style}
      className="z-50 rounded-xl border border-line bg-surface px-4 py-3.5 text-ink shadow-float"
    >
      {children}
    </div>,
    popupRoot(),
  );
}

/** The popup's close button, at its top corner. */
export function PopoverClose({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={t.common.close}
      className="-mr-2 -mt-1.5 inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink touch:min-h-11 touch:min-w-11"
    >
      <X size={16} aria-hidden />
    </button>
  );
}

/** The popup's foot: `children` at the start, then play from the ayah and
 *  open its context. */
export function PopoverActions({
  canPlay,
  onPlay,
  onContext,
  children,
}: {
  canPlay: boolean;
  onPlay: () => void;
  onContext: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="-mx-1 mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-2">
      {children}
      <span className="flex-1" />
      {canPlay && (
        <button
          type="button"
          onClick={onPlay}
          aria-label={t.word.playAyah}
          title={t.word.playAyah}
          className="inline-flex items-center justify-center rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink touch:min-h-11 touch:min-w-11"
        >
          <Play size={16} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={onContext}
        aria-label={t.word.ayahContext}
        title={t.word.ayahContext}
        className="inline-flex items-center justify-center rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink touch:min-h-11 touch:min-w-11"
      >
        <BookOpen size={16} aria-hidden />
      </button>
    </div>
  );
}
