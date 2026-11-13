import { ALL_CATEGORIES } from "../../data/fawatih";
import { FAWATIH_COLORS } from "../../theme/palettes";
import { useI18n } from "../../i18n/I18nContext";
import { useTheme } from "../../theme/ThemeContext";
import type { ColorMode } from "./common";

function Item({
  color,
  label,
  active,
  onClick,
}: {
  color: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={t.legend.filterBy(label)}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-xs transition " +
        (active ? "text-ink-muted" : "text-ink-subtle line-through") +
        " hover:bg-surface-sunken dark:hover:bg-line/60"
      }
    >
      <span
        className="h-3 w-3 rounded-sm transition"
        style={{ backgroundColor: color, opacity: active ? 1 : 0.25 }}
      />
      {label}
    </button>
  );
}

/**
 * Colour key for the dashboard. Clicking a chip filters the charts by that
 * category/type (dims the rest). An empty `activeKeys` means nothing is
 * filtered — every chip reads as active.
 */
export function Legend({
  colorMode,
  pie,
  activeKeys,
  onToggle,
  ayahLevel = false,
}: {
  colorMode: ColorMode;
  pie: [string, string];
  activeKeys: Set<string>;
  onToggle: (key: string) => void;
  /** The chart splits bars by ayah place: add the Hijra key and the caveat. */
  ayahLevel?: boolean;
}) {
  const { t, place, category } = useI18n();
  const { palette } = useTheme();
  const isActive = (key: string) => activeKeys.size === 0 || activeKeys.has(key);
  const keys =
    colorMode === "type"
      ? ([
          ["Meccan", pie[0]],
          ["Medinan", pie[1]],
        ] as const)
      : ALL_CATEGORIES.filter((c) => c !== "Unknown").map(
          (c) => [c, FAWATIH_COLORS[c] ?? FAWATIH_COLORS.Unknown] as const,
        );

  return (
    <div
      className="flex flex-wrap items-center gap-x-1 gap-y-1"
      role="group"
      aria-label={t.legend.group}
    >
      {keys.map(([label, color]) => (
        <Item
          key={label}
          color={color}
          label={colorMode === "type" ? place(label) : category(label)}
          active={isActive(label)}
          onClick={() => onToggle(label)}
        />
      ))}
      {ayahLevel && colorMode === "type" && (
        <span
          className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-xs text-ink-muted"
          title={t.legend.hijraTitle}
        >
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: palette.hijra }}
          />
          {t.legend.hijra}
        </span>
      )}
      {activeKeys.size > 0 && (
        <button
          type="button"
          onClick={() => activeKeys.forEach((k) => onToggle(k))}
          aria-label={t.legend.showAllAria}
          className="ml-1 rounded-full px-1.5 py-0.5 text-xs text-ink-subtle underline hover:text-ink-muted dark:hover:text-ink"
        >
          {t.common.showAll}
        </button>
      )}
      {ayahLevel && colorMode === "type" && (
        <p className="w-full px-1.5 text-xs text-ink-subtle">
          {t.legend.split} {t.placeCaveat}
        </p>
      )}
    </div>
  );
}
