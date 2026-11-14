import { Fragment, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { splitAt, type Range } from "../../data/textSearch";
import { alignTajweedToWords, type TajweedSegment } from "../../data/tajweed";
import { splitWords } from "../../data/mushafLayout";
import { wordAt } from "../../data/wordTimings";
import type { PlayClock } from "../../data/useRecitation";
import { useI18n } from "../../i18n/I18nContext";
import { cx } from "../ui";
import { TajweedSegs } from "./AyahText";
import { withRubrics } from "./rubrics";

/** Search hits in one piece of text; `current` is the index of the hit the
 *  learner stepped to, if it is in this text. */
export interface Hits {
  ranges: Range[];
  current: number;
}

const HIT = "rounded-sm bg-illumination/20 text-ink";
const HIT_NOW = "rounded-sm bg-illumination text-white dark:text-paper";

/** Text with its search hits marked. */
export function HighlightText({ text, hits }: { text: string; hits?: Hits | null }) {
  if (!hits?.ranges.length) return <>{text}</>;
  return (
    <>
      {splitAt(text, hits.ranges).map(([piece, i], k) =>
        i < 0 ? (
          <Fragment key={k}>{piece}</Fragment>
        ) : (
          <mark
            key={k}
            data-match-current={i === hits.current || undefined}
            className={i === hits.current ? HIT_NOW : HIT}
          >
            {piece}
          </mark>
        ),
      )}
    </>
  );
}

/** A translation with its footnote markers (numbered buttons; a pressed one
 *  shows its note under the text) and search hits. */
export function TranslationText({
  text,
  notes,
  hits,
}: {
  text: string;
  notes?: [number, string][];
  hits?: Hits | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  if (!notes?.length) return <HighlightText text={text} hits={hits} />;
  const parts: ReactNode[] = [];
  let at = 0;
  notes.forEach(([off, _note], n) => {
    const cut = Math.min(Math.max(off, at), text.length);
    parts.push(
      <HighlightText
        key={`t${n}`}
        text={text.slice(at, cut)}
        hits={shiftHits(hits, at, cut)}
      />,
    );
    parts.push(
      <button
        key={`n${n}`}
        type="button"
        onClick={() => setOpen(open === n ? null : n)}
        aria-expanded={open === n}
        aria-label={t.reader.footnote(n + 1)}
        className={cx(
          "ml-px inline-block -translate-y-[0.45em] rounded-sm px-[0.2em] align-baseline font-ui text-[0.68em] font-semibold leading-none",
          open === n ? "bg-illumination text-white dark:text-paper" : "text-illumination",
        )}
      >
        {n + 1}
      </button>,
    );
    at = cut;
  });
  parts.push(
    <HighlightText
      key="end"
      text={text.slice(at)}
      hits={shiftHits(hits, at, text.length)}
    />,
  );
  return (
    <>
      {parts}
      {open !== null && notes[open] && (
        <span className="mt-1.5 block rounded-md border-l-2 border-illumination bg-surface-sunken px-2.5 py-1.5 text-[0.875em] text-ink-muted dark:bg-surface">
          <span className="mr-1 font-semibold text-illumination">{open + 1}</span>
          {notes[open][1]}
        </span>
      )}
    </>
  );
}

/** Hits that fall inside text[from, to), moved to start at 0. */
function shiftHits(hits: Hits | null | undefined, from: number, to: number): Hits | null {
  if (!hits) return null;
  const ranges: Range[] = [];
  let current = -1;
  hits.ranges.forEach(([a, b], i) => {
    if (b <= from || a >= to) return;
    if (i === hits.current) current = ranges.length;
    ranges.push([Math.max(a, from) - from, Math.min(b, to) - from]);
  });
  return ranges.length ? { ranges, current } : null;
}

const IDLE_TIME = { id: null, t: 0, rev: 0 };
const idleClock: PlayClock = { subscribe: () => () => {}, get: () => IDLE_TIME };

/** An ayah's Arabic as words: each one tappable (`onWord`, for its popup),
 *  the words being recited lit up (word timings, read from `clock` so only
 *  this row re-renders as it plays), and with `gloss` each word's meaning
 *  under it (word by word). */
export function AyahWords({
  id,
  ar,
  tajweed,
  clock,
  timing,
  onWord,
  gloss,
  glossLang,
  end,
}: {
  id: number;
  ar: string;
  tajweed?: string | null;
  clock?: PlayClock;
  timing?: number[];
  onWord?: (id: number, w: number, el: Element) => void;
  gloss?: (w: number) => string;
  glossLang?: string;
  end: ReactNode;
}) {
  const c = clock ?? idleClock;
  const time = useSyncExternalStore(c.subscribe, c.get);
  const on = clock && time.id === id ? wordAt(timing, time.t * 1000) : null;
  const words = useMemo(() => splitWords(ar), [ar]);
  const segs = useMemo<TajweedSegment[][] | null>(
    () => (tajweed ? alignTajweedToWords(tajweed, words) : null),
    [tajweed, words],
  );
  const word = (w: string, i: number, extra?: string) => (
    <span
      role={onWord ? "button" : undefined}
      tabIndex={onWord ? -1 : undefined}
      onClick={onWord ? (e) => onWord(id, i, e.currentTarget) : undefined}
      className={cx(
        "rounded-sm transition-colors duration-150 motion-reduce:transition-none",
        onWord && "cursor-pointer",
        on && i >= on[0] && i < on[1] && "bg-illumination/20",
        extra,
      )}
    >
      {segs?.[i] ? <TajweedSegs segs={segs[i]} /> : withRubrics(w)}
    </span>
  );
  if (gloss)
    return (
      <div lang="ar" dir="rtl" className="flex flex-wrap items-start gap-x-5 gap-y-2">
        {words.map((w, i) => (
          <span key={i} className="flex flex-col items-center">
            {word(w, i, "quran-text leading-tight text-ink")}
            <span
              lang={glossLang}
              dir="ltr"
              className="mt-0.5 max-w-[9rem] text-center text-xs leading-tight text-ink-subtle"
            >
              {gloss(i)}
            </span>
          </span>
        ))}
        <span className="quran-text leading-tight">{end}</span>
      </div>
    );
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          {word(w, i)}
        </Fragment>
      ))}
      {end}
    </>
  );
}
