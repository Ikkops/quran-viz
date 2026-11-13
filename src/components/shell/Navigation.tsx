import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Home,
  Layers,
  Search,
  Settings as SettingsIcon,
} from "lucide-react";
import { BASE } from "../../data/base";
import { useI18n } from "../../i18n/I18nContext";
import type { View } from "../../lib/hash";
import { cx } from "../ui";

/**
 * App navigation (DESIGN.md "Layout"): a slim top bar (page name, search) and
 * a bottom tab bar with the five destinations, at every width.
 */

const VIEW_ICONS: Record<View, ReactNode> = {
  home: <Home size={20} />,
  dashboard: <BarChart3 size={20} />,
  structure: <Layers size={20} />,
  activity: <Activity size={20} />,
  settings: <SettingsIcon size={20} />,
};
const VIEW_ORDER: View[] = ["home", "dashboard", "structure", "activity", "settings"];

export interface NavProps {
  view: View;
  /** The reader page is showing (Home is then the current tab). */
  reading: boolean;
  onView: (v: View) => void;
  onSearch: () => void;
  ready: boolean;
}

/** Brand tile: the app icon (اِقْرَأْ, scripts/build_icons.py), same file as the favicon. */
function BrandMark() {
  return (
    <img
      src={`${BASE}favicon.svg`}
      alt=""
      aria-hidden
      width={32}
      height={32}
      className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-line"
    />
  );
}

/** Top bar: brand, the page's name, search. */
export function TopBar(p: NavProps) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-4 py-1.5">
        <BrandMark />
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
          {p.view === "home" ? t.app.titleShort : t.app.views[p.view]}
        </h1>
        {p.ready && (
          <button
            type="button"
            onClick={p.onSearch}
            aria-label={t.app.search}
            title={`${t.app.search} (Ctrl K)`}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <Search size={20} />
          </button>
        )}
      </div>
    </header>
  );
}

function TabButton({
  icon,
  label,
  current,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  current?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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

/** Bottom tab bar: Home, Dashboard, Structure, Activity, Settings. */
export function BottomTabs(p: NavProps) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t.app.nav}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl">
        {VIEW_ORDER.map((v) => (
          <TabButton
            key={v}
            icon={VIEW_ICONS[v]}
            label={t.app.views[v]}
            current={p.reading ? v === "home" : p.view === v}
            onClick={() => p.onView(v)}
          />
        ))}
      </div>
    </nav>
  );
}
