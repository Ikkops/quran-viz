import { useState } from "react";
import {
  Bookmark as BookmarkIcon,
  ChevronDown,
  Pencil,
  Pin as PinIcon,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { QuranData } from "../../types/quran";
import type { ReaderTarget } from "../charts/common";
import {
  MARK_COLORS,
  addCollection,
  addPin,
  deleteMark,
  editMark,
  toggleInCollection,
  type MarkColor,
  type Marks,
} from "../../lib/marks";
import { useI18n } from "../../i18n/I18nContext";
import { Card, QuietIconButton, cx } from "../ui";

/** The eight colours as a row of swatches. */
export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: MarkColor;
  onChange: (c: MarkColor) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {MARK_COLORS.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`${label} ${i + 1}`}
          onClick={() => onChange(c)}
          className={cx(
            "h-8 w-8 rounded-full border-2 touch:h-10 touch:w-10",
            value === c ? "border-ink" : "border-transparent",
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

/** Name and colour for a new or an existing pin or collection. */
export function MarkForm({
  initialName = "",
  initialColor,
  placeholder,
  onSave,
  onCancel,
}: {
  initialName?: string;
  initialColor: MarkColor;
  placeholder: string;
  onSave: (name: string, color: MarkColor) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<MarkColor>(initialColor);
  return (
    <form
      className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name, color);
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle touch:min-h-11"
      />
      <ColorPicker value={color} onChange={setColor} label={t.marks.color} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="min-h-10 rounded-lg bg-illumination px-4 text-sm font-semibold text-white disabled:opacity-50 dark:text-paper touch:min-h-11"
        >
          {t.marks.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 rounded-lg px-3 text-sm font-medium text-ink-muted hover:text-ink touch:min-h-11"
        >
          {t.reader.audio.cancel}
        </button>
      </div>
    </form>
  );
}

/**
 * Pins (one place each, for carrying on a reading) and collections (any
 * number of ayahs): open, add, rename, recolour, delete.
 */
export function MarksPanel({
  data,
  marks,
  onMarks,
  onOpen,
}: {
  data: QuranData;
  marks: Marks;
  onMarks: (m: Marks) => void;
  onOpen: (t: ReaderTarget) => void;
}) {
  const { t } = useI18n();
  const m = t.marks;
  // "new-pin", "new-collection", or the id being edited.
  const [form, setForm] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(marks.collections[0]?.id ?? null);
  const refOf = (ayah: number) => {
    const v = data.verses[ayah - 1];
    return v ? `${data.surahs[v.s - 1]?.name ?? ""} ${v.s}:${v.a}` : "";
  };
  const go = (ayah: number) => {
    const v = data.verses[ayah - 1];
    if (v) onOpen({ scope: "surah", value: v.s, anchor: ayah });
  };
  const remove = (id: string, name: string) => {
    if (window.confirm(m.deleteConfirm(name))) onMarks(deleteMark(marks, id));
  };
  const tools = (x: { id: string; name: string }) => (
    <>
      <QuietIconButton label={m.edit(x.name)} onClick={() => setForm(x.id)}>
        <Pencil size={16} />
      </QuietIconButton>
      <QuietIconButton label={m.delete(x.name)} onClick={() => remove(x.id, x.name)}>
        <Trash2 size={16} />
      </QuietIconButton>
    </>
  );
  const addButton = (label: string, key: string) => (
    <button
      type="button"
      onClick={() => setForm(key)}
      className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg border border-line px-3 text-sm font-medium text-ink hover:border-ink-subtle touch:min-h-11"
    >
      <Plus size={16} aria-hidden /> {label}
    </button>
  );

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-4">
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-subtle">
          <PinIcon size={15} aria-hidden /> {m.pins}
        </h2>
        <p className="text-xs text-ink-subtle">{m.pinsHelp}</p>
        <ul className="divide-y divide-line/70">
          {marks.pins.map((p) =>
            form === p.id ? (
              <li key={p.id} className="py-2">
                <MarkForm
                  initialName={p.name}
                  initialColor={p.color}
                  placeholder={m.pinName}
                  onCancel={() => setForm(null)}
                  onSave={(name, color) => {
                    onMarks(editMark(marks, p.id, { name, color }));
                    setForm(null);
                  }}
                />
              </li>
            ) : (
              <li key={p.id} className="flex items-center gap-1 py-1">
                <button
                  type="button"
                  disabled={p.ayah === null}
                  onClick={() => p.ayah !== null && go(p.ayah)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 text-left enabled:hover:bg-surface-sunken"
                >
                  <PinIcon
                    size={18}
                    aria-hidden
                    className="shrink-0"
                    style={{ color: p.color }}
                    fill={p.ayah === null ? "none" : p.color}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium text-ink">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs tabular-nums text-ink-muted">
                      {p.ayah === null ? m.notPlaced : refOf(p.ayah)}
                    </span>
                  </span>
                </button>
                {tools(p)}
              </li>
            ),
          )}
        </ul>
        {form === "new-pin" ? (
          <MarkForm
            initialColor={MARK_COLORS[marks.pins.length % MARK_COLORS.length]}
            placeholder={m.pinName}
            onCancel={() => setForm(null)}
            onSave={(name, color) => {
              onMarks(addPin(marks, name, color));
              setForm(null);
            }}
          />
        ) : (
          addButton(m.newPin, "new-pin")
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-subtle">
          <BookmarkIcon size={15} aria-hidden /> {m.collections}
        </h2>
        <p className="text-xs text-ink-subtle">{m.collectionsHelp}</p>
        <ul className="divide-y divide-line/70">
          {marks.collections.map((c) =>
            form === c.id ? (
              <li key={c.id} className="py-2">
                <MarkForm
                  initialName={c.name}
                  initialColor={c.color}
                  placeholder={m.collectionName}
                  onCancel={() => setForm(null)}
                  onSave={(name, color) => {
                    onMarks(editMark(marks, c.id, { name, color }));
                    setForm(null);
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="py-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-expanded={open === c.id}
                    onClick={() => setOpen(open === c.id ? null : c.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 text-left hover:bg-surface-sunken"
                  >
                    <BookmarkIcon
                      size={18}
                      aria-hidden
                      className="shrink-0"
                      style={{ color: c.color }}
                      fill={c.color}
                    />
                    <span className="min-w-0 flex-1 truncate text-base font-medium text-ink">
                      {c.name}
                    </span>
                    <span className="text-sm tabular-nums text-ink-muted">
                      {c.items.length}
                    </span>
                    <ChevronDown
                      size={16}
                      aria-hidden
                      className={cx(
                        "shrink-0 text-ink-subtle transition-transform",
                        open === c.id && "rotate-180",
                      )}
                    />
                  </button>
                  {tools(c)}
                </div>
                {open === c.id &&
                  (c.items.length === 0 ? (
                    <p className="px-1 pb-2 text-sm text-ink-subtle">
                      {m.emptyCollection}
                    </p>
                  ) : (
                    <ul className="pb-1 pl-7">
                      {[...c.items]
                        .sort((a, b) => b.at - a.at)
                        .map((it) => {
                          const v = data.verses[it.id - 1];
                          if (!v) return null;
                          return (
                            <li key={it.id} className="flex items-start gap-1">
                              <button
                                type="button"
                                onClick={() => go(it.id)}
                                className="min-w-0 flex-1 rounded-lg px-1 py-1.5 text-left hover:bg-surface-sunken"
                              >
                                <span className="block text-sm font-medium tabular-nums text-ink">
                                  {refOf(it.id)}
                                </span>
                                <span
                                  lang="ar"
                                  dir="rtl"
                                  className="block truncate font-arabic text-base text-ink-muted"
                                >
                                  {v.ar}
                                </span>
                                {it.note && (
                                  <span className="block text-xs italic text-ink-muted">
                                    {it.note}
                                  </span>
                                )}
                              </button>
                              <QuietIconButton
                                label={m.removeFrom(`${v.s}:${v.a}`, c.name)}
                                onClick={() =>
                                  onMarks(toggleInCollection(marks, c.id, it.id))
                                }
                              >
                                <X size={16} />
                              </QuietIconButton>
                            </li>
                          );
                        })}
                    </ul>
                  ))}
              </li>
            ),
          )}
        </ul>
        {form === "new-collection" ? (
          <MarkForm
            initialColor={
              MARK_COLORS[(marks.collections.length + 1) % MARK_COLORS.length]
            }
            placeholder={m.collectionName}
            onCancel={() => setForm(null)}
            onSave={(name, color) => {
              onMarks(addCollection(marks, name, color));
              setForm(null);
            }}
          />
        ) : (
          addButton(m.newCollection, "new-collection")
        )}
      </Card>
    </div>
  );
}
