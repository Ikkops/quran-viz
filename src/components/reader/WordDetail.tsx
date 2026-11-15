import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
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
import { Button, cx } from "../ui";
import type { ExploreTarget } from "./VerseContextPanel";
import type { ReaderTarget } from "../charts/common";
import type { WordPick } from "./wordPick";
import { PopoverActions, PopoverCard, PopoverClose } from "./PopoverCard";

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
  const lex = useLexicon(!!info?.[5]);
  const root = info?.[5] ? lex.data?.roots[info[5] - 1] : undefined;
  const word = splitWords(verse.ar)[pick.w] ?? "";

  return (
    <PopoverCard rect={pick.rect} label={t.word.title} onClose={onClose}>
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
              <p className="mt-1.5 font-reading text-sm italic text-ink-muted">
                {info[0]}
              </p>
              <p className="mt-0.5 text-base font-semibold">{glossOf(info, glossLang)}</p>
              {root && (
                <p className="mt-1.5 text-xs text-ink-subtle">
                  {t.word.root}:{" "}
                  <span lang="ar" dir="rtl" className="text-sm text-ink" style={ARABIC}>
                    {root[0].split("").join(" ")}
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="mt-1.5 text-sm text-ink-subtle">
              {loading ? t.word.loading : t.word.unavailable}
            </p>
          )}
        </div>
        <PopoverClose onClose={onClose} />
      </div>
      <PopoverActions canPlay={canPlay} onPlay={onPlay} onContext={onContext}>
        {info && (
          <button
            type="button"
            onClick={onMore}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-illumination transition-colors hover:bg-surface-sunken touch:min-h-11"
          >
            {t.word.more}
            <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </PopoverActions>
    </PopoverCard>
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
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-6 pt-4">
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
        <dl className={DL}>
          <dt className="text-ink-subtle">{t.word.meaningId}</dt>
          <dd className="font-medium">{id || "—"}</dd>
          <dt className="text-ink-subtle">{t.word.meaningEn}</dt>
          <dd className="font-medium">{en || "—"}</dd>
        </dl>
      </Section>

      {(pos || features.length > 0) && (
        <Section title={t.word.grammar}>
          <dl className={DL}>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span lang="ar" dir="rtl" className="text-3xl leading-normal" style={ARABIC}>
              {rt[0].split("").join(" ")}
            </span>
            <span className="text-sm text-ink-muted">{t.word.rootCount(n(rt[2]))}</span>
            {onExplore && (
              <button
                type="button"
                onClick={() => onExplore({ kind: "root", key: rt[1] })}
                className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-illumination transition-colors hover:bg-surface-sunken touch:min-h-11"
              >
                {t.word.openExplorer}
                <ArrowRight size={14} aria-hidden />
              </button>
            )}
          </div>
          {family.length > 0 && (
            <>
              <h4 className={cx(HEADING, "mt-4")}>{t.word.fromRoot}</h4>
              <ul className={LIST}>
                {family.map((li) => {
                  const l = L!.lemmas[li - 1];
                  return (
                    <li
                      key={li}
                      className={cx(ROW, li === lemma && "bg-illumination/10")}
                    >
                      <span
                        lang="ar"
                        dir="rtl"
                        className="w-20 shrink-0 truncate text-right text-xl"
                        style={ARABIC}
                      >
                        {l[0]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {i18n.lang === "id" ? l[4] || l[3] : l[3] || l[4]}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
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
          <ul className={LIST}>
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
                    aria-current={here || undefined}
                    className={cx(
                      ROW,
                      "w-full text-left transition-colors hover:bg-surface-sunken",
                      here && "bg-illumination/10",
                    )}
                  >
                    <span className="w-14 shrink-0 text-xs tabular-nums text-ink-subtle">
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
            <Button
              onClick={() => setShown((s) => s + OCC_PAGE * 2)}
              className="mt-3 w-full"
            >
              {t.word.showMore(n(Math.min(OCC_PAGE * 2, occ.length - shown)))}
            </Button>
          )}
        </Section>
      )}

      <p className="border-t border-line pt-3 text-xs text-ink-subtle">{t.word.source}</p>
    </div>
  );
}

/** Section headings, the definition lists and the list rows of the page. */
const HEADING = "mb-2 text-eyebrow text-ink-subtle";
const DL =
  "grid grid-cols-[minmax(6.5rem,auto)_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm";
const LIST = "divide-y divide-line border-y border-line";
const ROW = "flex min-h-11 items-center gap-3 px-2 py-1";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={HEADING}>{title}</h3>
      {children}
    </section>
  );
}
