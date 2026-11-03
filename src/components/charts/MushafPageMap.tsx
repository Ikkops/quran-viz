import { useMemo, useState } from "react";
import type { Surah, Verse } from "../../types/quran";
import type { ChartContext } from "./common";

interface PageInfo {
  page: number;
  words: number;
  surah?: number;
  first?: number;
  range?: string; // "2:191–2:286"
}

/** 604-page Mushaf grid; cell intensity encodes words on that page. */
export function MushafPageMap({
  verses,
  surahMap,
  ctx,
}: {
  verses: Verse[];
  surahMap: Map<number, Surah>;
  ctx: ChartContext;
}) {
  const [hover, setHover] = useState<PageInfo | null>(null);
  const [jump, setJump] = useState("");

  const { pages, max } = useMemo(() => {
    const words = new Map<number, number>();
    const firstSurah = new Map<number, number>();
    const firstV = new Map<number, Verse>();
    const lastV = new Map<number, Verse>();
    let maxPage = 0;
    for (const v of verses) {
      words.set(v.page, (words.get(v.page) ?? 0) + v.w);
      if (!firstSurah.has(v.page)) firstSurah.set(v.page, v.s);
      const fv = firstV.get(v.page);
      if (fv === undefined || v.id < fv.id) firstV.set(v.page, v);
      const lv = lastV.get(v.page);
      if (lv === undefined || v.id > lv.id) lastV.set(v.page, v);
      maxPage = Math.max(maxPage, v.page);
    }
    let mx = 1;
    const pages = Array.from({ length: maxPage }, (_, i): PageInfo => {
      const p = i + 1;
      const w = words.get(p) ?? 0;
      mx = Math.max(mx, w);
      const fv = firstV.get(p);
      const lv = lastV.get(p);
      const range = fv && lv ? `${fv.s}:${fv.a}–${lv.s}:${lv.a}` : undefined;
      return { page: p, words: w, surah: firstSurah.get(p), first: fv?.id, range };
    });
    return { pages, max: mx };
  }, [verses]);

  const openPage = (page: number) => {
    const p = pages[page - 1];
    if (p?.first) ctx.onOpen?.({ scope: "page", value: page, anchor: p.first });
  };

  const doJump = () => {
    const n = Number(jump);
    if (Number.isInteger(n) && n >= 1 && n <= pages.length) openPage(n);
  };

  return (
    <div className="relative flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={pages.length}
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doJump()}
          placeholder="Jump to page…"
          className="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          onClick={doJump}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Go
        </button>
        {hover && (
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
            Page {hover.page} · {hover.surah ? surahMap.get(hover.surah)?.nameEn : ""}
            {hover.range ? ` · ${hover.range}` : ""} · {hover.words} words
          </span>
        )}
      </div>

      {/* Fills the available area (no scroll): columns auto-fill, rows stretch. */}
      <div
        className="grid min-h-0 flex-1 gap-[2px]"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(20px, 1fr))",
          gridAutoRows: "1fr",
        }}
      >
        {pages.map((p) => {
          const opacity = p.words === 0 ? 0.06 : 0.2 + 0.8 * (p.words / max);
          return (
            <div
              key={p.page}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover((h) => (h?.page === p.page ? null : h))}
              onClick={() => openPage(p.page)}
              className="cursor-pointer rounded-[2px] transition hover:ring-2 hover:ring-offset-1"
              style={{ backgroundColor: ctx.primary, opacity }}
            />
          );
        })}
      </div>
    </div>
  );
}
