import { ALL_CATEGORIES } from "../../data/fawatih";
import { FAWATIH_COLORS } from "../../theme/palettes";
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Filter by ${label}`}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-xs transition " +
        (active
          ? "text-slate-600 dark:text-slate-300"
          : "text-slate-300 line-through dark:text-slate-600") +
        " hover:bg-slate-100 dark:hover:bg-slate-700/60"
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
}: {
  colorMode: ColorMode;
  pie: [string, string];
  activeKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
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
      aria-label="Chart legend filter"
    >
      {keys.map(([label, color]) => (
        <Item
          key={label}
          color={color}
          label={label}
          active={isActive(label)}
          onClick={() => onToggle(label)}
        />
      ))}
      {activeKeys.size > 0 && (
        <button
          type="button"
          onClick={() => activeKeys.forEach((k) => onToggle(k))}
          aria-label="Show all categories"
          className="ml-1 rounded-full px-1.5 py-0.5 text-xs text-slate-400 underline hover:text-slate-600 dark:hover:text-slate-200"
        >
          show all
        </button>
      )}
    </div>
  );
}
