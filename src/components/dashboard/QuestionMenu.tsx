import { useRef, type KeyboardEvent } from "react";
import type { VizDef, VizId } from "../../views/vizDefs";
import { useI18n } from "../../i18n/I18nContext";
import { cx } from "../ui";

/**
 * The dashboard's charts as the questions they answer, grouped (Surahs,
 * Ayahs, Vocabulary, Topics). A single-select listbox: arrow keys move.
 */
export function QuestionList({
  defs,
  value,
  onChange,
}: {
  defs: VizDef[];
  value: VizId;
  onChange: (v: VizId) => void;
}) {
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
      aria-label={t.dashboard.charts}
      onKeyDown={onKey}
      className="space-y-3"
    >
      {groups.map((g) => (
        <div key={g} role="group" aria-label={t.viz.groups[g]}>
          <div className="mb-1 px-2 text-sm font-medium text-ink-subtle">
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
                    "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm leading-snug transition-colors",
                    active
                      ? "bg-surface-sunken font-medium text-ink dark:bg-paper"
                      : "text-ink-muted hover:bg-surface-sunken/60 hover:text-ink dark:hover:bg-paper/60",
                  )}
                >
                  <Icon
                    size={16}
                    aria-hidden
                    className={cx(
                      "mt-0.5 shrink-0",
                      active ? "text-illumination" : "text-ink-subtle",
                    )}
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
