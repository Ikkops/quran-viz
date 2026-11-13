import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpenText,
  Bookmark as BookmarkIcon,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Info,
  PanelRight,
  Rows3,
  Search,
  Settings,
} from "lucide-react";
import { READER_SCOPES, type ReaderScope } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";
import { cx, QuietIconButton } from "../ui";
import { useDismiss } from "../../lib/useDismiss";
import type { ReaderMode } from "./readerShared";

const MODE_ICONS: Record<ReaderMode, ReactNode> = {
  ayah: <Rows3 size={16} aria-hidden />,
  mushaf: <BookOpenText size={16} aria-hidden />,
  compare: <Columns2 size={16} aria-hidden />,
};

/** An icon button with a floating panel under it; outside click or Escape closes. */
function Popover({
  label,
  icon,
  open,
  onOpen,
  width = "w-80",
  children,
}: {
  label: string;
  icon: ReactNode;
  open: boolean;
  onOpen: (open: boolean) => void;
  width?: string;
  children: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(wrap, open, () => onOpen(false));
  return (
    <div ref={wrap} className="relative">
      <QuietIconButton
        label={label}
        pressed={open}
        aria-expanded={open}
        onClick={() => onOpen(!open)}
      >
        {icon}
      </QuietIconButton>
      {open && (
        <div
          className={cx(
            "absolute right-0 top-full z-30 mt-1 max-h-[calc(70*var(--zvh))] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-float",
            width,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The reader's head: back, title, and the page tools (search, bookmarks, about,
 * context panel, settings); under it one compact line for where you are (scope,
 * previous / jump / next) and how it is laid out.
 */
export function ReaderToolbar({
  title,
  subtitle,
  onBack,
  scope,
  value,
  max,
  onScope,
  onGo,
  mode,
  onMode,
  narrow,
  searchOpen,
  onSearchOpen,
  query,
  onQuery,
  infoAvailable,
  showInfo,
  onInfo,
  contextToggle,
  bookmarksOpen,
  onBookmarksOpen,
  bookmarks,
  settingsOpen,
  onSettingsOpen,
  settings,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  onBack: () => void;
  scope: ReaderScope;
  value: number;
  max: number;
  onScope: (s: ReaderScope) => void;
  onGo: (value: number) => void;
  mode: ReaderMode;
  onMode: (m: ReaderMode) => void;
  /** Phone-width reader: 44px pager, and the layout switch moves into settings. */
  narrow: boolean;
  searchOpen: boolean;
  onSearchOpen: (open: boolean) => void;
  query: string;
  onQuery: (q: string) => void;
  infoAvailable: boolean;
  showInfo: boolean;
  onInfo: () => void;
  /** Shown when the context panel is docked: its on/off state. */
  contextToggle: null | { on: boolean; toggle: () => void };
  bookmarksOpen: boolean;
  onBookmarksOpen: (open: boolean) => void;
  bookmarks: ReactNode;
  settingsOpen: boolean;
  onSettingsOpen: (open: boolean) => void;
  settings: ReactNode;
}) {
  const { t } = useI18n();
  const scopeName = t.scope[scope];
  const [jump, setJump] = useState(String(value));
  // Keep the jump field showing the current value when it isn't being edited.
  useEffect(() => setJump(String(value)), [value]);
  const commitJump = () => {
    const n = parseInt(jump, 10);
    if (!Number.isFinite(n)) {
      setJump(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(1, n));
    setJump(String(clamped));
    if (clamped !== value) onGo(clamped);
  };
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // The layout switch: beside the pager on wide readers; on a phone it moves
  // into the settings sheet (with its labels) so the head stays one short row.
  const modeSwitch = (
    <div
      role="group"
      aria-label={t.reader.modeLabel}
      className={cx(
        "rounded-lg border border-line bg-surface-sunken p-0.5 dark:bg-paper",
        narrow ? "flex" : "ml-auto inline-flex dark:bg-surface",
      )}
    >
      {(["ayah", "mushaf", "compare"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onMode(m)}
          aria-pressed={mode === m}
          aria-label={t.reader.modes[m]}
          title={t.reader.modes[m]}
          className={cx(
            "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
            narrow ? "h-11 flex-1 px-2" : "h-8 px-2.5",
            mode === m
              ? "bg-surface text-ink shadow-sm dark:bg-line"
              : "text-ink-muted hover:text-ink",
          )}
        >
          {MODE_ICONS[m]}
          {t.reader.modeShort[m]}
        </button>
      ))}
    </div>
  );

  return (
    <header className="shrink-0 border-b border-line bg-paper">
      <div className="flex items-center gap-1 px-2 pt-1.5">
        <QuietIconButton label={t.reader.close} onClick={onBack}>
          <ArrowLeft size={19} />
        </QuietIconButton>
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-lg font-semibold leading-tight text-ink">
            {title}
          </h1>
          {subtitle && <p className="truncate text-sm text-ink-subtle">{subtitle}</p>}
        </div>
        <QuietIconButton
          label={t.reader.searchToggle}
          pressed={searchOpen}
          onClick={() => {
            if (searchOpen) onQuery("");
            onSearchOpen(!searchOpen);
          }}
          disabled={mode === "mushaf"}
        >
          <Search size={18} />
        </QuietIconButton>
        {infoAvailable && (
          <QuietIconButton label={t.reader.about} pressed={showInfo} onClick={onInfo}>
            <Info size={18} />
          </QuietIconButton>
        )}
        {contextToggle && (
          <QuietIconButton
            label={t.reader.contextPanel}
            pressed={contextToggle.on}
            onClick={contextToggle.toggle}
          >
            <PanelRight size={18} />
          </QuietIconButton>
        )}
        <Popover
          label={t.reader.bookmarks}
          icon={<BookmarkIcon size={18} />}
          open={bookmarksOpen}
          onOpen={onBookmarksOpen}
        >
          {bookmarks}
        </Popover>
        <Popover
          label={t.reader.settings}
          icon={<Settings size={18} />}
          open={settingsOpen}
          onOpen={onSettingsOpen}
          width="w-72"
        >
          {narrow && (
            <div className="mb-3 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-muted">
                {t.reader.modeLabel}
              </span>
              {modeSwitch}
            </div>
          )}
          {settings}
        </Popover>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 pb-2 pt-1">
        <div className="flex items-center gap-1">
          <select
            value={scope}
            onChange={(e) => onScope(e.target.value as ReaderScope)}
            aria-label={t.reader.scopeLabel}
            disabled={mode === "mushaf" && scope === "page"}
            className={cx(
              "rounded-lg border border-line bg-surface px-2 text-sm text-ink",
              narrow ? "h-11" : "h-9",
            )}
          >
            {READER_SCOPES.map((s) => (
              <option key={s} value={s}>
                {t.scope[s]}
              </option>
            ))}
          </select>
          <QuietIconButton
            label={t.reader.prev(scopeName)}
            onClick={() => onGo(value - 1)}
            disabled={value <= 1}
            className={narrow ? "h-11 w-11" : "h-9 w-9"}
          >
            <ChevronLeft size={18} />
          </QuietIconButton>
          <span className="flex items-center gap-1 text-sm tabular-nums text-ink-subtle">
            <input
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={commitJump}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitJump();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setJump(String(value));
                  (e.target as HTMLInputElement).blur();
                }
              }}
              inputMode="numeric"
              aria-label={t.reader.jump(scopeName)}
              className={cx(
                "w-12 rounded-lg border border-line bg-surface text-center text-sm tabular-nums text-ink",
                narrow ? "h-11" : "h-9",
              )}
            />
            <span aria-hidden>/ {max}</span>
          </span>
          <QuietIconButton
            label={t.reader.next(scopeName)}
            onClick={() => onGo(value + 1)}
            disabled={value >= max}
            className={narrow ? "h-11 w-11" : "h-9 w-9"}
          >
            <ChevronRight size={18} />
          </QuietIconButton>
        </div>

        {!narrow && modeSwitch}
      </div>

      {searchOpen && mode !== "mushaf" && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle"
              aria-hidden
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onQuery("");
                  onSearchOpen(false);
                }
              }}
              placeholder={t.reader.searchPh}
              aria-label={t.reader.searchAria}
              className="h-10 touch:min-h-11 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-base text-ink"
            />
          </div>
        </div>
      )}
    </header>
  );
}
