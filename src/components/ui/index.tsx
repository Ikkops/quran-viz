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
  type SelectHTMLAttributes,
} from "react";
import { X } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";

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
      className={cx(
        "rounded-2xl border border-line bg-white shadow-sm",
        "dark:border-line dark:bg-surface/60",
        className,
      )}
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
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink-subtle">{subtitle}</p>}
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        !color && "bg-surface-sunken text-ink dark:bg-line",
        className,
      )}
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: { label?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-ink-muted">
      {label}
      <select
        {...props}
        className={cx(
          "min-h-10 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink transition",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {children}
      </select>
    </label>
  );
}

export function Slider({
  label,
  value,
  ...props
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
      {label && (
        <span className="flex justify-between">
          <span>{label}</span>
          <span className="tabular-nums text-ink-subtle">{value}</span>
        </span>
      )}
      <input type="range" value={value} {...props} className="accent-current" />
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
          checked ? "bg-illumination" : "bg-ink-subtle/50",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition motion-reduce:transition-none",
            checked ? "left-4" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function IconButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition",
        "hover:bg-paper disabled:opacity-50",
        "dark:border-ink-subtle/50 dark:bg-surface dark:text-ink dark:hover:bg-line",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      // Never wider than its container: on a phone a long strip (the reader's 7
      // scopes, Structure's 8 tabs) scrolls sideways instead of widening the page.
      className="scrollbar-none inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface-sunken p-1 dark:bg-surface"
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx(
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === o.value
              ? "bg-white text-ink shadow-sm dark:bg-ink-subtle/50 dark:text-white"
              : "text-ink-muted hover:text-ink dark:text-ink-subtle",
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
              "min-h-0 w-full overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-paper",
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
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-ink-subtle">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-sunken hover:text-ink"
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
 * the backdrop and Android back (a synthetic Escape) close it; focus moves in
 * on open and returns on close.
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
  side?: "bottom" | "right";
  children: ReactNode;
  closeLabel: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
    const t = setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      before?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const bottom = side === "bottom";
  return (
    <div className="fixed inset-0 z-50 bg-ink/30" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          "absolute flex flex-col bg-surface shadow-float outline-none",
          bottom
            ? "animate-sheet-up inset-x-0 bottom-0 max-h-[calc(85*var(--zvh))] rounded-t-xl pb-[env(safe-area-inset-bottom)]"
            : "animate-sheet-in inset-y-0 right-0 w-[min(26rem,100%)] border-l border-line pt-[env(safe-area-inset-top)]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line py-1.5 pl-4 pr-1.5">
          <h2 className="min-w-0 truncate text-base font-semibold text-ink">{title}</h2>
          <QuietIconButton label={closeLabel} onClick={onClose}>
            <X size={19} />
          </QuietIconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
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
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30",
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
