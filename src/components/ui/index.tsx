import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { X } from "lucide-react";

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
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        "dark:border-slate-700 dark:bg-slate-800/60",
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
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
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
        !color && "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
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
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      {label}
      <select
        {...props}
        className={cx(
          "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition",
          "focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
          "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-700",
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
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      {label && (
        <span className="flex justify-between">
          <span>{label}</span>
          <span className="tabular-nums text-slate-400">{value}</span>
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
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200"
    >
      <span>{label}</span>
      <span
        className={cx(
          "relative h-5 w-9 rounded-full transition",
          checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
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
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition",
        "hover:bg-slate-50 disabled:opacity-50",
        "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
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
      className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === o.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

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

  const handle = (side: 1 | -1) => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize (drag; double-click to reset)"
      title="Drag to resize · double-click to reset"
      tabIndex={0}
      onPointerDown={startResize(side)}
      onDoubleClick={() => onWidthChange?.(null)}
      onKeyDown={keyResize(side)}
      className={cx(
        "group absolute inset-y-0 z-30 hidden w-2.5 cursor-ew-resize touch-none outline-none sm:block",
        side < 0 ? "left-0" : "right-0",
      )}
    >
      <span
        className={cx(
          "absolute inset-y-8 w-1 rounded-full transition",
          "group-hover:bg-slate-300 group-focus-visible:bg-slate-400 dark:group-hover:bg-slate-600",
          liveWidth !== null && "bg-slate-400 dark:bg-slate-500",
          side < 0 ? "left-0.5" : "right-0.5",
        )}
      />
    </div>
  );

  // Close on Escape + restore focus on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={overlayRef}
      className={cx(
        "fixed inset-0 z-50 flex bg-slate-900/50 backdrop-blur-sm",
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
        tabIndex={-1}
        className={cx(
          // Sized against the overlay (h-full / max-h-full), not `vh`: the app root
          // carries a CSS `zoom` (Interface scale), which multiplies `vh` lengths
          // inside it and would push the panel past the viewport edges.
          "animate-zoom-in w-full rounded-2xl bg-white shadow-2xl outline-none dark:bg-slate-900",
          fullHeight
            ? "flex h-full max-w-5xl flex-col overflow-y-auto"
            : "max-h-full max-w-3xl overflow-y-auto",
          onWidthChange && "relative",
          className,
        )}
        style={
          shownWidth !== null
            ? { width: `${shownWidth * 100}%`, maxWidth: "none" }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        {onWidthChange && handle(-1)}
        {onWidthChange && handle(1)}
      </div>
    </div>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
      >
        <X size={20} />
      </button>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700", className)}
    />
  );
}
