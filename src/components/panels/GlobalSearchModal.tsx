import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Surah, Verse } from "../../types/quran";
import { surahMapOf } from "../../data/selectors";
import { categorizeOpening } from "../../data/fawatih";
import { normalizeArabic } from "../../data/arabic";
import { FAWATIH_COLORS } from "../../theme/palettes";
import type { ReaderTarget } from "../charts/common";
import { Badge, Modal, ModalHeader } from "../ui";

/** Highlight the first match of `query` (diacritic-insensitive) within `text`. */
function highlight(text: string, qNorm: string): React.ReactNode {
  const norm = normalizeArabic(text);
  const idx = norm.indexOf(qNorm);
  if (idx < 0) return text;
  // Map the normalized index back to the original string by counting
  // non-diacritic characters up to idx.
  let count = 0;
  let origStart = 0;
  for (let i = 0; i < text.length; i++) {
    if (count === idx) {
      origStart = i;
      break;
    }
    // advance count only for chars that survive normalization
    if (!/[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/.test(text[i])) count++;
  }
  let end = origStart;
  let ncount = 0;
  for (let i = origStart; i < text.length && ncount < qNorm.length; i++) {
    if (!/[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/.test(text[i])) ncount++;
    end = i + 1;
  }
  return (
    <>
      {text.slice(0, origStart)}
      <mark className="rounded bg-amber-200/70 px-0.5 dark:bg-amber-500/30">
        {text.slice(origStart, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

export function GlobalSearchModal({
  open,
  onClose,
  verses,
  surahs,
  onOpenReader,
}: {
  open: boolean;
  onClose: () => void;
  verses: Verse[];
  surahs: Surah[];
  onOpenReader: (t: ReaderTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const surahMap = useMemo(() => surahMapOf(surahs), [surahs]);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    const qNorm = normalizeArabic(q);
    const out: { verse: Verse; surahName: string }[] = [];
    for (const v of verses) {
      if (normalizeArabic(v.ar).includes(qNorm)) {
        const s = surahMap.get(v.s);
        out.push({
          verse: v,
          surahName: s ? `${s.number}. ${s.nameEn}` : `Surah ${v.s}`,
        });
      }
      if (out.length >= 200) break;
    }
    return out;
  }, [query, verses, surahMap]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-2xl"
      ariaLabel="Search the Quran"
    >
      <ModalHeader title="Search the Quran" onClose={onClose} />
      <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Arabic text (diacritic-insensitive)…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {query.length >= 2
            ? `${results.length}${results.length >= 200 ? "+" : ""} matches`
            : "Type at least 2 characters"}
        </p>
      </div>
      <div className="max-h-[calc(55*var(--zvh))] overflow-y-auto px-3 py-2">
        {results.map(({ verse, surahName }) => {
          const s = surahMap.get(verse.s);
          const color = s
            ? categorizeOpening(verse.s) !== "Statement / Narrative"
              ? (FAWATIH_COLORS[categorizeOpening(verse.s)] ?? "#94a3b8")
              : s.type === "Meccan"
                ? "#10b981"
                : "#8b5cf6"
            : "#94a3b8";
          return (
            <button
              key={verse.id}
              onClick={() => {
                onOpenReader({ scope: "surah", value: verse.s, anchor: verse.id });
                onClose();
              }}
              className="mb-1 flex w-full items-start gap-3 rounded-lg px-2 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Badge color={color}>
                {verse.s}:{verse.a}
              </Badge>
              <div className="min-w-0 flex-1">
                <p
                  dir="rtl"
                  className="quran-text truncate text-slate-800 dark:text-slate-100"
                >
                  {highlight(verse.ar, normalizeArabic(query.trim()))}
                </p>
                <p className="mt-0.5 text-left text-[11px] text-slate-400">{surahName}</p>
              </div>
            </button>
          );
        })}
        {query.length >= 2 && results.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">No matches found.</p>
        )}
      </div>
    </Modal>
  );
}
