import type { View } from "./hash";

/** What a key press should do at the app level, or null to ignore it. */
export type ShortcutAction =
  | { kind: "search" }
  | { kind: "bookmarks" }
  | { kind: "view"; view: View };

export const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: "Ctrl K  or  /", does: "Search the Qur'an (Arabic, 2:255, or translation)" },
  {
    keys: "H · 1 · 2 · 3 · 4",
    does: "Home · Dashboard · Structure · Activity · Settings",
  },
  { keys: "B", does: "Bookmarks" },
  { keys: "?", does: "Settings, with this list" },
  { keys: "← / →", does: "Reader: previous / next surah, juz, page…" },
  { keys: "↑ / ↓", does: "Dashboard: previous / next visualization (list focused)" },
  { keys: "Enter", does: "Search: open the first result or the typed reference" },
  { keys: "Esc", does: "Close the open window" },
];

const VIEW_KEYS: Record<string, View> = {
  h: "home",
  H: "home",
  "1": "dashboard",
  "2": "structure",
  "3": "activity",
  "4": "settings",
};

/** Map a keydown to an app shortcut. `typing` = focus is in a text field;
 *  `modalOpen` = a reader/search/settings/bookmarks window is up. */
export function shortcutFor(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean },
  typing: boolean,
  modalOpen: boolean,
): ShortcutAction | null {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") return { kind: "search" };
  if (typing || modalOpen || e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "/") return { kind: "search" };
  if (e.key === "?") return { kind: "view", view: "settings" };
  if (e.key === "b" || e.key === "B") return { kind: "bookmarks" };
  if (e.key in VIEW_KEYS) return { kind: "view", view: VIEW_KEYS[e.key] };
  return null;
}
