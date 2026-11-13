import { useMemo, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Surah, Verse } from "../../types/quran";
import type { ReaderTarget } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";
import { useTranslation } from "../../data/useTranslation";
import { useGroupedTafsir } from "../../data/useGroupedTafsir";
import { useWordByWord, type GlossLang } from "../../data/useWordByWord";
import { useAsbab } from "../../data/useAsbab";
import { useSimilar } from "../../data/useSimilar";
import { useRoots } from "../../data/useRoots";
import { useTopics } from "../../data/useTopics";
import { tafsirGroupLookup } from "../../data/sections";
import { TAFSIR_EDITIONS, tafsirById } from "../../data/editions";
import { buildTopicTree, topicName, topicPath } from "../../data/topics";
import {
  asbabCovering,
  rootsInAyah,
  similarTo,
  topicsForAyah,
} from "../../data/ayahContext";
import type { LazyJsonState } from "../../data/useLazyJson";
import { Badge, SegmentedControl } from "../ui";
import { AyahText } from "./AyahText";
import { CONTEXT_TABS, type ContextTab } from "./readerShared";

export type ExploreTarget =
  | { kind: "root"; key: string }
  | { kind: "topic"; key: string };

const selCls = "rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";

function Note({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <p
      className={error ? "text-sm text-rubric" : "text-sm text-ink-subtle"}
      role={error ? "alert" : undefined}
    >
      {children}
    </p>
  );
}

/** Loading / error line for a lazily loaded file, or null once it is there. */
function useLoadNote<T>(s: LazyJsonState<T>): ReactNode {
  const { t } = useI18n();
  if (s.error)
    return (
      <div className="flex items-center gap-3">
        <Note error>{t.common.failedToLoad(s.error)}</Note>
        {s.retry && (
          <button
            type="button"
            onClick={s.retry}
            className="rounded-md border border-line px-2 py-1 text-sm text-ink-muted hover:bg-surface-sunken"
          >
            {t.common.retry}
          </button>
        )}
      </div>
    );
  if (!s.data) return <Note>{t.common.loading}</Note>;
  return null;
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-ink">{children}</h3>;
}

/**
 * "Konteks ayat": what surrounds one ayah — its tafsir, its words, why it was
 * revealed, the ayahs that resemble it, and its roots and topics. Docked beside
 * the text on wide layouts, in a sheet otherwise. Each tab loads its own file
 * only when shown.
 */
export function VerseContextPanel({
  verse,
  verses,
  surahMap,
  tab,
  onTab,
  tafsirEdition,
  onTafsirEdition,
  glossLang,
  onGlossLang,
  verseColor,
  onRead,
  onExplore,
  showHeader = true,
}: {
  verse: Verse;
  verses: Verse[];
  surahMap: Map<number, Surah>;
  tab: ContextTab;
  onTab: (t: ContextTab) => void;
  tafsirEdition: string;
  onTafsirEdition: (id: string) => void;
  glossLang: GlossLang;
  onGlossLang: (l: GlossLang) => void;
  verseColor: (v: Verse) => string;
  onRead: (t: ReaderTarget) => void;
  onExplore: (t: ExploreTarget) => void;
  /** Ayah text and reference on top (off when the sheet title shows them). */
  showHeader?: boolean;
}) {
  const i18n = useI18n();
  const { t, n, lang } = i18n;
  const s = surahMap.get(verse.s);
  const ref = `${verse.s}:${verse.a}`;

  // Tafsir
  const ed = tafsirById(tafsirEdition);
  const ayahTafsir = useTranslation(
    tab === "tafsir" && ed.kind === "ayah" ? ed.id : null,
  );
  const surahIds = useMemo(() => [verse.s], [verse.s]);
  const grouped = useGroupedTafsir(
    tab === "tafsir" && ed.kind === "grouped" ? ed.id : null,
    surahIds,
  );
  const group = useMemo(
    () => (grouped.data ? tafsirGroupLookup([verse], grouped.data).get(verse.id) : null),
    [grouped.data, verse],
  );

  const words = useWordByWord(tab === "words", glossLang);
  const asbab = useAsbab(tab === "asbab");
  const similar = useSimilar(tab === "similar");
  const roots = useRoots(tab === "roots");
  const topics = useTopics(tab === "roots");
  const topicTree = useMemo(
    () => (topics.data ? buildTopicTree(topics.data) : null),
    [topics.data],
  );

  const wordsNote = useLoadNote(words);
  const asbabNote = useLoadNote(asbab);
  const similarNote = useLoadNote(similar);
  const rootsNote = useLoadNote(roots);
  const topicsNote = useLoadNote(topics);

  const tabs = CONTEXT_TABS.map((k) => ({ value: k, label: t.reader.contextTabs[k] }));

  let body: ReactNode;
  if (tab === "tafsir") {
    const loading = ed.kind === "ayah" ? ayahTafsir.loading : grouped.loading;
    const error = ed.kind === "ayah" ? ayahTafsir.error : grouped.error;
    const text = ed.kind === "ayah" ? ayahTafsir.data?.[verse.id] : group?.text;
    body = (
      <>
        <label className="mb-3 flex flex-col gap-1 text-sm text-ink-muted">
          {t.reader.tafsirSource}
          <select
            className={selCls}
            value={tafsirEdition}
            onChange={(e) => onTafsirEdition(e.target.value)}
          >
            {TAFSIR_EDITIONS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        {error ? (
          <Note error>{t.common.failedToLoad(error)}</Note>
        ) : loading ? (
          <Note>{t.common.loading}</Note>
        ) : !text ? (
          <Note>{t.reader.noTafsir}</Note>
        ) : (
          <>
            {group && group.from !== group.to && (
              <p className="mb-1 text-xs font-medium text-ink-subtle">
                {t.reader.versesRange(`${group.s}:${group.from}–${group.to}`)}
              </p>
            )}
            <p
              lang={ed.lang}
              dir={ed.lang === "ar" ? "rtl" : "ltr"}
              className={
                ed.lang === "ar"
                  ? "whitespace-pre-line font-arabic text-lg leading-loose text-ink"
                  : "whitespace-pre-line font-reading leading-relaxed text-ink"
              }
            >
              {text}
            </p>
            <p className="mt-2 text-xs text-ink-subtle">{ed.source}.</p>
          </>
        )}
      </>
    );
  } else if (tab === "words") {
    const ws = words.data?.[verse.id];
    body = (
      <>
        <label className="mb-3 flex flex-col gap-1 text-sm text-ink-muted">
          {t.reader.glossLang}
          <select
            className={selCls}
            value={glossLang}
            onChange={(e) => onGlossLang(e.target.value as GlossLang)}
          >
            <option value="en">{t.reader.glossEn}</option>
            <option value="id">{t.reader.glossId}</option>
          </select>
        </label>
        {wordsNote ??
          (!ws ? (
            <Note>{t.reader.noWords}</Note>
          ) : (
            <ol className="divide-y divide-line">
              {ws.map(([ar, gloss], i) => (
                <li key={i} className="flex items-baseline gap-3 py-1.5">
                  <span className="w-6 shrink-0 text-xs tabular-nums text-ink-subtle">
                    {i + 1}
                  </span>
                  <span
                    lang={glossLang}
                    className="min-w-0 flex-1 text-sm text-ink-muted"
                  >
                    {gloss}
                  </span>
                  <span lang="ar" dir="rtl" className="font-arabic text-xl text-ink">
                    {ar}
                  </span>
                </li>
              ))}
            </ol>
          ))}
      </>
    );
  } else if (tab === "asbab") {
    const entries = asbab.data ? asbabCovering(asbab.data, verse.id) : [];
    body =
      asbabNote ??
      (entries.length === 0 ? (
        <Note>{t.reader.noAsbab}</Note>
      ) : (
        <>
          {entries.map((e) => {
            const first = verses[e.first - 1];
            const last = verses[e.last - 1];
            return (
              <div key={`${e.first}-${e.last}`} className="mb-4">
                {e.first !== e.last && first && last && (
                  <p className="mb-1 text-xs text-ink-subtle">
                    {t.reader.versesRange(`${first.s}:${first.a}–${last.a}`)}
                  </p>
                )}
                {e.texts.map((txt, i) => (
                  <p
                    key={i}
                    lang="ar"
                    dir="rtl"
                    className="mb-2 whitespace-pre-line font-arabic text-lg leading-loose text-ink"
                  >
                    {txt}
                  </p>
                ))}
              </div>
            );
          })}
          <p className="text-xs text-ink-subtle">
            {t.reader.arabicOnly} {asbab.data?.source}.
          </p>
        </>
      ));
  } else if (tab === "similar") {
    const list = similar.data ? similarTo(similar.data, verse.id).slice(0, 40) : [];
    body =
      similarNote ??
      (list.length === 0 ? (
        <Note>{t.reader.noSimilar}</Note>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {list.map((x) => {
              const v = verses[x.id - 1];
              if (!v) return null;
              const vs = surahMap.get(v.s);
              const r = `${v.s}:${v.a}`;
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => onRead({ scope: "surah", value: v.s, anchor: v.id })}
                    aria-label={t.reader.readAyah(r)}
                    className="w-full rounded-lg px-2 py-2 text-left hover:bg-surface-sunken"
                  >
                    <span className="flex items-center gap-2">
                      <Badge color={verseColor(v)} className="tabular-nums">
                        {r}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {vs?.nameEn}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
                        {t.reader.similarScore(x.score, x.words)}
                      </span>
                    </span>
                    <span
                      lang="ar"
                      dir="rtl"
                      className="mt-1 block font-arabic text-lg leading-loose text-ink"
                    >
                      <AyahText v={v} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-ink-subtle">{t.reader.similarSource}</p>
        </>
      ));
  } else {
    const rs = roots.data ? rootsInAyah(roots.data, verse.id) : [];
    const ts = topicTree ? topicsForAyah(topicTree, verse.id) : [];
    const exploreCls =
      "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-sunken";
    body = (
      <>
        <section className="mb-5">
          <Heading>{t.reader.rootsHere}</Heading>
          {rootsNote ??
            (rs.length === 0 ? (
              <Note>{t.reader.noRoots}</Note>
            ) : (
              <ul className="flex flex-col">
                {rs.map((r) => (
                  <li key={r.root.bw}>
                    <button
                      type="button"
                      className={exploreCls}
                      onClick={() => onExplore({ kind: "root", key: r.root.bw })}
                      aria-label={t.reader.openRoot(r.root.ar)}
                    >
                      <span
                        lang="ar"
                        dir="rtl"
                        className="w-14 shrink-0 text-right font-arabic text-xl text-ink"
                      >
                        {r.root.ar}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">
                          {r.root.gloss.replace(/[,;]\s*$/, "")}
                        </span>
                        <span className="block text-xs tabular-nums text-ink-subtle">
                          {t.reader.rootTotal(n(r.total))}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={15}
                        className="shrink-0 text-ink-subtle"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </section>
        <section>
          <Heading>{t.reader.topicsHere}</Heading>
          {topicsNote ??
            (ts.length === 0 || !topicTree ? (
              <Note>{t.reader.noTopics}</Note>
            ) : (
              <ul className="flex flex-col">
                {ts.map((i) => {
                  const path = topicPath(topicTree, i);
                  const name = topicName(topicTree.nodes[i], lang);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={exploreCls}
                        onClick={() =>
                          onExplore({ kind: "topic", key: topicTree.nodes[i].k })
                        }
                        aria-label={t.reader.openTopic(name)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink">{name}</span>
                          {path.length > 1 && (
                            <span className="block truncate text-xs text-ink-subtle">
                              {path
                                .slice(0, -1)
                                .map((p) => topicName(topicTree.nodes[p], lang))
                                .join(" › ")}
                            </span>
                          )}
                        </span>
                        <ArrowUpRight
                          size={15}
                          className="shrink-0 text-ink-subtle"
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ))}
        </section>
      </>
    );
  }

  return (
    <div className="flex flex-col">
      {showHeader && (
        <div className="border-b border-line px-4 pb-3 pt-3">
          <p className="flex items-center gap-2 text-sm">
            <Badge color={verseColor(verse)} className="tabular-nums">
              {ref}
            </Badge>
            <span className="truncate font-semibold text-ink">{s?.nameEn}</span>
          </p>
          <p
            lang="ar"
            dir="rtl"
            className="mt-2 max-h-40 overflow-y-auto font-arabic leading-loose text-ink"
            style={{ fontSize: "calc(1.3rem * var(--arabic-scale, 1))" }}
          >
            <AyahText v={verse} />
          </p>
        </div>
      )}
      <div className="border-b border-line px-3 py-2">
        <SegmentedControl<ContextTab>
          value={tab}
          onChange={onTab}
          options={tabs}
          ariaLabel={t.reader.context}
        />
      </div>
      <div className="px-4 py-3">{body}</div>
    </div>
  );
}
