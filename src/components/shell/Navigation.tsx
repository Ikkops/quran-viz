import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Bookmark as BookmarkIcon,
  Home,
  Info,
  Keyboard,
  Layers,
  Map as MapIcon,
  Search,
  Settings as SettingsIcon,
} from "lucide-react";
import { BASE } from "../../data/base";
import { useI18n } from "../../i18n/I18nContext";
import type { View } from "../../lib/hash";
import { cx } from "../ui";

/**
 * App navigation (DESIGN.md "Layout"): a left rail on wide layouts, a top bar
 * plus bottom tab bar otherwise. App picks one with `isWideLayout` (lib/uiScale.ts;
 * after the Interface scale), not a media query: CSS zoom leaves media queries
 * reading the unzoomed window, so a 768px tablet at 150% (512px) would get a rail.
 */

const VIEW_ICONS: Record<View, ReactNode> = {
  home: <Home size={18} />,
  dashboard: <BarChart3 size={18} />,
  browse: <MapIcon size={18} />,
  structure: <Layers size={18} />,
};
const VIEW_ORDER: View[] = ["home", "dashboard", "browse", "structure"];

export interface NavProps {
  view: View;
  /** The reader page is showing (Read is the current destination). */
  reading: boolean;
  onView: (v: View) => void;
  /** Open the reader at the last-read position (or the start). */
  onRead: () => void;
  /** True when there is a last-read position to resume. */
  canResume: boolean;
  resumeTitle?: string;
  onSearch: () => void;
  onBookmarks: () => void;
  bookmarkCount: number;
  onShortcuts: () => void;
  onSettings: () => void;
  onAbout: () => void;
  /** "114 surahs · …" line, or null while loading. */
  totals: string | null;
  countsNote: string;
  ready: boolean;
}

/** Brand tile: the app icon (اِقْرَأْ, scripts/build_icons.py), same file as the favicon. */
function BrandMark() {
  return (
    <img
      src={`${BASE}favicon.svg`}
      alt=""
      aria-hidden
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-line"
    />
  );
}

function RailButton({
  icon,
  label,
  onClick,
  current,
  title,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  current?: boolean;
  title?: string;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={current ? "page" : undefined}
      className={cx(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-base transition-colors",
        current
          ? "bg-surface-sunken font-semibold text-ink dark:bg-surface"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink dark:hover:bg-surface",
      )}
    >
      <span className={current ? "text-illumination" : "text-ink-subtle"}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function NavRail(p: NavProps) {
  const { t } = useI18n();
  return (
    <aside
      aria-label={t.app.nav}
      className="sticky top-0 flex h-[calc(100*var(--zvh))] flex-col gap-5 overflow-y-auto border-r border-line bg-paper px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="flex items-start gap-2.5 px-1">
        <BrandMark />
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-snug text-ink">{t.app.title}</h1>
          {p.totals && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-subtle">
              <span>{p.totals}</span>
              <button
                type="button"
                onClick={p.onAbout}
                aria-label={t.app.aboutCounts}
                title={p.countsNote}
                className="-m-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
              >
                <Info size={13} aria-hidden />
              </button>
            </p>
          )}
        </div>
      </div>

      {p.ready && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={p.onRead}
            title={p.resumeTitle}
            aria-current={p.reading ? "page" : undefined}
            className="flex items-center justify-center gap-2 rounded-lg bg-illumination px-3 py-2.5 text-base font-semibold text-white transition-opacity hover:opacity-90 dark:text-paper"
          >
            <BookOpen size={17} aria-hidden />
            {p.canResume ? t.app.continueReading : t.app.startReading}
          </button>
          <button
            type="button"
            onClick={p.onSearch}
            className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-subtle transition-colors hover:border-ink-subtle hover:text-ink"
          >
            <Search size={15} aria-hidden />
            <span className="flex-1 text-left">{t.app.searchShort}</span>
            <kbd className="rounded border border-line px-1.5 font-ui text-xs text-ink-subtle">
              Ctrl K
            </kbd>
          </button>
        </div>
      )}

      <nav aria-label={t.app.mainView} className="flex flex-col gap-0.5">
        {VIEW_ORDER.map((v) => (
          <RailButton
            key={v}
            icon={VIEW_ICONS[v]}
            label={t.app.views[v]}
            current={!p.reading && p.view === v}
            onClick={() => p.onView(v)}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
        {p.ready && (
          <RailButton
            icon={<BookmarkIcon size={17} />}
            label={t.app.bookmarksLabel}
            onClick={p.onBookmarks}
            trailing={
              p.bookmarkCount > 0 ? (
                <span className="text-xs tabular-nums text-ink-subtle">
                  {p.bookmarkCount}
                </span>
              ) : undefined
            }
          />
        )}
        <RailButton
          icon={<Keyboard size={17} />}
          label={t.app.shortcuts}
          onClick={p.onShortcuts}
        />
        <RailButton
          icon={<SettingsIcon size={17} />}
          label={t.app.settings}
          onClick={p.onSettings}
        />
      </div>
    </aside>
  );
}

function BarIcon({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
    >
      {children}
    </button>
  );
}

/** Phone top bar: brand + search, bookmarks, settings. */
export function TopBar(p: NavProps) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <BrandMark />
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
          {t.app.titleShort}
        </h1>
        {p.ready && (
          <>
            <BarIcon label={t.app.search} onClick={p.onSearch}>
              <Search size={19} />
            </BarIcon>
            <BarIcon label={t.app.bookmarks(p.bookmarkCount)} onClick={p.onBookmarks}>
              <BookmarkIcon size={19} />
            </BarIcon>
          </>
        )}
        <BarIcon label={t.app.settings} onClick={p.onSettings}>
          <SettingsIcon size={19} />
        </BarIcon>
      </div>
    </header>
  );
}

function TabButton({
  icon,
  label,
  current,
  onClick,
  title,
}: {
  icon: ReactNode;
  label: string;
  current?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={current ? "page" : undefined}
      className={cx(
        "flex min-h-[3.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs transition-colors",
        current ? "font-semibold text-illumination" : "text-ink-subtle hover:text-ink",
      )}
    >
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

/** Phone bottom tab bar: Home (continue reading, surah index) and the three
 *  views. While the reader is open, Home is the current tab. */
export function BottomTabs(p: NavProps) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t.app.nav}
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur"
    >
      {VIEW_ORDER.map((v) => (
        <TabButton
          key={v}
          icon={VIEW_ICONS[v]}
          label={t.app.views[v]}
          current={p.reading ? v === "home" : p.view === v}
          onClick={() => p.onView(v)}
        />
      ))}
    </nav>
  );
}
