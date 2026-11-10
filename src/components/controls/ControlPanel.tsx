import { useRef, type KeyboardEvent } from "react";
import { RotateCcw } from "lucide-react";
import {
  SORT_LABELS,
  type FilterMode,
  type FilterState,
  type PlaceFilter,
  type SortKey,
} from "../../data/selectors";
import type { Surah } from "../../types/quran";
import type { VizDef, VizId, VizUses } from "../../views/vizDefs";
import type { ColorMode } from "../charts/common";
import { useTheme } from "../../theme/ThemeContext";
import { cx, Select, Slider } from "../ui";
import { useI18n } from "../../i18n/I18nContext";

/** Grouped, always-visible list of visualizations (a single-select listbox). */
function VizList({
  defs,
  value,
  onChange,
}: {
  defs: VizDef[];
  value: VizId;
  onChange: (v: VizId) => void;
}) {
  const { primary } = useTheme();
  const { t } = useI18n();
  const refs = useRef(new Map<VizId, HTMLButtonElement>());
  const groups = [...new Set(defs.map((d) => d.group))];
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = defs.findIndex((d) => d.value === value);
    const next = defs[(i + (e.key === "ArrowDown" ? 1 : defs.length - 1)) % defs.length];
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };
  return (
    <div
      role="listbox"
      aria-label={t.controls.visualization}
      onKeyDown={onKey}
      className="space-y-2.5"
    >
      {groups.map((g) => (
        <div key={g} role="group" aria-label={t.viz.groups[g]}>
          <div className="mb-0.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t.viz.groups[g]}
          </div>
          {defs
            .filter((d) => d.group === g)
            .map((d) => {
              const active = d.value === value;
              const Icon = d.icon;
              return (
                <button
                  key={d.value}
                  ref={(el) => {
                    if (el) refs.current.set(d.value, el);
                  }}
                  type="button"
                  role="option"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => onChange(d.value)}
                  className={cx(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                    active
                      ? "bg-slate-100 font-medium text-slate-900 dark:bg-slate-700 dark:text-white"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  <Icon
                    size={15}
                    className={active ? undefined : "text-slate-400"}
                    style={active ? { color: primary } : undefined}
                  />
                  {t.viz.labels[d.value]}
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}

export function ControlPanel({
  vizDefs,
  viz,
  onViz,
  uses,
  surahs,
  filter,
  onFilter,
  colorMode,
  onColorMode,
  horizontal,
  onHorizontal,
  onReset,
}: {
  vizDefs: VizDef[];
  viz: VizId;
  onViz: (v: VizId) => void;
  uses: VizUses;
  surahs: Surah[];
  filter: FilterState;
  onFilter: (f: FilterState) => void;
  colorMode: ColorMode;
  onColorMode: (m: ColorMode) => void;
  horizontal: boolean;
  onHorizontal: (h: boolean) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <VizList defs={vizDefs} value={viz} onChange={onViz} />

      <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700/60">
        {uses.range ? (
          <Select
            label={t.controls.range}
            value={filter.mode}
            onChange={(e) => onFilter({ ...filter, mode: e.target.value as FilterMode })}
          >
            <option value="all">{t.controls.entire}</option>
            <option value="surah">{t.controls.bySurah}</option>
            <option value="juz">{t.controls.byJuz}</option>
          </Select>
        ) : (
          <p className="px-1 text-xs text-slate-400">{t.controls.noFilters}</p>
        )}

        {uses.range && filter.mode === "surah" && (
          <div className="grid grid-cols-2 gap-2">
            <Select
              label={t.controls.fromSurah}
              value={filter.surahRange[0]}
              onChange={(e) => {
                const from = Math.min(Number(e.target.value), filter.surahRange[1]);
                onFilter({ ...filter, surahRange: [from, filter.surahRange[1]] });
              }}
            >
              {surahs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}. {s.nameEn}
                </option>
              ))}
            </Select>
            <Select
              label={t.controls.toSurah}
              value={filter.surahRange[1]}
              onChange={(e) => {
                const to = Math.max(Number(e.target.value), filter.surahRange[0]);
                onFilter({ ...filter, surahRange: [filter.surahRange[0], to] });
              }}
            >
              {surahs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}. {s.nameEn}
                </option>
              ))}
            </Select>
          </div>
        )}

        {uses.range && filter.mode === "juz" && (
          <div className="space-y-2">
            <Slider
              label={t.controls.juzFrom}
              min={1}
              max={30}
              value={filter.juzRange[0]}
              onChange={(e) => {
                const from = Math.min(Number(e.target.value), filter.juzRange[1]);
                onFilter({ ...filter, juzRange: [from, filter.juzRange[1]] });
              }}
            />
            <Slider
              label={t.controls.juzTo}
              min={1}
              max={30}
              value={filter.juzRange[1]}
              onChange={(e) => {
                const to = Math.max(Number(e.target.value), filter.juzRange[0]);
                onFilter({ ...filter, juzRange: [filter.juzRange[0], to] });
              }}
            />
          </div>
        )}

        {uses.range && (
          <Select
            label={t.controls.ayahs}
            value={filter.place ?? "all"}
            onChange={(e) =>
              onFilter({ ...filter, place: e.target.value as PlaceFilter })
            }
            title={t.controls.placeTitle}
          >
            <option value="all">{t.controls.allAyahs}</option>
            <option value="Meccan">{t.controls.meccanOnly}</option>
            <option value="Medinan">{t.controls.medinanOnly}</option>
          </Select>
        )}

        {uses.sort && (
          <Select
            label={t.controls.sortBy}
            value={filter.sort}
            onChange={(e) => onFilter({ ...filter, sort: e.target.value as SortKey })}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {t.sort[k]}
              </option>
            ))}
          </Select>
        )}

        {uses.color && (
          <Select
            label={t.controls.colorBy}
            value={colorMode}
            onChange={(e) => onColorMode(e.target.value as ColorMode)}
          >
            <option value="type">{t.controls.byType}</option>
            <option value="fawatih">{t.controls.byOpening}</option>
          </Select>
        )}

        {uses.layout && (
          <Select
            label={t.controls.layout}
            value={horizontal ? "h" : "v"}
            onChange={(e) => onHorizontal(e.target.value === "h")}
          >
            <option value="v">{t.controls.vertical}</option>
            <option value="h">{t.controls.horizontal}</option>
          </Select>
        )}

        <button
          type="button"
          onClick={onReset}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <RotateCcw size={13} /> {t.controls.reset}
        </button>
      </div>
    </div>
  );
}
