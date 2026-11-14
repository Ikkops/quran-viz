import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import type { Surah, Verse } from "../../types/quran";
import { pageLines, splitWords, type MushafLayout } from "../../data/mushafLayout";
import { alignTajweedToWords, type TajweedSegment } from "../../data/tajweed";
import { wordAt } from "../../data/wordTimings";
import type { PlayClock } from "../../data/useRecitation";
import { useArabicFont } from "../../theme/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";
import { cx } from "../ui";
import { AyahEnd, TajweedSegs } from "./AyahText";
import { BASMALA } from "./readerShared";

const idleClock: PlayClock = {
  subscribe: () => () => {},
  get: () => IDLE,
};
const IDLE = { id: null, t: 0, rev: 0 };

/** A line narrower than this share of the page's widest line is centred
 *  (the end of a surah, the short lines of the first two pages). */
const SHORT_LINE = 0.72;

/**
 * One page of a printed mushaf, line for line: each line holds the words the
 * print puts there, spread to the full width; surah names and basmalas take
 * their own lines. The font size is fitted so the page's widest line fills
 * the width. Ayahs outside the reader's scope are dimmed.
 */
export function MushafLinesPage({
  layout,
  page,
  verses,
  surahMap,
  wordCount,
  inScope,
  tajweed,
  selectedId,
  playingId,
  clock,
  timing,
  onSelect,
}: {
  layout: MushafLayout;
  page: number;
  verses: Verse[];
  surahMap: Map<number, Surah>;
  wordCount: (id: number) => number;
  inScope: (id: number) => boolean;
  tajweed: (string | null)[] | null;
  selectedId: number | undefined;
  playingId: number | undefined;
  clock: PlayClock;
  timing: (id: number) => number[] | undefined;
  onSelect: (id: number) => void;
}) {
  const { t } = useI18n();
  const arabicFont = useArabicFont();
  const lines = useMemo(
    () => pageLines(layout, page, wordCount, verses.length),
    [layout, page, wordCount, verses.length],
  );
  const ids = useMemo(
    () => [
      ...new Set(
        lines.flatMap((l) => (l.kind === "words" ? l.words.map((w) => w.id) : [])),
      ),
    ],
    [lines],
  );
  // Words (and their tajweed colours) of each ayah on the page.
  const words = useMemo(() => {
    const m = new Map<number, { text: string[]; segs: TajweedSegment[][] | null }>();
    for (const id of ids) {
      const v = verses[id - 1];
      if (!v) continue;
      const text = splitWords(v.ar);
      const marked = tajweed?.[id];
      m.set(id, { text, segs: marked ? alignTajweedToWords(marked, text) : null });
    }
    return m;
  }, [ids, verses, tajweed]);

  const playingHere = playingId !== undefined && ids.includes(playingId);
  const time = useSyncExternalStore(
    playingHere ? clock.subscribe : idleClock.subscribe,
    playingHere ? clock.get : idleClock.get,
  );
  const on =
    playingHere && time.id === playingId
      ? wordAt(timing(playingId), time.t * 1000)
      : null;

  // Fit: measure each line's natural width once, then size the font so the
  // widest fills the page and centre the short ones.
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ size: number; short: Set<number> } | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const guess = width ? width / 15 : 24;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !width) return;
    const measure = () => {
      const rows = [...el.querySelectorAll<HTMLElement>("[data-line]")];
      const size = parseFloat(getComputedStyle(el).fontSize) || guess;
      const nat = rows.map((r) => {
        let w = 0;
        for (const c of r.children) w += (c as HTMLElement).offsetWidth;
        return w + (r.children.length - 1) * size * 0.25;
      });
      const widest = Math.max(1, ...nat);
      if (widest <= 1) return;
      const short = new Set<number>();
      rows.forEach((r, i) => {
        if (nat[i] < widest * SHORT_LINE) short.add(Number(r.dataset.line));
      });
      setFit({ size: (size * width * 0.985) / widest, short });
    };
    // Widths scale with the font size, so measuring at the current size is
    // enough; again once the Qur'an font has arrived.
    measure();
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) requestAnimationFrame(() => alive && measure());
    });
    return () => {
      alive = false;
    };
    // `guess` follows `width`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, lines, arabicFont, words]);

  const onKey = (id: number) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };
  const first = verses[ids[0] - 1];
  const names = [...new Set(ids.map((id) => verses[id - 1]?.s))]
    .map((s) => surahMap.get(s)?.name)
    .filter(Boolean);
  const lineH = "2.05em";

  return (
    <figure
      aria-label={t.reader.page(page)}
      className="mx-auto my-4 max-w-[40rem] rounded-lg border border-line bg-surface px-3 pb-2 pt-2 sm:px-6"
    >
      <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-line pb-1 text-xs text-ink-subtle">
        <span className="tabular-nums">
          {first && `${t.scope.juz} ${first.juz} · ${t.scope.hizb} ${first.hizb}`}
        </span>
        <span className="truncate">{names.join(" · ")}</span>
      </div>
      <div
        ref={box}
        lang="ar"
        dir="rtl"
        className="flex flex-col justify-center text-ink"
        style={{
          fontFamily: "var(--font-arabic, 'Amiri Quran', serif)",
          fontSize: `${fit?.size ?? guess}px`,
          minHeight: `calc(${layout.lines} * ${lineH})`,
          visibility: fit ? undefined : "hidden",
        }}
      >
        {lines.map((l, i) => {
          if (l.kind === "blank") return <div key={i} style={{ height: lineH }} />;
          if (l.kind === "name") {
            const s = surahMap.get(l.surah);
            const box = (
              <div
                key={i}
                className="my-[0.15em] flex items-center justify-center rounded-md border border-line bg-surface-sunken dark:bg-paper"
                style={{ height: `calc(${lineH} - 0.3em)` }}
              >
                <span className="text-[0.8em]">{s?.nameAr}</span>
                <span dir="ltr" className="mr-3 font-ui text-[0.45em] text-ink-muted">
                  {s?.number}. {s?.name}
                </span>
              </div>
            );
            // Prints that set the basmala in the name's line: here it gets a
            // line of its own under the name.
            return l.basmala ? (
              <div key={i}>
                {box}
                <div className="text-center" style={{ height: lineH, lineHeight: lineH }}>
                  {BASMALA}
                </div>
              </div>
            ) : (
              box
            );
          }
          if (l.kind === "basmala")
            return (
              <div
                key={i}
                className="text-center"
                style={{ height: lineH, lineHeight: lineH }}
              >
                {BASMALA}
              </div>
            );
          const centred = fit?.short.has(i);
          return (
            <div
              key={i}
              data-line={i}
              className={cx(
                "flex whitespace-nowrap",
                centred ? "justify-center gap-[0.25em]" : "justify-between",
              )}
              style={{ height: lineH, lineHeight: lineH }}
            >
              {l.words.map(({ id, w }) => {
                const aw = words.get(id);
                const v = verses[id - 1];
                const last = w === wordCount(id);
                const lit = on && id === playingId && w - 1 >= on[0] && w - 1 < on[1];
                return (
                  <span
                    key={`${id}:${w}`}
                    role="button"
                    tabIndex={w === 1 ? 0 : -1}
                    aria-label={
                      w === 1 ? t.reader.selectAyah(`${v?.s}:${v?.a}`) : undefined
                    }
                    aria-pressed={w === 1 ? selectedId === id : undefined}
                    onClick={() => onSelect(id)}
                    onKeyDown={onKey(id)}
                    className={cx(
                      "shrink-0 cursor-pointer rounded-sm transition-colors motion-reduce:transition-none",
                      !inScope(id) && "opacity-40",
                      selectedId === id && "bg-illumination/15",
                      playingId === id && "bg-rubric/10",
                      lit && "bg-illumination/25",
                    )}
                  >
                    {aw?.segs?.[w - 1] ? (
                      <TajweedSegs segs={aw.segs[w - 1]} />
                    ) : (
                      (aw?.text[w - 1] ?? "")
                    )}
                    {last && v && <AyahEnd n={v.a} />}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <figcaption className="mt-1 border-t border-line pt-1 text-center text-xs tabular-nums text-ink-subtle">
        {page}
      </figcaption>
    </figure>
  );
}
