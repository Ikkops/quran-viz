import { maskedParts, type WordMask } from "../../data/hifdh";
import { MaskedWord, STUMBLED } from "./Masked";
import {
  Fragment,
  memo,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
} from "react";
import type { Surah, Verse } from "../../types/quran";
import {
  lineWidths,
  pageLines,
  splitWords,
  type MushafLayout,
} from "../../data/mushafLayout";
import { glossOf, type WordInfo } from "../../data/words";
import type { GlossLang } from "../../data/useWordByWord";
import {
  alignTajweedToWords,
  tajweedColor,
  type TajweedSegment,
} from "../../data/tajweed";
import { wordAt } from "../../data/wordTimings";
import type { PlayClock } from "../../data/useRecitation";
import { useArabicFont, useTheme } from "../../theme/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";
import { cx } from "../ui";
import { AyahEnd } from "./AyahText";
import { BASMALA } from "./readerShared";
import { SurahBanner } from "./SurahBanner";
import { PageSpine } from "./MushafPage";
import { rectOf, type PickRect } from "./wordPick";

const idleClock: PlayClock = {
  subscribe: () => () => {},
  get: () => IDLE,
};
const IDLE = { id: null, t: 0, rev: 0 };

/** Press-and-hold on a word: how long, and how far the pointer may drift. */
const HOLD_MS = 450;
const HOLD_SLOP = 10;
/** Lines a page drawn off screen adds per step. */
const LINE_STEP = 5;
/** The last page width seen: every page of the list has the same. */
let lastWidth = 0;
/** Font size the lines are measured at (widths scale with it). */
const REF_PX = 40;
/** Text that needs the Arabic face, to ask whether it has loaded. */
const PROBE = "\u0628\u0633\u0645";
let canvas: CanvasRenderingContext2D | null | undefined;
/** Text width at `REF_PX` in the Arabic face, from canvas metrics (no
 *  layout); null without a canvas (tests). */
function canvasMeasure(arabicFont: string): ((text: string) => number) | null {
  canvas ??= document.createElement("canvas").getContext("2d");
  if (!canvas) return null;
  const ctx = canvas;
  ctx.font = `${REF_PX}px "${arabicFont}", "Amiri", serif`;
  return (text) => ctx.measureText(text).width;
}

/** With meanings shown, the Arabic's own line height above each meaning. */
const ARABIC_LINE = "1.75em";

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
export const MushafLinesPage = memo(
  function MushafLinesPage({
    deferred = false,
    layout,
    page,
    verses,
    surahMap,
    wordCount,
    scopeFrom,
    scopeTo,
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
    /** Mounted off screen: the words follow in a transition (time-sliced). */
    deferred?: boolean;
    layout: MushafLayout;
    page: number;
    verses: Verse[];
    surahMap: Map<number, Surah>;
    wordCount: (id: number) => number;
    /** The reader's scope (global ids); ayahs outside it are dimmed. */
    scopeFrom: number;
    scopeTo: number;
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
    const { dark } = useTheme();
    // Off screen at mount: the page's lines arrive `LINE_STEP` at a time, each
    // step a transition (time-sliced, and a short commit), with placeholders of
    // the same height below; on screen (or once scrolled to), drawn at once.
    // `deferred` counts at mount only (see the memo below): a page coming on
    // screen mid-way finishes its last steps, a few frames.
    const [drawnLines, setDrawnLines] = useState(deferred ? 0 : Infinity);
    const shown = drawnLines;
    const full = shown !== 0;
    const inScope = (id: number) => id >= scopeFrom && id <= scopeTo;
    const lines = useMemo(
      () => pageLines(layout, page, wordCount, verses.length),
      [layout, page, wordCount, verses.length],
    );
    useEffect(() => {
      if (drawnLines >= lines.length) return;
      startTransition(() => setDrawnLines((n) => n + LINE_STEP));
    }, [drawnLines, lines.length]);
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
      if (!full) return m;
      for (const id of ids) {
        const v = verses[id - 1];
        if (!v) continue;
        const text = splitWords(v.ar);
        const marked = tajweed?.[id];
        m.set(id, { text, segs: marked ? alignTajweedToWords(marked, text) : null });
      }
      return m;
    }, [ids, verses, tajweed, full]);

    const playingHere = playingId !== undefined && ids.includes(playingId);
    const time = useSyncExternalStore(
      playingHere ? clock.subscribe : idleClock.subscribe,
      playingHere ? clock.get : idleClock.get,
    );
    const on =
      playingHere && time.id === playingId
        ? wordAt(timing(playingId), time.t * 1000)
        : null;

    // Fit: each line's natural width comes from canvas text metrics, which need
    // no layout, so a page mounts at its fitted size in one pass (measuring the
    // drawn words made every new page lay out, re-render and lay out again).
    // The font size makes the widest line fill the page; short lines centre.
    const box = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(lastWidth);
    useLayoutEffect(() => {
      const el = box.current;
      if (!el) return;
      // Only a session's first page reads its width at once (a forced layout);
      // later ones start at `lastWidth` and hear of changes in the observer's
      // callback, where layout is done.
      if (!lastWidth || typeof ResizeObserver === "undefined") {
        lastWidth = el.clientWidth;
        setWidth(lastWidth);
      }
      if (typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => {
        lastWidth = el.clientWidth;
        setWidth(lastWidth);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);
    const guess = width ? width / 15 : 24;
    // A face nothing has drawn yet loads only when asked: measure again once
    // it is in (until then the metrics are the fallback's).
    const [fontTick, setFontTick] = useState(0);
    useEffect(() => {
      const face = `${REF_PX}px "${arabicFont}"`;
      if (!document.fonts || document.fonts.check(face, PROBE)) return;
      let alive = true;
      document.fonts.load(face, PROBE).then(
        () => alive && setFontTick((n) => n + 1),
        () => undefined,
      );
      return () => {
        alive = false;
      };
    }, [arabicFont]);
    const natural = useMemo(
      () => {
        const measure = full && canvasMeasure(arabicFont);
        return measure
          ? lineWidths(lines, words, verses, wordCount, arabicFont, measure, REF_PX)
          : null;
      },
      // `fontTick`: the face arrived, so the same text measures differently.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [lines, words, verses, wordCount, arabicFont, fontTick, full],
    );
    const fit =
      natural && width
        ? { size: (REF_PX * width * 0.985) / natural.widest, short: natural.short }
        : null;

    // Press-and-hold opens the word; a tap (the click that follows a short
    // press) the ayah. Moving away (a scroll, a swipe) cancels the hold.
    // The words' events are handled once, on the page (`data-word` names the
    // word): a page has some 1,500 words, and eight handlers on each made every
    // page mount slower.
    const hold = useRef<{ timer: number; x: number; y: number; el: Element } | null>(
      null,
    );
    const held = useRef(false);
    const cancelHold = () => {
      if (hold.current) clearTimeout(hold.current.timer);
      hold.current = null;
    };
    useEffect(() => cancelHold, []);
    const wordAtEvent = (e: SyntheticEvent<HTMLElement>) => {
      const el = (e.target as Element).closest?.<HTMLElement>("[data-word]");
      if (!el || !e.currentTarget.contains(el)) return null;
      const [id, w] = el.dataset.word!.split(":").map(Number);
      return { el, id, w, text: el.querySelector("[data-ayah]") ?? el };
    };
    const words$ = {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        held.current = false;
        cancelHold();
        const at = wordAtEvent(e);
        if (!at || (e.pointerType === "mouse" && e.button !== 0)) return;
        hold.current = {
          x: e.clientX,
          y: e.clientY,
          el: at.el,
          timer: window.setTimeout(() => {
            hold.current = null;
            held.current = true;
            onWord(at.id, at.w - 1, at.text);
          }, HOLD_MS),
        };
      },
      // Moving away (a scroll, a swipe, onto another word) cancels the hold.
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const h = hold.current;
        if (!h) return;
        if (Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP) cancelHold();
        else if (wordAtEvent(e)?.el !== h.el) cancelHold();
      },
      onPointerUp: cancelHold,
      onPointerCancel: cancelHold,
      onPointerLeave: cancelHold,
      onContextMenu: (e: MouseEvent<HTMLElement>) => {
        if (wordAtEvent(e)) e.preventDefault();
      },
      onClick: (e: MouseEvent<HTMLElement>) => {
        const at = wordAtEvent(e);
        if (!at) return;
        // The click that ends a hold already opened the word.
        if (held.current) {
          held.current = false;
          return;
        }
        onAyah(at.id, rectOf(at.text));
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        const at = wordAtEvent(e);
        if (!at) return;
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          onWord(at.id, at.w - 1, at.el);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAyah(at.id, rectOf(at.el));
        }
      },
    };
    const first = verses[ids[0] - 1];
    const names = [...new Set(ids.map((id) => verses[id - 1]?.s))]
      .map((s) => surahMap.get(s)?.name)
      .filter(Boolean);
    const lineH = glosses ? "2.9em" : "2.05em";

    return (
      <figure
        aria-label={t.reader.page(page)}
        className="relative mx-auto my-4 max-w-[40rem] rounded-xl border border-line bg-surface px-3 pb-2 pt-2 shadow-soft sm:px-6"
      >
        <PageSpine page={page} />
        <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-line/70 pb-1.5 text-xs text-ink-subtle">
          <span className="tabular-nums">
            {first && `${t.scope.juz} ${first.juz} · ${t.scope.hizb} ${first.hizb}`}
          </span>
          <span className="truncate">{names.join(" · ")}</span>
        </div>
        <div
          ref={box}
          {...words$}
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
          {full &&
            lines.map((l, i) => {
              // Still to come (a page drawn in steps): a placeholder of its height.
              if (i >= shown)
                return (
                  <div
                    key={i}
                    style={{
                      height:
                        l.kind === "name" && l.basmala ? `calc(2 * ${lineH})` : lineH,
                    }}
                  />
                );
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
                    <div
                      className="text-center"
                      style={{ height: lineH, lineHeight: lineH }}
                    >
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
              // Colours, not classes: with meanings under the words the band
              // covers only the Arabic (a gradient sized to its line).
              const band = l.words.map(({ id }) =>
                selectedId === id
                  ? "rgb(var(--illumination) / 0.15)"
                  : playingId === id
                    ? "rgb(var(--rubric) / 0.1)"
                    : audioRange && id >= audioRange.from && id <= audioRange.to
                      ? "rgb(var(--illumination) / 0.1)"
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
                    const [show, hide] = maskedParts(
                      mask,
                      id,
                      w - 1,
                      aw?.text[w - 1] ?? "",
                    );
                    // The word's own highlight, on its Arabic only.
                    const own = lit
                      ? "rounded-sm bg-illumination/25"
                      : picked
                        ? "rounded-sm bg-illumination/20 ring-1 ring-illumination/60"
                        : runEnd && (runStart ? "rounded-sm" : "rounded-e-sm");
                    const ownBg = !lit && !picked && runEnd ? b : "";
                    const text = (
                      <>
                        {hide ? (
                          <MaskedWord show={show} hide={hide} />
                        ) : aw?.segs?.[w - 1] ? (
                          // Inline, not a component per word: one theme read per page.
                          aw.segs[w - 1].map((seg, j) =>
                            seg.rule ? (
                              <span
                                key={j}
                                style={{ color: tajweedColor(seg.rule, dark) }}
                              >
                                {seg.text}
                              </span>
                            ) : (
                              <Fragment key={j}>{seg.text}</Fragment>
                            ),
                          )
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
                        data-word={`${id}:${w}`}
                        className={cx(
                          "flex shrink-0 cursor-pointer select-none transition-colors [-webkit-touch-callout:none] motion-reduce:transition-none",
                          // Grow into the gap after the word (spread lines), or a
                          // fixed gap (centred lines); either way it is the word's.
                          !lineEnd && (centred ? "pe-[0.25em]" : "grow"),
                          !inScope(id) && "opacity-40",
                          runStart && !runEnd && "rounded-s-sm",
                        )}
                        style={
                          !b || runEnd
                            ? undefined
                            : glosses
                              ? {
                                  background: `linear-gradient(${b}, ${b}) top / 100% ${ARABIC_LINE} no-repeat`,
                                }
                              : { backgroundColor: b }
                        }
                      >
                        <span
                          data-ayah={id}
                          className={cx(
                            "transition-colors motion-reduce:transition-none",
                            glosses && "flex flex-col items-center",
                            !hide && mask?.stumbled(id, w - 1) && STUMBLED,
                            !glosses && own,
                          )}
                          style={
                            !glosses && ownBg ? { backgroundColor: ownBg } : undefined
                          }
                        >
                          {glosses ? (
                            <>
                              <span
                                className={cx(
                                  "transition-colors motion-reduce:transition-none",
                                  own,
                                )}
                                style={{
                                  lineHeight: ARABIC_LINE,
                                  backgroundColor: ownBg || undefined,
                                }}
                              >
                                {text}
                              </span>
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
  },
  // `deferred` changes as the list scrolls; it only counts at mount, and
  // re-rendering a whole page (some 1,500 words) for it made scroll frames long.
  (a, b) =>
    (Object.keys(a) as (keyof typeof a)[]).every(
      (k) => k === "deferred" || a[k] === b[k],
    ),
);
