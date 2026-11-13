import { Trash2 } from "lucide-react";
import type { Surah, Verse } from "../../types/quran";
import type { Bookmark } from "../../lib/bookmarks";
import type { ReaderTarget } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";

/** Bookmarked ayahs, newest first, with their notes. */
export function BookmarkList({
  bookmarks,
  verses,
  surahMap,
  onOpen,
  onRemove,
}: {
  bookmarks: Bookmark[];
  verses: Verse[];
  surahMap: Map<number, Surah>;
  onOpen: (t: ReaderTarget) => void;
  onRemove: (id: number) => void;
}) {
  const { t } = useI18n();
  if (!bookmarks.length)
    return (
      <p className="py-6 text-center text-sm text-ink-subtle">{t.bookmarks.empty}</p>
    );
  const sorted = [...bookmarks].sort((a, b) => b.at - a.at);
  return (
    <ul className="divide-y divide-surface-sunken dark:divide-line/60">
      {sorted.map((b) => {
        const v = verses[b.id - 1];
        if (!v) return null;
        const s = surahMap.get(v.s);
        return (
          <li key={b.id} className="flex items-start gap-2 py-2">
            <button
              type="button"
              onClick={() => onOpen({ scope: "surah", value: v.s, anchor: v.id })}
              className="min-w-0 flex-1 rounded-lg px-1 text-left hover:bg-paper dark:hover:bg-surface"
            >
              <div className="text-sm font-medium text-ink">
                {v.s}:{v.a} · {s?.nameEn}
              </div>
              <p
                lang="ar"
                dir="rtl"
                className="truncate font-arabic text-base text-ink-muted dark:text-ink-subtle"
              >
                {v.ar}
              </p>
              {b.note && (
                <p className="mt-0.5 text-xs italic text-ink-muted dark:text-ink-subtle">
                  {b.note}
                </p>
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemove(b.id)}
              aria-label={t.bookmarks.remove(`${v.s}:${v.a}`)}
              className="rounded p-1 text-ink-subtle hover:bg-surface-sunken hover:text-rose-500 dark:hover:bg-surface"
            >
              <Trash2 size={14} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
