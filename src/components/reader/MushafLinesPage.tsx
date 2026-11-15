import { maskedParts, type WordMask } from "../../data/hifdh";
import { MaskedWord, STUMBLED } from "./Masked";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { Surah, Verse } from "../../types/quran";
import { pageLines, splitWords, type MushafLayout } from "../../data/mushafLayout";
import { glossOf, type WordInfo } from "../../data/words";
import type { GlossLang } from "../../data/useWordByWord";
import { alignTajweedToWords, type TajweedSegment } from "../../data/tajweed";
import { wordAt } from "../../data/wordTimings";
import type { PlayClock } from "../../data/useRecitation";
import { useArabicFont } from "../../theme/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";
import { cx } from "../ui";
import { AyahEnd, TajweedSegs } from "./AyahText";
import { BASMALA } from "./readerShared";
import { SurahBanner } from "./SurahBanner";
import { rectOf, type PickRect } from "./wordPick";

const idleClock: PlayClock = {
  subscribe: () => () => {},
  get: () => IDLE,
};
const IDLE = { id: null, t: 0, rev: 0 };

/** A line narrower than this share of the page's widest line is centred
 *  (the end of a surah, the short lines of the first two pages). */
const SHORT_LINE = 0.72;
/** Press-and-hold on a word: how long, and how far the pointer may drift. */
const HOLD_MS = 450;
const HOLD_SLOP = 10;

/**
 * One page of a printed mushaf, line for line: each line holds the words the
 * print puts there, spread to the full width; surah names and basmalas take
 * their own lines. The font size is fitted so the page's widest line fills
 * the width. Ayahs outside the reader's scope are dimmed. A tap on a word
 * opens its ayah's popup (`onAyah`), a press-and-hold the word's (`onWord`);
 * with `glosses`, each word's meaning sits under it.
 *
 * Each word but a line's last grows into the space after it (the same layout
 * as spreading the words apart), so an ayah's highlight runs on unbroken
 * across its words; the word's own text sits in an inner span.
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
  pickedWord,
  playingId,
  clock,
  timing,
  audioRange,
  glosses,
  glossLang,
  mask,
  onWord,
  onAyah,
}: {
  layout: MushafLayout;
  page: number;
  verses: Verse[];
  surahMap: Map<number, Surah>;
  wordCount: (id: number) => number;
  inScope: (id: number) => boolean;
  tajweed: (string | null)[] | null;
  /** The ayah whose context or popup is open. */
  selectedId: number | undefined;
  /** The word whose popup or details are open. */
  pickedWord: { id: number; w: number } | null;
  playingId: number | undefined;
  clock: PlayClock;
  timing: (id: number) => number[] | undefined;
  /** The player's edited range, faintly tinted. */
  audioRange: { from: number; to: number } | null;
  glosses: ((id: number) => WordInfo[] | undefined) | null;
  glossLang: GlossLang;
  /** Hafalan mode: which words are hidden. */
  mask?: WordMask | null;
  onWord: (id: number, w: number, el: Element) => void;
  onAyah: (id: number, rect: PickRect) => void;
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
      // The words' own text (the boxes around them grow into the gaps).
      const nat = rows.map((r) => {
        const ws = r.querySelectorAll<HTMLElement>("[data-ayah]");
        let w = 0;
        for (const c of ws) w += c.offsetWidth;
        return w + (ws.length - 1) * size * 0.25;
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

  // Press-and-hold opens the word; a tap (the click that follows a short
  // press) the ayah. Moving away (a scroll, a swipe) cancels the hold.
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const held = useRef(false);
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  };
  useEffect(() => cancelHold, []);
  const onDown = (id: number, w: number) => (e: PointerEvent<HTMLElement>) => {
    held.current = false;
    cancelHold();
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const word = e.currentTarget.querySelector("[data-ayah]") ?? e.currentTarget;
    hold.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        hold.current = null;
        held.current = true;
        onWord(id, w - 1, word);
      }, HOLD_MS),
    };
  };
  const onMove = (e: PointerEvent) => {
    const h = hold.current;
    if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP) cancelHold();
  };
  const onTap = (id: number) => (e: React.MouseEvent<HTMLElement>) => {
    // The click that ends a hold already opened the word.
    if (held.current) {
      held.current = false;
      return;
    }
    onAyah(id, rectOf(e.currentTarget.querySelector("[data-ayah]") ?? e.currentTarget));
  };
  const onKey = (id: number, w: number) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      onWord(id, w - 1, e.currentTarget);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAyah(id, rectOf(e.currentTarget));
    }
  };
  const first = verses[ids[0] - 1];
  const names = [...new Set(ids.map((id) => verses[id - 1]?.s))]
    .map((s) => surahMap.get(s)?.name)
    .filter(Boolean);
  const lineH = glosses ? "2.9em" : "2.05em";

  return (
    <figure
      aria-label={t.reader.page(page)}
      className="mx-auto my-4 max-w-[40rem] rounded-xl border border-line bg-surface px-3 pb-2 pt-2 shadow-soft sm:px-6"
    >
      <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-line/70 pb-1.5 text-xs text-ink-subtle">
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
            const box = s ? (
              <SurahBanner
                key={i}
                s={s}
                className="my-[0.15em]"
                style={{ height: `calc(${lineH} - 0.3em)` }}
              />
            ) : (
              <div key={i} style={{ height: lineH }} />
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
          // The ayah-level highlight of each word (the strongest state winning);
          // a run of equal ones is one band, rounded at its two ends.
          const band = l.words.map(({ id }) =>
            selectedId === id
              ? "bg-illumination/15"
              : playingId === id
                ? "bg-rubric/10"
                : audioRange && id >= audioRange.from && id <= audioRange.to
                  ? "bg-illumination/10"
                  : "",
          );
          return (
            <div
              key={i}
              data-line={i}
              className={cx("flex whitespace-nowrap", centred && "justify-center")}
              style={
                glosses
                  ? { minHeight: lineH, alignItems: "flex-start" }
                  : { height: lineH, lineHeight: lineH }
              }
            >
              {l.words.map(({ id, w }, k) => {
                const aw = words.get(id);
                const v = verses[id - 1];
                const last = w === wordCount(id);
                const lineEnd = k === l.words.length - 1;
                const lit = on && id === playingId && w - 1 >= on[0] && w - 1 < on[1];
                const picked = pickedWord?.id === id && pickedWord.w === w - 1;
                const gloss = glosses?.(id)?.[w - 1];
                const b = band[k];
                const runStart = !!b && band[k - 1] !== b;
                // The band stops at the run's last word, not after its gap: that
                // word draws it on its own text.
                const runEnd = !!b && band[k + 1] !== b;
                const [show, hide] = maskedParts(mask, id, w - 1, aw?.text[w - 1] ?? "");
                const text = (
                  <>
                    {hide ? (
                      <MaskedWord show={show} hide={hide} />
                    ) : aw?.segs?.[w - 1] ? (
                      <TajweedSegs segs={aw.segs[w - 1]} />
                    ) : (
                      show
                    )}
                    {last && v && <AyahEnd n={v.a} />}
                  </>
                );
                return (
                  <span
                    key={`${id}:${w}`}
                    role="button"
                    tabIndex={w === 1 ? 0 : -1}
                    aria-label={
                      w === 1 ? t.reader.selectAyah(`${v?.s}:${v?.a}`) : undefined
                    }
                    aria-pressed={w === 1 ? selectedId === id : undefined}
                    onPointerDown={onDown(id, w)}
                    onPointerMove={onMove}
                    onPointerUp={cancelHold}
                    onPointerCancel={cancelHold}
                    onPointerLeave={cancelHold}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={onTap(id)}
                    onKeyDown={onKey(id, w)}
                    className={cx(
                      "flex shrink-0 cursor-pointer select-none transition-colors [-webkit-touch-callout:none] motion-reduce:transition-none",
                      // Grow into the gap after the word (spread lines), or a
                      // fixed gap (centred lines); either way it is the word's.
                      !lineEnd && (centred ? "pe-[0.25em]" : "grow"),
                      !inScope(id) && "opacity-40",
                      !runEnd && b,
                      runStart && !runEnd && "rounded-s-sm",
                    )}
                  >
                    <span
                      data-ayah={id}
                      className={cx(
                        "transition-colors motion-reduce:transition-none",
                        glosses && "flex flex-col items-center",
                        !hide && mask?.stumbled(id, w - 1) && STUMBLED,
                        lit
                          ? "rounded-sm bg-illumination/25"
                          : picked
                            ? "rounded-sm bg-illumination/20 ring-1 ring-illumination/60"
                            : runEnd && cx(b, runStart ? "rounded-sm" : "rounded-e-sm"),
                      )}
                    >
                      {glosses ? (
                        <>
                          <span style={{ lineHeight: "1.75em" }}>{text}</span>
                          {/* Takes the word's width without widening it. */}
                          <span
                            lang={glossLang}
                            dir="ltr"
                            className="line-clamp-2 w-0 min-w-full whitespace-normal break-words hyphens-auto text-center font-ui leading-tight text-ink-subtle"
                            style={{ fontSize: "max(0.6rem, 0.3em)" }}
                          >
                            {gloss ? glossOf(gloss, glossLang) : "\u00a0"}
                          </span>
                        </>
                      ) : (
                        text
                      )}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2 text-center text-xs tabular-nums text-ink-subtle">
        {page}
      </figcaption>
    </figure>
  );
}
