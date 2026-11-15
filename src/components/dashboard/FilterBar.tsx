import { useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, RotateCcw, X } from "lucide-react";
import {
  SORT_LABELS,
  type FilterMode,
  type FilterState,
  type PlaceFilter,
  type SortKey,
} from "../../data/selectors";
import type { Surah } from "../../types/quran";
import type { VizUses } from "../../views/vizDefs";
import type { ColorMode } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";
import { useDismiss } from "../../lib/useDismiss";
import { Button, cx, Select } from "../ui";

/** One filter as a chip: its current value, a popover to change it, and a
 *  clear button while it differs from the default. */
function Chip({
  label,
  active,
  onClear,
  children,
}: {
  label: string;
  active: boolean;
  onClear?: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(wrap, open, () => setOpen(false));
  return (
    <div ref={wrap} className="relative">
      <div
        className={cx(
          "inline-flex h-8 items-center rounded-lg border text-sm font-medium transition-colors touch:min-h-11",
          active
            ? "border-illumination/40 bg-illumination/10 text-ink"
            : "border-line bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink",
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen(!open)}
          className={cx(
            "inline-flex h-full items-center gap-1 whitespace-nowrap pl-2.5",
            active && onClear ? "pr-1" : "pr-2",
          )}
        >
          {label}
          <ChevronDown size={14} aria-hidden className="text-ink-subtle" />
        </button>
        {active && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label={t.dashboard.removeFilter(label)}
            className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-illumination/15 hover:text-ink touch:mr-0 touch:h-full touch:min-w-11"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-1 shadow-float">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** A short list of exclusive choices inside a chip's popover. */
function Options<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { value: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onPick(o.value)}
          className={cx(
            "flex min-h-9 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-sunken touch:min-h-11",
            o.value === value ? "font-medium text-illumination" : "text-ink",
          )}
        >
          <span className="min-w-0 flex-1">{o.label}</span>
          <Check
            size={15}
            aria-hidden
            className={cx("shrink-0", o.value !== value && "invisible")}
          />
        </button>
      ))}
    </div>
  );
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/**
 * The dashboard's filters as chips above the chart: range, which ayahs, sort,
 * colour and bar layout. Only the filters the current chart responds to show.
 */
export function FilterBar({
  uses,
  surahs,
  filter,
  onFilter,
  colorMode,
  onColorMode,
  horizontal,
  onHorizontal,
  onReset,
  dirty,
}: {
  uses: VizUses;
  surahs: Surah[];
  filter: FilterState;
  onFilter: (f: FilterState) => void;
  colorMode: ColorMode;
  onColorMode: (m: ColorMode) => void;
  horizontal: boolean;
  onHorizontal: (h: boolean) => void;
  onReset: () => void;
  dirty: boolean;
}) {
  const { t } = useI18n();
  const place = filter.place ?? "all";
  const surahOptions = surahs.map((s) => ({
    value: s.id,
    label: `${s.id}. ${s.name}`,
  }));
  const juzOptions = range(30).map((j) => ({ value: j, label: String(j) }));
  const rangeLabel =
    filter.mode === "surah"
      ? t.dashboard.surahSpan(...filter.surahRange)
      : filter.mode === "juz"
        ? t.dashboard.juzSpan(...filter.juzRange)
        : t.controls.entire;
  const placeLabels: Record<PlaceFilter, string> = {
    all: t.controls.allAyahs,
    Meccan: t.controls.meccanOnly,
    Medinan: t.controls.medinanOnly,
  };

  if (!uses.range && !uses.sort && !uses.color && !uses.layout)
    return <p className="text-sm text-ink-subtle">{t.controls.noFilters}</p>;

  return (
    <div
      role="group"
      aria-label={t.dashboard.filters}
      className="flex flex-wrap items-center gap-2"
    >
      {uses.range && (
        <Chip
          label={rangeLabel}
          active={filter.mode !== "all"}
          onClear={() => onFilter({ ...filter, mode: "all" })}
        >
          {() => (
            <div className="space-y-1">
              <Options<FilterMode>
                value={filter.mode}
                onPick={(mode) => onFilter({ ...filter, mode })}
                options={[
                  { value: "all", label: t.controls.entire },
                  { value: "surah", label: t.controls.bySurah },
                  { value: "juz", label: t.controls.byJuz },
                ]}
              />
              {filter.mode === "surah" && (
                <div className="grid grid-cols-2 gap-2 px-1.5 pb-1.5 pt-1">
                  <Select
                    label={t.controls.fromSurah}
                    value={filter.surahRange[0]}
                    searchable
                    options={surahOptions}
                    onChange={(v) => {
                      const from = Math.min(v, filter.surahRange[1]);
                      onFilter({ ...filter, surahRange: [from, filter.surahRange[1]] });
                    }}
                  />
                  <Select
                    label={t.controls.toSurah}
                    value={filter.surahRange[1]}
                    searchable
                    options={surahOptions}
                    onChange={(v) => {
                      const to = Math.max(v, filter.surahRange[0]);
                      onFilter({ ...filter, surahRange: [filter.surahRange[0], to] });
                    }}
                  />
                </div>
              )}
              {filter.mode === "juz" && (
                <div className="grid grid-cols-2 gap-2 px-1.5 pb-1.5 pt-1">
                  <Select
                    label={t.controls.juzFrom}
                    value={filter.juzRange[0]}
                    options={juzOptions}
                    onChange={(v) => {
                      const from = Math.min(v, filter.juzRange[1]);
                      onFilter({ ...filter, juzRange: [from, filter.juzRange[1]] });
                    }}
                  />
                  <Select
                    label={t.controls.juzTo}
                    value={filter.juzRange[1]}
                    options={juzOptions}
                    onChange={(v) => {
                      const to = Math.max(v, filter.juzRange[0]);
                      onFilter({ ...filter, juzRange: [filter.juzRange[0], to] });
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </Chip>
      )}

      {uses.range && (
        <Chip
          label={placeLabels[place]}
          active={place !== "all"}
          onClear={() => onFilter({ ...filter, place: "all" })}
        >
          {(close) => (
            <>
              <Options<PlaceFilter>
                value={place}
                onPick={(p) => {
                  onFilter({ ...filter, place: p });
                  close();
                }}
                options={(["all", "Meccan", "Medinan"] as const).map((p) => ({
                  value: p,
                  label: placeLabels[p],
                }))}
              />
              <p className="mx-1 mt-1 border-t border-line px-1.5 pb-1.5 pt-2 text-xs leading-snug text-ink-subtle">
                {t.controls.placeTitle}
              </p>
            </>
          )}
        </Chip>
      )}

      {uses.sort && (
        <Chip
          label={t.dashboard.sortChip(t.sort[filter.sort])}
          active={filter.sort !== "quran"}
          onClear={() => onFilter({ ...filter, sort: "quran" })}
        >
          {(close) => (
            <Options<SortKey>
              value={filter.sort}
              onPick={(sort) => {
                onFilter({ ...filter, sort });
                close();
              }}
              options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
                value: k,
                label: t.sort[k],
              }))}
            />
          )}
        </Chip>
      )}

      {uses.color && (
        <Chip
          label={colorMode === "fawatih" ? t.controls.byOpening : t.controls.byType}
          active={colorMode !== "type"}
          onClear={() => onColorMode("type")}
        >
          {(close) => (
            <Options<ColorMode>
              value={colorMode}
              onPick={(m) => {
                onColorMode(m);
                close();
              }}
              options={[
                { value: "type", label: t.controls.byType },
                { value: "fawatih", label: t.controls.byOpening },
              ]}
            />
          )}
        </Chip>
      )}

      {uses.layout && (
        <Chip
          label={t.dashboard.barsChip(
            horizontal ? t.controls.horizontal : t.controls.vertical,
          )}
          active={horizontal}
          onClear={() => onHorizontal(false)}
        >
          {(close) => (
            <Options<"v" | "h">
              value={horizontal ? "h" : "v"}
              onPick={(v) => {
                onHorizontal(v === "h");
                close();
              }}
              options={[
                { value: "v", label: t.controls.vertical },
                { value: "h", label: t.controls.horizontal },
              ]}
            />
          )}
        </Chip>
      )}

      {dirty && (
        <Button
          variant="quiet"
          size="sm"
          onClick={onReset}
          icon={<RotateCcw size={14} aria-hidden />}
        >
          {t.controls.reset}
        </Button>
      )}
    </div>
  );
}
