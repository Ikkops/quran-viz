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
    return <p className="py-6 text-center text-sm text-slate-400">{t.bookmarks.empty}</p>;
  const sorted = [...bookmarks].sort((a, b) => b.at - a.at);
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
      {sorted.map((b) => {
        const v = verses[b.id - 1];
        if (!v) return null;
        const s = surahMap.get(v.s);
        return (
          <li key={b.id} className="flex items-start gap-2 py-2">
            <button
              type="button"
              onClick={() => onOpen({ scope: "surah", value: v.s, anchor: v.id })}
              className="min-w-0 flex-1 rounded-lg px-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {v.s}:{v.a} · {s?.nameEn}
              </div>
              <p
                dir="rtl"
                className="truncate font-arabic text-base text-slate-500 dark:text-slate-400"
              >
                {v.ar}
              </p>
              {b.note && (
                <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">
                  {b.note}
                </p>
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemove(b.id)}
              aria-label={t.bookmarks.remove(`${v.s}:${v.a}`)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
            >
              <Trash2 size={14} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
