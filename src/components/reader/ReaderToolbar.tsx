import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpenText,
  ChevronDown,
  ChevronUp,
  Info,
  Rows3,
  Search,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { cx, QuietIconButton } from "../ui";
import { useDismiss } from "../../lib/useDismiss";
import type { ReaderMode } from "./readerShared";

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
 * The reader's head, one row: back, the title (a button that opens "Go to"),
 * search, about this surah, the layout switch (ayahs or mushaf pages), the
 * player's show/hide and settings.
 */
export function ReaderToolbar({
  title,
  subtitle,
  compact,
  onBack,
  onGoTo,
  mode,
  onMode,
  searchOpen,
  onSearchOpen,
  query,
  onQuery,
  matches,
  info,
  player,
  settingsOpen,
  onSettingsOpen,
  settings,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  /** Narrow head: the title drops its chevron to leave room for the name. */
  compact?: boolean;
  onBack: () => void;
  /** Open the "Go to" sheet (surah, ayah, page). */
  onGoTo: () => void;
  mode: ReaderMode;
  onMode: (m: ReaderMode) => void;
  searchOpen: boolean;
  onSearchOpen: (open: boolean) => void;
  query: string;
  onQuery: (q: string) => void;
  /** Search hits: how many, which one is shown, and stepping between them. */
  matches?: { count: number; at: number; onStep: (d: 1 | -1) => void } | null;
  /** About this surah (the surah of the ayah at the top). */
  info: { on: boolean; toggle: () => void };
  /** The recitation player's show/hide, when there is audio to play. */
  player: null | { on: boolean; toggle: () => void };
  settingsOpen: boolean;
  onSettingsOpen: (open: boolean) => void;
  settings: ReactNode;
}) {
  const { t } = useI18n();
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
  const other: ReaderMode = mode === "ayah" ? "mushaf" : "ayah";

  return (
    <header className="shrink-0 border-b border-line bg-paper">
      <div className="flex items-center gap-0.5 px-2 py-1">
        <QuietIconButton label={t.reader.close} onClick={onBack}>
          <ArrowLeft size={19} />
        </QuietIconButton>
        <h1 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onGoTo}
            aria-haspopup="dialog"
            title={t.reader.goTo}
            className={cx(
              "flex min-h-11 max-w-full items-center gap-1.5 rounded-lg text-left hover:bg-surface-sunken",
              compact ? "px-1" : "px-2",
            )}
          >
            <span className="min-w-0">
              <span
                className={cx(
                  "block truncate font-semibold leading-tight text-ink",
                  compact ? "text-base" : "text-lg",
                )}
              >
                {title}
              </span>
              {subtitle && (
                <span className="block truncate text-xs font-normal text-ink-subtle">
                  {subtitle}
                </span>
              )}
            </span>
            {!compact && (
              <ChevronDown size={17} aria-hidden className="shrink-0 text-ink-subtle" />
            )}
          </button>
        </h1>
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
        <QuietIconButton
          label={t.reader.about}
          pressed={info.on}
          aria-haspopup="dialog"
          onClick={info.toggle}
        >
          <Info size={18} />
        </QuietIconButton>
        {/* Shows the layout it switches to. */}
        <QuietIconButton
          label={t.reader.switchTo(t.reader.modes[other])}
          onClick={() => onMode(other)}
        >
          {other === "mushaf" ? <BookOpenText size={18} /> : <Rows3 size={18} />}
        </QuietIconButton>
        {player && (
          <QuietIconButton
            label={player.on ? t.reader.hidePlayer : t.reader.showPlayer}
            onClick={player.toggle}
          >
            {player.on ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </QuietIconButton>
        )}
        <Popover
          label={t.reader.settings}
          icon={<Settings size={18} />}
          open={settingsOpen}
          onOpen={onSettingsOpen}
          width="w-72"
        >
          {settings}
        </Popover>
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
                if (e.key === "Enter" && matches?.count) {
                  e.preventDefault();
                  matches.onStep(e.shiftKey ? -1 : 1);
                }
              }}
              placeholder={t.reader.searchPh}
              aria-label={t.reader.searchAria}
              className="h-10 touch:min-h-11 w-full rounded-lg border border-line bg-surface pl-8 pr-24 text-base text-ink"
            />
            {query.trim() && matches && (
              <div className="absolute inset-y-0 right-1 flex items-center">
                <span
                  className="px-1.5 text-xs tabular-nums text-ink-subtle"
                  role="status"
                  aria-live="polite"
                >
                  {matches.count
                    ? t.reader.matchOf(matches.at + 1, matches.count)
                    : t.reader.noMatches}
                </span>
                <QuietIconButton
                  label={t.reader.prevMatch}
                  onClick={() => matches.onStep(-1)}
                  disabled={!matches.count}
                  className="h-8 w-8"
                >
                  <ChevronUp size={17} />
                </QuietIconButton>
                <QuietIconButton
                  label={t.reader.nextMatch}
                  onClick={() => matches.onStep(1)}
                  disabled={!matches.count}
                  className="h-8 w-8"
                >
                  <ChevronDown size={17} />
                </QuietIconButton>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
