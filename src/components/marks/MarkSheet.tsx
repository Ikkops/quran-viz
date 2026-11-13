import { useState } from "react";
import { Bookmark as BookmarkIcon, Check, Pin as PinIcon, Plus } from "lucide-react";
import {
  MARK_COLORS,
  addCollection,
  addPin,
  movePin,
  setItemNote,
  toggleInCollection,
  type Marks,
} from "../../lib/marks";
import { useI18n } from "../../i18n/I18nContext";
import { cx } from "../ui";
import { MarkForm } from "./MarksPanel";

/**
 * Marking one ayah, from the reader: move a pin here (or make one), or tick
 * the collections that should hold it and write a note.
 */
export function MarkSheet({
  kind,
  ayah,
  refOf,
  marks,
  onMarks,
}: {
  kind: "pin" | "collection";
  /** Global ayah id being marked. */
  ayah: number;
  /** "Al-Kahf 18:10" for an ayah id (where a pin sits now). */
  refOf: (ayah: number) => string;
  marks: Marks;
  onMarks: (m: Marks) => void;
}) {
  const { t } = useI18n();
  const m = t.marks;
  const [adding, setAdding] = useState(false);
  const row =
    "flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-surface-sunken";
  const addButton = (label: string) => (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg border border-line px-3 text-sm font-medium text-ink hover:border-ink-subtle touch:min-h-11"
    >
      <Plus size={16} aria-hidden /> {label}
    </button>
  );

  if (kind === "pin")
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm text-ink-muted">{m.pinHere}</p>
        <ul>
          {marks.pins.map((p) => {
            const here = p.ayah === ayah;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={here}
                  onClick={() => onMarks(movePin(marks, p.id, ayah))}
                  className={row}
                >
                  <PinIcon
                    size={18}
                    aria-hidden
                    className="shrink-0"
                    style={{ color: p.color }}
                    fill={here ? p.color : "none"}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-ink">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs tabular-nums text-ink-muted">
                      {here
                        ? m.here
                        : p.ayah === null
                          ? m.notPlaced
                          : m.nowAt(refOf(p.ayah))}
                    </span>
                  </span>
                  {here && <Check size={18} aria-hidden className="text-illumination" />}
                </button>
              </li>
            );
          })}
        </ul>
        {adding ? (
          <MarkForm
            initialColor={MARK_COLORS[marks.pins.length % MARK_COLORS.length]}
            placeholder={m.pinName}
            onCancel={() => setAdding(false)}
            onSave={(name, color) => {
              onMarks(addPin(marks, name, color, ayah));
              setAdding(false);
            }}
          />
        ) : (
          addButton(m.newPin)
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="text-sm text-ink-muted">{m.saveTo}</p>
      <ul>
        {marks.collections.map((c) => {
          const item = c.items.find((i) => i.id === ayah);
          return (
            <li key={c.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={!!item}
                onClick={() => onMarks(toggleInCollection(marks, c.id, ayah))}
                className={row}
              >
                <BookmarkIcon
                  size={18}
                  aria-hidden
                  className="shrink-0"
                  style={{ color: c.color }}
                  fill={item ? c.color : "none"}
                />
                <span className="min-w-0 flex-1 truncate text-base font-medium text-ink">
                  {c.name}
                </span>
                <span className="text-sm tabular-nums text-ink-subtle">
                  {c.items.length}
                </span>
                <span
                  aria-hidden
                  className={cx(
                    "flex h-5 w-5 items-center justify-center rounded border",
                    item
                      ? "border-illumination bg-illumination text-white dark:text-paper"
                      : "border-ink-subtle",
                  )}
                >
                  {item && <Check size={14} />}
                </span>
              </button>
              {item && (
                <textarea
                  defaultValue={item.note}
                  onBlur={(e) =>
                    onMarks(setItemNote(marks, c.id, ayah, e.target.value.trim()))
                  }
                  placeholder={t.reader.notePh}
                  aria-label={t.reader.noteAria}
                  rows={2}
                  className="mb-2 ml-8 w-[calc(100%-2rem)] rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink placeholder:text-ink-subtle"
                />
              )}
            </li>
          );
        })}
      </ul>
      {adding ? (
        <MarkForm
          initialColor={MARK_COLORS[(marks.collections.length + 1) % MARK_COLORS.length]}
          placeholder={m.collectionName}
          onCancel={() => setAdding(false)}
          onSave={(name, color) => {
            onMarks(addCollection(marks, name, color, ayah));
            setAdding(false);
          }}
        />
      ) : (
        addButton(m.newCollection)
      )}
    </div>
  );
}
