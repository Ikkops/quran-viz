import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import {
  EASE_IN,
  EASE_OUT,
  animateTo,
  axisLock,
  commits,
  prefersReducedMotion,
  velocity,
  type DragSample,
} from "../../lib/drag";
import { tick } from "../../lib/haptics";
import { popupRoot, rootZoom } from "./popup";

export { Select, type SelectOption } from "./Select";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      // A solid surface one step up the ladder from paper; `shadow-soft` is a
      // faint shadow on light themes and a top-edge highlight on dark ones.
      className={cx("rounded-xl border border-line bg-surface shadow-soft", className)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-[12rem] flex-1">
        <h2 className="text-heading text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-subtle">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Badge({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        !color && "bg-surface-sunken text-ink-muted dark:bg-line dark:text-ink",
        className,
      )}
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Slider({
  label,
  value,
  ...props
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-eyebrow text-ink-muted">
      {label && (
        <span className="flex justify-between">
          <span>{label}</span>
          <span className="tabular-nums text-ink-subtle">{value}</span>
        </span>
      )}
      <input type="range" value={value} {...props} className="accent-illumination" />
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center justify-between gap-3 text-left text-sm text-ink"
    >
      <span>{label}</span>
      <span
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full transition motion-reduce:transition-none",
          checked ? "bg-illumination" : "bg-ink-subtle",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition motion-reduce:transition-none",
            checked ? "left-4" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

const BUTTON_VARIANT = {
  primary: "bg-illumination text-white enabled:hover:bg-illumination/90 dark:text-paper",
  secondary: "border border-line bg-surface text-ink enabled:hover:bg-surface-sunken",
  quiet: "text-ink-muted enabled:hover:bg-surface-sunken enabled:hover:text-ink",
};
const BUTTON_SIZE = {
  md: "h-9 gap-1.5 px-3.5",
  sm: "h-8 gap-1 px-2.5",
};

/**
 * The app's button (DESIGN.md "Buttons"): `primary` (lapis fill, one per view
 * or sheet), `secondary` (surface + hairline), `quiet` (no fill). 36px (`md`)
 * or 32px (`sm`), 44px on touch screens. Full width through `className`.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...props
}: {
  variant?: keyof typeof BUTTON_VARIANT;
  size?: keyof typeof BUTTON_SIZE;
  /** Leading icon (a lucide icon, 16px). */
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors touch:min-h-11",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** A secondary `Button` (kept for its callers). */
export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button {...props} />;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  /** Fill the container, options sharing the width equally. */
  fullWidth?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      // Never wider than its container: on a phone a long strip (the reader's 7
      // scopes, Structure's 8 tabs) scrolls sideways instead of widening the page.
      className={cx(
        "scrollbar-none max-w-full gap-0.5 overflow-x-auto rounded-lg border border-line/60 bg-surface-sunken p-0.5",
        fullWidth ? "flex w-full" : "inline-flex",
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors touch:min-h-11",
            fullWidth ? "flex-1 justify-center" : "shrink-0",
            // Selected: lifted onto the surface (a hairline on dark themes,
            // where the ladder step alone is faint).
            value === o.value
              ? "bg-surface text-ink shadow-soft dark:ring-1 dark:ring-inset dark:ring-line"
              : "text-ink-subtle hover:text-ink",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Open dialogs, oldest first (see the Escape handler in `Modal`). */
const modalStack: object[] = [];

export function Modal({
  open,
  onClose,
  children,
  className,
  ariaLabel,
  fullHeight,
  width,
  onWidthChange,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  fullHeight?: boolean;
  /** Panel width as a fraction (0–1] of the overlay's content width; `null`
   *  or omitted = the default (className) width. */
  width?: number | null;
  /** When set, the panel gets drag handles on both side edges. Called with the
   *  new fraction on release, or `null` on double-click (reset to default). */
  onWidthChange?: (width: number | null) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Width while a drag is in progress (committed via onWidthChange on release).
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  // A drag that ends over the backdrop must not count as a backdrop click.
  const justResized = useRef(false);
  const shownWidth = liveWidth ?? width ?? null;

  /** Overlay content width, in the panel's own CSS px. */
  const availableWidth = () => {
    const ov = overlayRef.current;
    if (!ov) return 0;
    const cs = getComputedStyle(ov);
    return ov.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  };

  // `side` is -1 for the left handle, +1 for the right. The panel is centred,
  // so each edge moves by dx and the width changes by 2·dx.
  const startResize = (side: 1 | -1) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel || !onWidthChange || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = panel.offsetWidth;
    // The app root has CSS `zoom`; pointer coordinates are viewport px while
    // offsetWidth is the panel's CSS px. Convert with their ratio.
    const scale = startW / (panel.getBoundingClientRect().width || startW);
    const avail = availableWidth() || startW;
    const minW = Math.min(480, avail);
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    let next: number | null = null;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) * scale * side;
      const w = Math.min(avail, Math.max(minW, startW + 2 * dx));
      next = w / avail;
      setLiveWidth(next);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      document.body.style.userSelect = prevSelect;
      justResized.current = true;
      setTimeout(() => (justResized.current = false), 0);
      setLiveWidth(null);
      if (next !== null) onWidthChange(next); // a plain click changes nothing
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const keyResize = (side: 1 | -1) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!onWidthChange || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    e.stopPropagation(); // keep the reader's ←/→ scope navigation out of it
    const panel = panelRef.current;
    const avail = availableWidth();
    if (!panel || !avail) return;
    const cur = shownWidth ?? panel.offsetWidth / avail;
    const dir = (e.key === "ArrowRight" ? 1 : -1) * side;
    const min = Math.min(480, avail) / avail;
    onWidthChange(Math.min(1, Math.max(min, cur + dir * 0.02)));
  };

  const { t } = useI18n();
  const handle = (side: 1 | -1) => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t.ui.resize}
      title={t.ui.resizeTitle}
      tabIndex={0}
      onPointerDown={startResize(side)}
      onDoubleClick={() => onWidthChange?.(null)}
      onKeyDown={keyResize(side)}
      // Just outside the card, in the overlay's padding, so it never covers the
      // card's own scrollbar.
      className={cx(
        "group absolute inset-y-0 z-30 hidden w-3 cursor-ew-resize touch-none outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-illumination sm:block",
        side < 0 ? "-left-3" : "-right-3",
      )}
    >
      <span
        className={cx(
          "absolute inset-y-8 w-1 rounded-full transition",
          "group-hover:bg-white/70 group-focus-visible:bg-white dark:group-hover:bg-ink-muted",
          liveWidth !== null && "bg-white dark:bg-ink-subtle",
          side < 0 ? "right-1" : "left-1",
        )}
      />
    </div>
  );

  // Close on Escape + restore focus on close. Only the topmost open dialog
  // handles keys, so Escape over a stacked dialog (About over Welcome) closes one.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const token = {};
    modalStack.push(token);
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Focus trap: keep Tab within the panel.
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the dialog on open.
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panelRef.current)?.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      modalStack.splice(modalStack.indexOf(token), 1);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <ModalTitleId.Provider value={titleId}>
      <div
        ref={overlayRef}
        className={cx(
          "fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm",
          fullHeight
            ? "items-center justify-center p-4 sm:p-8"
            : "items-center justify-center p-4",
        )}
        onClick={() => {
          if (!justResized.current) onClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : titleId}
          tabIndex={-1}
          className={cx(
            // Sized against the overlay (h-full / max-h-full), not `vh`: the app root
            // carries a CSS `zoom` (Interface scale), which multiplies `vh` lengths
            // inside it and would push the panel past the viewport edges.
            "animate-zoom-in relative flex w-full outline-none",
            fullHeight ? "h-full max-w-5xl" : "max-h-full max-w-3xl",
            className,
          )}
          style={
            shownWidth !== null
              ? { width: `${shownWidth * 100}%`, maxWidth: "none" }
              : undefined
          }
          onClick={(e) => e.stopPropagation()}
        >
          {/* The card; the resize handles sit outside it, beside its edges. */}
          <div
            className={cx(
              "min-h-0 w-full overflow-y-auto rounded-2xl border border-line bg-surface shadow-float dark:bg-paper",
              fullHeight && "flex h-full flex-col",
            )}
          >
            {children}
          </div>
          {onWidthChange && handle(-1)}
          {onWidthChange && handle(1)}
        </div>
      </div>
    </ModalTitleId.Provider>
  );
}

/** Lets `ModalHeader`'s heading name its dialog (aria-labelledby). */
const ModalTitleId = createContext<string | undefined>(undefined);

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const titleId = useContext(ModalTitleId);
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 id={titleId} className="text-title text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-subtle">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        className="-mr-2 -mt-1 inline-flex h-10 w-10 touch:min-h-11 touch:min-w-11 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        <X size={20} aria-hidden />
      </button>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx("rounded-xl motion-safe:animate-pulse bg-line", className)} />
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * A panel docked to the bottom edge (phones) or the right edge (wider layouts),
 * over a dimmed page: the reader's ayah context and player options. Escape,
 * the backdrop and Android back (a synthetic Escape) close it, and a bottom
 * (top) sheet can be dragged down (up) by its header or by content scrolled
 * to its start (end); each plays the exit before `onClose`. Focus moves in on
 * open and returns on close. The body has no padding of its own: callers pad
 * their content (`px-4 py-3`, the header's inset).
 */
export function Sheet({
  open,
  onClose,
  title,
  side = "bottom",
  children,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: "bottom" | "right" | "top";
  children: ReactNode;
  closeLabel: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass an inline `onClose`. If the effect below depended on it, every
  // parent re-render (the reader re-renders when the keyboard resizes the
  // WebView, and on its 3 s last-read timer) would run cleanup + setup again:
  // focus jumped back to the opener and then to the panel, blurring a focused
  // input, so the on-screen keyboard closed the moment it opened.
  const onCloseRef = useRef(onClose);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  // Every way out (X, backdrop, Escape and so Android back, a drag) plays the
  // exit first: the panel leaves toward its own edge, from `fromPx` when it
  // was dragged there. A close the caller makes itself just unmounts.
  const requestClose = (fromPx = 0) => {
    if (closing.current) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    const reduced = prefersReducedMotion();
    // Reduced motion: a tap's close fades; a drag's close finishes the slide, shorter.
    const fade = reduced && !fromPx;
    const off =
      side === "bottom"
        ? "translateY(100%)"
        : side === "top"
          ? "translateY(-100%)"
          : "translateX(100%)";
    const options: KeyframeAnimationOptions = {
      duration: fade ? 120 : reduced ? 80 : 180,
      easing: EASE_IN,
      fill: "forwards",
    };
    const dim = backdrop?.style.opacity || "1";
    const a = animateTo(
      panel,
      fade
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: fromPx ? `translateY(${fromPx}px)` : "none" },
            { transform: off },
          ],
      options,
    );
    const b = animateTo(backdrop, [{ opacity: dim }, { opacity: 0 }], options);
    // No Web Animations API (tests): close at once, as before.
    if (!a.animation) return onCloseRef.current();
    closing.current = true;
    void Promise.all([a.done, b.done]).then(() => {
      onCloseRef.current();
      // A caller that keeps the sheet open gets it back.
      requestAnimationFrame(() => {
        a.animation?.cancel();
        b.animation?.cancel();
        closing.current = false;
      });
    });
  };
  const closeRef = useRef(requestClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    closeRef.current = requestClose;
  });
  useEffect(() => {
    if (!open) return;
    closing.current = false;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      else if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    // Focus the panel unless something inside it (an autoFocus input) already
    // has focus.
    const t = setTimeout(() => {
      const p = panelRef.current;
      if (p && !p.contains(document.activeElement)) p.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      before?.focus?.();
    };
  }, [open]);

  // A bottom (top) sheet follows a finger dragging it down (up) and closes when
  // let go far enough or flicked. The drag starts from the handle and header,
  // or from the content while every scroller in it is at its top (bottom);
  // otherwise the content scrolls. Under reduced motion the finger is still
  // followed: only what plays after release is shorter.
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || side === "right" || !panel) return;
    // +1: dragging down closes (bottom sheet); -1: dragging up (top sheet).
    const sign = side === "bottom" ? 1 : -1;
    let st: {
      x: number;
      y: number;
      free: boolean;
      dragging: boolean;
      /** Signed offset in the root's px, toward the closing edge. */
      dy: number;
      past: boolean;
      samples: DragSample[];
    } | null = null;
    const dim = (dy: number) => Math.max(0, 1 - Math.abs(dy) / panel.offsetHeight);
    const place = (dy: number) => {
      panel.style.transform = dy ? `translateY(${dy}px)` : "";
      const b = backdropRef.current;
      if (b) b.style.opacity = dy ? String(dim(dy)) : "";
    };
    const onStart = (e: TouchEvent) => {
      st = null;
      const el = e.target as Element | null;
      if (closing.current || e.touches.length !== 1 || !el) return;
      if (el.closest("input, textarea, [role='slider'], [data-select-popup]")) return;
      let free = true;
      for (let n: Element | null = el; n && n !== panel; n = n.parentElement)
        if (
          sign > 0
            ? n.scrollTop > 0
            : n.scrollTop + n.clientHeight < n.scrollHeight - 1 &&
              /auto|scroll/.test(getComputedStyle(n).overflowY)
        )
          free = false;
      const t = e.touches[0];
      st = {
        x: t.clientX,
        y: t.clientY,
        free,
        dragging: false,
        dy: 0,
        past: false,
        samples: [],
      };
    };
    const onMove = (e: TouchEvent) => {
      if (!st) return;
      const t = e.touches[0];
      const dx = t.clientX - st.x;
      const dy = t.clientY - st.y;
      if (!st.dragging) {
        const axis = axisLock(dx, dy);
        if (!axis) {
          // Hold the browser's own scroll off while this may become a drag.
          if (st.free && dy * sign > 0 && e.cancelable) e.preventDefault();
          return;
        }
        if (
          axis !== "y" ||
          dy * sign < 0 ||
          !st.free ||
          window.getSelection?.()?.toString()
        ) {
          st = null;
          return;
        }
        st.dragging = true;
      }
      if (e.cancelable) e.preventDefault();
      // The app root is zoomed: a px inside it is `zoom` px of the finger's.
      st.dy = (sign * Math.max(0, dy * sign)) / rootZoom(popupRoot());
      st.samples.push({ p: t.clientY, t: e.timeStamp });
      // Same 30% as `commits`: a tap where letting go would close the sheet.
      const past = Math.abs(st.dy) > panel.offsetHeight * 0.3;
      if (past !== st.past) tick();
      st.past = past;
      place(st.dy);
    };
    const onEnd = () => {
      const s = st;
      st = null;
      if (!s?.dragging) return;
      const v = (sign * velocity(s.samples)) / rootZoom(popupRoot());
      if (commits(Math.abs(s.dy), panel.offsetHeight, v)) {
        closeRef.current(s.dy);
        place(0);
        return;
      }
      place(0);
      const back = { duration: prefersReducedMotion() ? 80 : 200, easing: EASE_OUT };
      animateTo(
        panel,
        [{ transform: `translateY(${s.dy}px)` }, { transform: "none" }],
        back,
      );
      animateTo(backdropRef.current, [{ opacity: dim(s.dy) }, { opacity: 1 }], back);
    };
    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [open, side]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        ref={backdropRef}
        aria-hidden
        className="animate-backdrop-in absolute inset-0 bg-ink/30"
        onClick={() => requestClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          "absolute flex flex-col border-line bg-surface shadow-float outline-none",
          side === "bottom" &&
            "animate-sheet-up inset-x-0 bottom-0 mx-auto max-h-[calc(85*var(--zvh))] w-full max-w-3xl rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]",
          side === "top" &&
            "animate-sheet-down inset-x-0 top-0 mx-auto max-h-[calc(85*var(--zvh))] w-full max-w-3xl rounded-b-2xl border-b pt-[env(safe-area-inset-top)]",
          side === "right" &&
            "animate-sheet-in inset-y-0 right-0 w-[min(26rem,100%)] rounded-l-2xl border-l pt-[env(safe-area-inset-top)]",
        )}
      >
        {side === "bottom" && (
          <div aria-hidden className="flex shrink-0 touch-none justify-center pb-1 pt-2">
            <div className="h-1 w-9 rounded-full bg-line" />
          </div>
        )}
        <div
          className={cx(
            "flex shrink-0 items-center justify-between gap-3 border-b border-line py-1.5 pl-4 pr-1.5",
            side !== "right" && "touch-none",
          )}
        >
          <h2 className="min-w-0 truncate text-title text-ink">{title}</h2>
          <QuietIconButton label={closeLabel} onClick={() => requestClose()}>
            <X size={19} />
          </QuietIconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

/** A quiet square icon button (DESIGN.md "Buttons · Quiet"), 40px. */
export function QuietIconButton({
  label,
  pressed,
  className,
  children,
  ...props
}: {
  label: string;
  pressed?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      {...props}
      className={cx(
        "inline-flex h-10 w-10 touch:min-h-11 touch:min-w-11 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30",
        pressed
          ? "bg-surface-sunken text-illumination"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}
