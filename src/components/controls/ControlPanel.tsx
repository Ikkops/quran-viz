import { RotateCcw } from "lucide-react";
import type { FilterMode, FilterState, SortKey } from "../../data/selectors";
import type { Surah } from "../../types/quran";
import type { ColorMode } from "../charts/common";
import { Select, Slider } from "../ui";

export interface VizOption {
  value: string;
  label: string;
  group: string;
}

export function ControlPanel({
  vizOptions,
  viz,
  onViz,
  surahs,
  filter,
  onFilter,
  colorMode,
  onColorMode,
  horizontal,
  onHorizontal,
  supportsLayout,
  supportsColorMode,
  onReset,
}: {
  vizOptions: VizOption[];
  viz: string;
  onViz: (v: string) => void;
  surahs: Surah[];
  filter: FilterState;
  onFilter: (f: FilterState) => void;
  colorMode: ColorMode;
  onColorMode: (m: ColorMode) => void;
  horizontal: boolean;
  onHorizontal: (h: boolean) => void;
  supportsLayout: boolean;
  supportsColorMode: boolean;
  onReset: () => void;
}) {
  const groups = [...new Set(vizOptions.map((o) => o.group))];

  return (
    <div className="space-y-4">
      <Select label="Visualization" value={viz} onChange={(e) => onViz(e.target.value)}>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {vizOptions
              .filter((o) => o.group === g)
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>

      <Select
        label="Range"
        value={filter.mode}
        onChange={(e) => onFilter({ ...filter, mode: e.target.value as FilterMode })}
      >
        <option value="all">Entire Quran</option>
        <option value="surah">By surah range</option>
        <option value="juz">By juz range</option>
      </Select>

      {filter.mode === "surah" && (
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="From surah"
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
            label="To surah"
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

      {filter.mode === "juz" && (
        <div className="space-y-2">
          <Slider
            label="Juz from"
            min={1}
            max={30}
            value={filter.juzRange[0]}
            onChange={(e) => {
              const from = Math.min(Number(e.target.value), filter.juzRange[1]);
              onFilter({ ...filter, juzRange: [from, filter.juzRange[1]] });
            }}
          />
          <Slider
            label="Juz to"
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

      <Select
        label="Sort surahs by"
        value={filter.sort}
        onChange={(e) => onFilter({ ...filter, sort: e.target.value as SortKey })}
      >
        <option value="quran">Quran order</option>
        <option value="verses">Verse count</option>
        <option value="words">Word count</option>
        <option value="letters">Letter count</option>
      </Select>

      {supportsColorMode && (
        <Select
          label="Colour by"
          value={colorMode}
          onChange={(e) => onColorMode(e.target.value as ColorMode)}
        >
          <option value="type">Meccan / Medinan</option>
          <option value="fawatih">Opening category</option>
        </Select>
      )}

      {supportsLayout && (
        <Select
          label="Bar layout"
          value={horizontal ? "h" : "v"}
          onChange={(e) => onHorizontal(e.target.value === "h")}
        >
          <option value="v">Vertical</option>
          <option value="h">Horizontal</option>
        </Select>
      )}

      <button
        type="button"
        onClick={onReset}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <RotateCcw size={13} /> Reset controls
      </button>
    </div>
  );
}
