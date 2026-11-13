import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";

export interface SelectOption<T> {
  value: T;
  label: string;
  /** Options sharing a `group` are listed under that heading (in order of first
   *  appearance). */
  group?: string;
  disabled?: boolean;
}

const join = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(" ");

/** Lower-cased, accents, apostrophes and hyphens dropped: "Ali 'Imran" ~ "ali imran". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’ʿʾ`\-.]/g, "")
    .toLowerCase();

/** The element the app's CSS `zoom` sits on; popups portal into it so they get
 *  the same zoom, theme and fonts. */
function popupRoot(): HTMLElement {
  return document.getElementById("app-root") ?? document.body;
}

/** CSS zoom of the app root (1 in tests, where layout is empty). */
function rootZoom(root: HTMLElement): number {
  const z = root.getBoundingClientRect().width / root.offsetWidth;
  return Number.isFinite(z) && z > 0 ? z : 1;
}

type Place = { style: CSSProperties; above: boolean };

/**
 * The app's dropdown: a button that opens a listbox popup styled like the rest
 * of the app, replacing the browser's / Android's native `<select>` picker.
 *
 * Focus stays on the trigger while the list is open (`aria-activedescendant`),
 * so opening it never blurs anything or pops the on-screen keyboard. Escape
 * closes only the list (a capture-phase listener), not the sheet or popover
 * around it; Android back sends Escape, so it closes the list first too.
 */
export function Select<T extends string | number>({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  disabled,
  className,
  size = "md",
  searchable,
}: {
  label?: string;
  ariaLabel?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
  /** On the wrapper (width, margins). */
  className?: string;
  /** `sm`: the compact trigger used in the player options. */
  size?: "md" | "sm";
  /** Adds a filter field at the top of the list (long lists). */
  searchable?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const optId = (i: number) => `${id}-opt-${i}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const typed = useRef({ text: "", at: 0 });

  const shown = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = fold(query.trim());
    return options.filter((o) => fold(o.label).includes(q));
  }, [options, searchable, query]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openList = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    setPlace(null);
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  };
  const pick = (o: SelectOption<T> | undefined) => {
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
  };

  // Position the popup under (or above) the trigger, in the app root's zoomed
  // CSS px, and keep it there while things scroll or the keyboard resizes the
  // window.
  useLayoutEffect(() => {
    if (!open) return;
    const placeIt = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const z = rootZoom(popupRoot());
      const r = trigger.getBoundingClientRect();
      const vw = window.innerWidth / z;
      const vh = (window.visualViewport?.height ?? window.innerHeight) / z;
      const top = r.top / z;
      const bottom = r.bottom / z;
      const left = r.left / z;
      const width = r.width / z;
      const gap = 4;
      const margin = 12;
      const below = vh - bottom - gap - margin;
      const aboveRoom = top - gap - margin;
      const want = Math.min(360, vh * 0.5);
      const above = below < Math.min(want, 200) && aboveRoom > below;
      const maxHeight = Math.max(120, Math.min(want, above ? aboveRoom : below));
      const maxWidth = vw - 2 * margin;
      const minWidth = Math.min(width, maxWidth);
      const x = Math.min(Math.max(margin, left), vw - margin - minWidth);
      setPlace({
        above,
        style: {
          position: "fixed",
          left: x,
          minWidth,
          maxWidth: Math.min(maxWidth, Math.max(minWidth, 28 * 16), vw - x - margin),
          maxHeight,
          ...(above ? { bottom: vh - top + gap } : { top: bottom + gap }),
        },
      });
    };
    placeIt();
    const onScroll = (e: Event) => {
      if (popupRef.current?.contains(e.target as Node)) return;
      placeIt();
    };
    window.addEventListener("resize", placeIt);
    window.visualViewport?.addEventListener("resize", placeIt);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", placeIt);
      window.visualViewport?.removeEventListener("resize", placeIt);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Outside press closes; Escape closes only this list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const tgt = e.target as Node;
      if (popupRef.current?.contains(tgt) || triggerRef.current?.contains(tgt)) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // Bring the selected (then the active) option into view.
  useLayoutEffect(() => {
    if (!open || !place) return;
    if (searchable) searchRef.current?.focus({ preventScroll: true });
    const el = active >= 0 ? document.getElementById(optId(active)) : null;
    el?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place === null]);
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optId(active))?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    if (open) setActive(shown.length ? 0 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const step = (from: number, dir: 1 | -1): number => {
    for (let i = from + dir; i >= 0 && i < shown.length; i += dir) {
      if (!shown[i].disabled) return i;
    }
    return from;
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => step(a, 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => step(a, -1));
        return;
      case "Home":
        if (e.currentTarget === searchRef.current) return;
        e.preventDefault();
        setActive(step(-1, 1));
        return;
      case "End":
        if (e.currentTarget === searchRef.current) return;
        e.preventDefault();
        setActive(step(shown.length, -1));
        return;
      case "Enter":
        e.preventDefault();
        pick(shown[active]);
        return;
      case "Tab":
        close(false);
        return;
      case " ":
        if (e.currentTarget === searchRef.current) return;
        e.preventDefault();
        pick(shown[active]);
        return;
    }
    // Typeahead on the trigger: jump to the next option starting with the typed
    // letters.
    if (
      e.currentTarget !== searchRef.current &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      const now = Date.now();
      const buf = now - typed.current.at > 700 ? e.key : typed.current.text + e.key;
      typed.current = { text: buf, at: now };
      const q = fold(buf);
      const hit = shown.findIndex((o) => !o.disabled && fold(o.label).startsWith(q));
      if (hit >= 0) setActive(hit);
    }
  };

  // Group headings in order of first appearance.
  const rows: (
    | { kind: "group"; label: string }
    | { kind: "opt"; o: SelectOption<T>; i: number }
  )[] = [];
  let lastGroup: string | undefined;
  shown.forEach((o, i) => {
    if (o.group && o.group !== lastGroup) rows.push({ kind: "group", label: o.group });
    lastGroup = o.group;
    rows.push({ kind: "opt", o, i });
  });

  const sm = size === "sm";
  const popup =
    open &&
    place &&
    createPortal(
      <div
        ref={popupRef}
        data-select-popup=""
        style={place.style}
        // Keep focus on the trigger (or the filter field): a press in the list
        // must not blur anything.
        onPointerDown={(e) => {
          if (e.target !== searchRef.current) e.preventDefault();
        }}
        onMouseDown={(e) => {
          if (e.target !== searchRef.current) e.preventDefault();
        }}
        onClick={(e) => e.stopPropagation()}
        className={join(
          "animate-pop-in z-[60] flex flex-col overflow-hidden rounded-xl border border-line bg-surface font-ui text-ink shadow-float",
          place.above ? "origin-bottom" : "origin-top",
        )}
      >
        {searchable && (
          <div className="relative shrink-0 border-b border-line p-1.5">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label={t.ui.filterOptions}
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? optId(active) : undefined}
              placeholder={t.ui.filterOptions}
              className="min-h-9 w-full rounded-lg border border-line bg-paper pl-8 pr-2 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-illumination touch:min-h-11"
            />
          </div>
        )}
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : ariaLabel}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
        >
          {rows.map((r) =>
            r.kind === "group" ? (
              <li
                key={`g-${r.label}`}
                role="presentation"
                className="px-3 pb-1 pt-2.5 text-xs font-semibold text-ink-subtle"
              >
                {r.label}
              </li>
            ) : (
              <li
                key={String(r.o.value)}
                id={optId(r.i)}
                role="option"
                aria-selected={r.o.value === value}
                aria-disabled={r.o.disabled || undefined}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setActive(r.i);
                }}
                onClick={() => pick(r.o)}
                className={join(
                  "flex min-h-9 cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-sm touch:min-h-11",
                  r.i === active && "bg-surface-sunken",
                  r.o.value === value ? "font-medium text-illumination" : "text-ink",
                  r.o.disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <span className="min-w-0 flex-1">{r.o.label}</span>
                <Check
                  size={15}
                  aria-hidden
                  className={join("shrink-0", r.o.value === value ? "" : "invisible")}
                />
              </li>
            ),
          )}
          {shown.length === 0 && (
            <li role="presentation" className="px-3 py-2 text-sm text-ink-subtle">
              {t.ui.noMatches}
            </li>
          )}
        </ul>
      </div>,
      popupRoot(),
    );

  return (
    <div className={join("flex min-w-0 flex-col gap-1", className)}>
      {label && (
        <span
          id={labelId}
          className={join("text-ink-muted", sm ? "text-sm" : "text-xs font-medium")}
          onClick={() => triggerRef.current?.focus()}
        >
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={label ? `${labelId} ${id}-value` : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-activedescendant={
          open && !searchable && active >= 0 ? optId(active) : undefined
        }
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={join(
          "flex w-full min-w-0 items-center gap-2 rounded-lg border bg-surface text-left text-ink transition",
          "hover:border-ink-subtle disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-illumination" : "border-line",
          sm
            ? "min-h-9 px-2 text-sm touch:min-h-11"
            : "min-h-10 px-2.5 text-sm touch:min-h-11",
        )}
      >
        <span id={`${id}-value`} className="min-w-0 flex-1 truncate">
          {selected?.label ?? ""}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={join(
            "shrink-0 text-ink-subtle transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      {popup}
    </div>
  );
}
