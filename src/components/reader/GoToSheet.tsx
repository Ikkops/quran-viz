import { useEffect, useMemo, useRef, useState } from "react";
import type { Surah, Verse } from "../../types/quran";
import { READER_SCOPES, type ReaderScope, type ReaderTarget } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";
import { searchKeyArabic } from "../../data/arabic";
import { Select, cx } from "../ui";
import { scopeField } from "./readerShared";

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]/g, "");

/** One scrolling column of choices with a filter box above it. */
function Column<T extends { key: number; label: string }>({
  title,
  placeholder,
  numeric,
  items,
  value,
  onPick,
  filter,
  grow,
}: {
  title: string;
  placeholder: string;
  numeric?: boolean;
  items: T[];
  value: number;
  onPick: (key: number) => void;
  /** Keep an item for the typed text. */
  filter: (item: T, q: string) => boolean;
  grow?: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const shown = q.trim() ? items.filter((it) => filter(it, q.trim())) : items;
  // Keep the chosen item in view (on open, and when another column moves it).
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: "center" });
  }, [value, q]);
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", grow ? "flex-[2]" : "flex-1")}>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        {title}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && shown[0]) {
              onPick(shown[0].key);
              setQ("");
            }
          }}
          inputMode={numeric ? "numeric" : undefined}
          placeholder={placeholder}
          className="min-h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-base font-normal text-ink placeholder:text-ink-subtle touch:min-h-11"
        />
      </label>
      <div
        ref={list}
        role="listbox"
        aria-label={title}
        className="h-[calc(34*var(--zvh))] min-h-[10rem] overflow-y-auto rounded-lg border border-line/70"
      >
        {shown.map((it) => (
          <button
            key={it.key}
            type="button"
            role="option"
            aria-selected={it.key === value}
            onClick={() => onPick(it.key)}
            className={cx(
              "block min-h-10 w-full truncate px-2.5 text-left text-base tabular-nums touch:min-h-11",
              it.key === value
                ? "bg-surface-sunken font-semibold text-ink"
                : "text-ink-muted hover:bg-surface-sunken/60",
            )}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * "Go to": pick a surah, an ayah or a mushaf page (the three stay in step),
 * choose what to read by (surah, juz, page…), and go.
 */
export function GoToSheet({
  surahs,
  verses,
  scope,
  at,
  onGo,
}: {
  surahs: Surah[];
  verses: Verse[];
  scope: ReaderScope;
  /** The ayah the reader is on. */
  at: Verse;
  onGo: (t: ReaderTarget) => void;
}) {
  const { t } = useI18n();
  const g = t.reader.goToSheet;
  const [id, setId] = useState(at.id);
  const [by, setBy] = useState<ReaderScope>(scope);
  const v = verses[id - 1] ?? at;
  const surah = surahs[v.s - 1];
  const firstOfSurah = id - v.a + 1;

  const surahItems = useMemo(
    () => surahs.map((s) => ({ key: s.id, label: `${s.id}. ${s.name}`, s })),
    [surahs],
  );
  const ayahItems = useMemo(
    () =>
      Array.from({ length: surah?.ayahCount ?? 0 }, (_, i) => ({
        key: i + 1,
        label: String(i + 1),
      })),
    [surah],
  );
  const pageItems = useMemo(
    () => Array.from({ length: 604 }, (_, i) => ({ key: i + 1, label: String(i + 1) })),
    [],
  );
  const firstOnPage = useMemo(() => {
    const out = new Map<number, number>();
    for (const x of verses) if (!out.has(x.page)) out.set(x.page, x.id);
    return out;
  }, [verses]);

  const go = () => {
    const value = scopeField(v, by);
    // Opening a scope at its first ayah needs no anchor (and no highlight).
    const first = verses.find((x) => scopeField(x, by) === value)?.id;
    onGo({ scope: by, value, anchor: first === v.id ? undefined : v.id });
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Column
          grow
          title={g.surah}
          placeholder={g.surahPh}
          items={surahItems}
          value={v.s}
          onPick={(n) => {
            const s = surahs[n - 1];
            const first = verses.find((x) => x.s === n);
            if (s && first) setId(first.id);
          }}
          filter={(it, q) =>
            /^\d+$/.test(q)
              ? String(it.key).startsWith(q)
              : plain(it.s.nameEn).includes(plain(q)) ||
                plain(it.s.nameId).includes(plain(q)) ||
                (searchKeyArabic(q) !== "" &&
                  searchKeyArabic(it.s.nameAr).includes(searchKeyArabic(q)))
          }
        />
        <Column
          numeric
          title={g.ayah}
          placeholder="1, 2…"
          items={ayahItems}
          value={v.a}
          onPick={(a) => setId(firstOfSurah + a - 1)}
          filter={(it, q) => it.label.startsWith(q)}
        />
        <Column
          numeric
          title={g.page}
          placeholder="1, 2…"
          items={pageItems}
          value={v.page}
          onPick={(pg) => setId(firstOnPage.get(pg) ?? id)}
          filter={(it, q) => it.label.startsWith(q)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-36">
          <Select<ReaderScope>
            label={g.readBy}
            value={by}
            onChange={setBy}
            options={READER_SCOPES.map((s) => ({ value: s, label: t.scope[s] }))}
          />
        </div>
        <button
          type="button"
          onClick={go}
          className="ml-auto min-h-10 flex-1 rounded-lg bg-illumination px-5 text-base font-semibold text-white hover:opacity-90 dark:text-paper touch:min-h-11"
        >
          {g.go(`${surah?.name ?? ""} ${v.s}:${v.a}`)}
        </button>
      </div>
    </div>
  );
}
