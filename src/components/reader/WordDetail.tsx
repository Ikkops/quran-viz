import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BookOpen, Play, X } from "lucide-react";
import type { Surah, Verse } from "../../types/quran";
import { splitWords } from "../../data/mushafLayout";
import {
  describeTags,
  glossOf,
  lemmasOfRoot,
  occurrencesOf,
  useLexicon,
  useLexiconOcc,
  type WordInfo,
} from "../../data/words";
import type { GlossLang } from "../../data/useWordByWord";
import { useI18n } from "../../i18n/I18nContext";
import { useDismiss } from "../../lib/useDismiss";
import { cx } from "../ui";
import { popupRoot, rootZoom } from "../ui/popup";
import type { ExploreTarget } from "./VerseContextPanel";
import type { ReaderTarget } from "../charts/common";
import type { WordPick } from "./wordPick";

const ARABIC = { fontFamily: "var(--font-arabic, 'Amiri Quran', serif)" };

/** The small card by a tapped word: the word, its transliteration and
 *  meaning, the root, and "Click for more" (the word details page). */
export function WordPopover({
  pick,
  verse,
  info,
  loading,
  glossLang,
  canPlay,
  onMore,
  onPlay,
  onContext,
  onClose,
}: {
  pick: WordPick;
  verse: Verse;
  info: WordInfo | undefined;
  loading: boolean;
  glossLang: GlossLang;
  canPlay: boolean;
  onMore: () => void;
  onPlay: () => void;
  onContext: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, true, onClose);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const lex = useLexicon(!!info?.[5]);
  const root = info?.[5] ? lex.data?.roots[info[5] - 1] : undefined;
  const word = splitWords(verse.ar)[pick.w] ?? "";

  // Under the word, or above it when there is no room; inside the screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const z = rootZoom(popupRoot());
    const vw = window.innerWidth / z;
    const vh = (window.visualViewport?.height ?? window.innerHeight) / z;
    const w = Math.min(320, vw - 24);
    const h = el.offsetHeight;
    const mid = (pick.rect.left + pick.rect.right) / 2 / z;
    const left = Math.min(Math.max(12, mid - w / 2), vw - 12 - w);
    const below = pick.rect.bottom / z + 6;
    const top = below + h + 12 > vh ? Math.max(12, pick.rect.top / z - 6 - h) : below;
    setStyle({ position: "fixed", left, top, width: w });
  }, [pick, info, loading, root]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={t.word.title}
      style={style}
      className="z-50 rounded-xl border border-line bg-surface p-3 text-ink shadow-lg"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p
            lang="ar"
            dir="rtl"
            className="text-right text-3xl leading-snug"
            style={ARABIC}
          >
            {word}
          </p>
          {info ? (
            <>
              <p className="mt-1 font-reading text-sm italic text-ink-muted">{info[0]}</p>
              <p className="mt-0.5 text-base font-semibold">{glossOf(info, glossLang)}</p>
              {root && (
                <p className="mt-1 text-xs text-ink-subtle">
                  {t.word.root}:{" "}
                  <span lang="ar" dir="rtl" className="text-sm text-ink" style={ARABIC}>
                    {root[0].split("").join(" ")}
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-subtle">
              {loading ? t.word.loading : t.word.unavailable}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="-mr-1 -mt-1 rounded-md p-1.5 text-ink-subtle hover:bg-surface-sunken touch:min-h-11 touch:min-w-11"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-line pt-2">
        {info && (
          <button
            type="button"
            onClick={onMore}
            className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-illumination hover:bg-surface-sunken touch:min-h-11"
          >
            {t.word.more}
            <ArrowRight size={14} aria-hidden />
          </button>
        )}
        <span className="flex-1" />
        {canPlay && (
          <button
            type="button"
            onClick={onPlay}
            aria-label={t.word.playAyah}
            title={t.word.playAyah}
            className="rounded-md p-2 text-ink-muted hover:bg-surface-sunken touch:min-h-11 touch:min-w-11"
          >
            <Play size={16} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onContext}
          aria-label={t.word.ayahContext}
          title={t.word.ayahContext}
          className="rounded-md p-2 text-ink-muted hover:bg-surface-sunken touch:min-h-11 touch:min-w-11"
        >
          <BookOpen size={16} aria-hidden />
        </button>
      </div>
    </div>,
    popupRoot(),
  );
}

const OCC_PAGE = 20;

/** The word details page (in a sheet): meanings, grammar, lemma and root,
 *  the other words from the root, and every place the word occurs. */
export function WordDetailPage({
  verse,
  w,
  info,
  verses,
  surahMap,
  onRead,
  onExplore,
}: {
  verse: Verse;
  w: number;
  info: WordInfo;
  verses: Verse[];
  surahMap: Map<number, Surah>;
  onRead: (target: ReaderTarget) => void;
  onExplore?: (x: ExploreTarget) => void;
}) {
  const i18n = useI18n();
  const { t, n } = i18n;
  const [translit, en, id, tags, lemma, root] = info;
  const lex = useLexicon(true);
  const occState = useLexiconOcc(lemma > 0);
  const [shown, setShown] = useState(OCC_PAGE);
  const word = splitWords(verse.ar)[w] ?? "";
  const { pos, features } = describeTags(tags, t.word);
  const L = lex.data;
  const lem = L && lemma ? L.lemmas[lemma - 1] : undefined;
  const rt = L && root ? L.roots[root - 1] : undefined;
  const family = useMemo(() => (L && root ? lemmasOfRoot(L, root) : []), [L, root]);
  const occ = useMemo(
    () => (occState.data && lemma ? occurrencesOf(occState.data, lemma) : []),
    [occState.data, lemma],
  );
  const ref = (vid: number) => {
    const v = verses[vid - 1];
    return v ? `${v.s}:${v.a}` : "";
  };

  return (
    <div className="space-y-5 pb-4">
      <header className="text-center">
        <p lang="ar" dir="rtl" className="text-5xl leading-normal" style={ARABIC}>
          {word}
        </p>
        <p className="font-reading text-lg italic text-ink-muted">{translit}</p>
        <p className="mt-1 text-xs text-ink-subtle">
          {surahMap.get(verse.s)?.name} · {t.word.at(`${verse.s}:${verse.a}`, w + 1)}
        </p>
      </header>

      <Section title={t.word.meaning}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-subtle">{t.word.meaningId}</dt>
          <dd className="font-medium">{id || "—"}</dd>
          <dt className="text-ink-subtle">{t.word.meaningEn}</dt>
          <dd className="font-medium">{en || "—"}</dd>
        </dl>
      </Section>

      {(pos || features.length > 0) && (
        <Section title={t.word.grammar}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {pos && (
              <>
                <dt className="text-ink-subtle">{t.word.partOfSpeech}</dt>
                <dd className="font-medium">{pos}</dd>
              </>
            )}
            {features.length > 0 && (
              <>
                <dt className="text-ink-subtle">{t.word.form}</dt>
                <dd>{features.join(" · ")}</dd>
              </>
            )}
            {lem && (
              <>
                <dt className="text-ink-subtle">{t.word.lemma}</dt>
                <dd>
                  <span lang="ar" dir="rtl" className="text-xl" style={ARABIC}>
                    {lem[0]}
                  </span>{" "}
                  <span className="text-xs text-ink-subtle">
                    {t.word.lemmaCount(n(lem[2]))}
                  </span>
                </dd>
              </>
            )}
          </dl>
        </Section>
      )}

      {rt && (
        <Section title={t.word.root}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span lang="ar" dir="rtl" className="text-3xl" style={ARABIC}>
              {rt[0].split("").join(" ")}
            </span>
            <span className="text-sm text-ink-muted">{t.word.rootCount(n(rt[2]))}</span>
            {onExplore && (
              <button
                type="button"
                onClick={() => onExplore({ kind: "root", key: rt[1] })}
                className="inline-flex items-center gap-1 text-sm text-illumination hover:underline touch:min-h-11"
              >
                {t.word.openExplorer}
                <ArrowRight size={14} aria-hidden />
              </button>
            )}
          </div>
          {family.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-subtle">
                {t.word.fromRoot}
              </p>
              <ul className="mt-1 divide-y divide-line rounded-lg border border-line">
                {family.map((li) => {
                  const l = L!.lemmas[li - 1];
                  return (
                    <li
                      key={li}
                      className={cx(
                        "flex items-center gap-3 px-3 py-1.5",
                        li === lemma && "bg-illumination/10",
                      )}
                    >
                      <span
                        lang="ar"
                        dir="rtl"
                        className="min-w-[4.5rem] text-xl"
                        style={ARABIC}
                      >
                        {l[0]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {i18n.lang === "id" ? l[4] || l[3] : l[3] || l[4]}
                      </span>
                      <span className="text-xs tabular-nums text-ink-subtle">
                        {n(l[2])}×
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>
      )}

      {lemma > 0 && occ.length > 0 && (
        <Section title={t.word.occurrences(n(occ.length))}>
          <ul className="space-y-2">
            {occ.slice(0, shown).map(([vid, wi]) => {
              const v = verses[vid - 1];
              if (!v) return null;
              const ws = splitWords(v.ar);
              const from = Math.max(0, wi - 3);
              const to = Math.min(ws.length, wi + 4);
              const here = vid === verse.id && wi === w;
              return (
                <li key={`${vid}:${wi}`}>
                  <button
                    type="button"
                    onClick={() => onRead({ scope: "surah", value: v.s, anchor: vid })}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2 text-left hover:bg-surface-sunken",
                      here && "border-illumination",
                    )}
                  >
                    <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
                      {ref(vid)}
                    </span>
                    <span
                      lang="ar"
                      dir="rtl"
                      className="min-w-0 flex-1 truncate text-right text-lg"
                      style={ARABIC}
                    >
                      {from > 0 && "… "}
                      {ws.slice(from, to).map((x, k) => (
                        <span
                          key={k}
                          className={
                            from + k === wi ? "rounded-sm bg-illumination/20" : undefined
                          }
                        >
                          {k > 0 && " "}
                          {x}
                        </span>
                      ))}
                      {to < ws.length && " …"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {occ.length > shown && (
            <button
              type="button"
              onClick={() => setShown((s) => s + OCC_PAGE * 2)}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink-muted hover:bg-surface-sunken touch:min-h-11"
            >
              {t.word.showMore(n(Math.min(OCC_PAGE * 2, occ.length - shown)))}
            </button>
          )}
        </Section>
      )}

      <p className="text-xs text-ink-subtle">{t.word.source}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        {title}
      </h3>
      {children}
    </section>
  );
}
