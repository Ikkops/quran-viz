import { useId, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Play, X } from "lucide-react";
import type { Surah, Verse } from "../../types/quran";
import type { ReaderTarget } from "../charts/common";
import { buildMapLayout } from "../../data/mushafMap";
import { ayahPlace } from "../../data/selectors";
import { useRoots } from "../../data/useRoots";
import { useTopics } from "../../data/useTopics";
import { searchRoots } from "../../data/roots";
import { buildTopicTree, searchTopicTree, topicName } from "../../data/topics";
import { persisted, usePersistentState } from "../../lib/usePersistentState";
import { useI18n } from "../../i18n/I18nContext";
import { useTheme } from "../../theme/ThemeContext";
import { Card, SectionTitle, SegmentedControl, cx } from "../ui";
import type { ExploreTarget } from "../reader/VerseContextPanel";
import { MushafMap, type MapMarks, type PickHow } from "./MushafMap";

type HighlightKind = "none" | "root" | "topic";

/** sessionStorage flag: the opening reveal has played in this session. */
const REVEAL_SEEN = "qv.peta.revealed";

function Chip({
  on,
  onClick,
  swatch,
  children,
}: {
  on: boolean;
  onClick: () => void;
  swatch: string;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 touch:min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
        on
          ? "border-ink-subtle bg-surface text-ink"
          : "border-line text-ink-muted hover:text-ink",
      )}
    >
      <span
        className={cx("h-2.5 w-2.5 rounded-full", !on && "opacity-40")}
        style={{ backgroundColor: swatch }}
        aria-hidden
      />
      {children}
    </button>
  );
}

/**
 * The Peta Mushaf (DESIGN.md signature): the whole Qur'an at a glance, with
 * overlays for sajdah, the last-read ayah and bookmarks, and a highlight for a
 * root's or a topic's ayahs. Click (or tap, then open) to read an ayah.
 */
export function PetaMushaf({
  verses,
  surahMap,
  lastRead,
  bookmarks,
  onOpen,
  onExplore,
}: {
  verses: Verse[];
  surahMap: Map<number, Surah>;
  /** Ayah id of the last-read position, if any. */
  lastRead?: number;
  bookmarks: number[];
  onOpen: (t: ReaderTarget) => void;
  onExplore: (t: ExploreTarget) => void;
}) {
  const { t, n, place, lang } = useI18n();
  const { dark, palette } = useTheme();
  const readoutId = useId();
  const layout = useMemo(() => buildMapLayout(verses), [verses]);
  const [showSajda, setShowSajda] = usePersistentState(
    "qv.peta.sajda",
    true,
    persisted.bool,
  );
  const [showLast, setShowLast] = usePersistentState(
    "qv.peta.last",
    true,
    persisted.bool,
  );
  const [showMarks, setShowMarks] = usePersistentState(
    "qv.peta.marks",
    true,
    persisted.bool,
  );
  const [kind, setKind] = usePersistentState<HighlightKind>(
    "qv.peta.kind",
    "none",
    persisted.oneOf(["none", "root", "topic"] as const),
  );
  const [rootBw, setRootBw] = usePersistentState<string | null>("qv.peta.root", null);
  const [topicKey, setTopicKey] = usePersistentState<string | null>(
    "qv.peta.topic",
    null,
  );
  const [query, setQuery] = useState("");
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // The opening reveal: once per session, never under reduced motion; the
  // replay button plays it slower, naming each surah as it appears.
  const [reveal, setReveal] = useState<{ ms: number } | null>(() => {
    if (typeof window === "undefined") return null;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let seen = true;
    try {
      seen = sessionStorage.getItem(REVEAL_SEEN) === "1";
      sessionStorage.setItem(REVEAL_SEEN, "1");
    } catch {
      /* storage blocked: skip the reveal */
    }
    return reduce || seen ? null : { ms: 1400 };
  });
  const [revealing, setRevealing] = useState<Surah | null>(null);

  const roots = useRoots(kind === "root");
  const topics = useTopics(kind === "topic");
  const tree = useMemo(
    () => (topics.data ? buildTopicTree(topics.data) : null),
    [topics.data],
  );

  const root = kind === "root" ? roots.data?.find((r) => r.bw === rootBw) : undefined;
  const topicIdx = kind === "topic" && topicKey ? tree?.byKey.get(topicKey) : undefined;
  const highlight = useMemo<Set<number> | null>(() => {
    if (root) return new Set(root.v);
    if (tree && topicIdx !== undefined) return new Set(tree.all[topicIdx]);
    return null;
  }, [root, tree, topicIdx]);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    if (kind === "root" && roots.data)
      return searchRoots(roots.data, q, 8).map((r) => ({
        key: r.bw,
        label: `${r.ar} · ${r.bw} · ${r.gloss.replace(/[,;]\s*$/, "")}`,
      }));
    if (kind === "topic" && tree)
      return searchTopicTree(tree, q, 8).map((i) => ({
        key: tree.nodes[i].k,
        label: topicName(tree.nodes[i], lang),
      }));
    return [];
  }, [query, kind, roots.data, tree, lang]);

  const marks: MapMarks = useMemo(
    () => ({
      sajda: showSajda,
      lastRead: showLast ? lastRead : undefined,
      bookmarks: showMarks ? bookmarks : undefined,
    }),
    [showSajda, showLast, lastRead, showMarks, bookmarks],
  );

  const open = (id: number) => {
    const v = verses[id - 1];
    if (v) onOpen({ scope: "surah", value: v.s, anchor: v.id });
  };
  const pick = (id: number, how: PickHow) => {
    // A click or Enter reads at once; a tap selects (Read, or a second tap on
    // the same ayah, opens it); arrow keys only move the selection.
    if (how === "move") setSelectedId(id);
    else if (how === "touch" && selectedId !== id) setSelectedId(id);
    else open(id);
  };

  // Touch screens get the tap wording (there is nothing to point with).
  const coarsePointer =
    typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
  const shownId = hoverId ?? selectedId;
  const shown = shownId ? verses[shownId - 1] : undefined;
  const readout = shown
    ? t.peta.readout(
        `${shown.s}:${shown.a}`,
        surahMap.get(shown.s)?.name ?? "",
        place(ayahPlace(shown, surahMap)),
        shown.juz,
        shown.page,
      )
    : coarsePointer
      ? t.peta.hintTouch
      : t.peta.hint;

  const hits = root
    ? t.peta.rootHits(
        root.ar,
        root.gloss.replace(/[,;]\s*$/, ""),
        n(root.v.length),
        n(highlight?.size ?? 0),
      )
    : tree && topicIdx !== undefined
      ? t.peta.topicHits(topicName(tree.nodes[topicIdx], lang), n(highlight?.size ?? 0))
      : null;
  const loadingHighlight =
    (kind === "root" && !roots.data) || (kind === "topic" && !tree);

  return (
    <Card className="p-4">
      <SectionTitle title={t.peta.title} subtitle={t.peta.subtitle} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-ink-muted">{t.peta.marks}</span>
        <Chip
          on={showSajda}
          onClick={() => setShowSajda(!showSajda)}
          swatch="rgb(var(--rubric))"
        >
          {t.peta.sajda}
        </Chip>
        {lastRead && (
          <Chip
            on={showLast}
            onClick={() => setShowLast(!showLast)}
            swatch="rgb(var(--ink))"
          >
            {t.peta.lastRead}
          </Chip>
        )}
        {bookmarks.length > 0 && (
          <Chip
            on={showMarks}
            onClick={() => setShowMarks(!showMarks)}
            swatch="rgb(var(--illumination))"
          >
            {t.peta.bookmarks}
          </Chip>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-start gap-2">
        <span className="mr-1 mt-2 text-sm text-ink-muted">{t.peta.highlight}</span>
        <SegmentedControl<HighlightKind>
          value={kind}
          onChange={(k) => {
            setKind(k);
            setQuery("");
          }}
          ariaLabel={t.peta.highlight}
          options={[
            { value: "none", label: t.peta.none },
            { value: "root", label: t.peta.root },
            { value: "topic", label: t.peta.topic },
          ]}
        />
        {kind !== "none" && (
          <div className="relative min-w-[14rem] flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={kind === "root" ? t.peta.rootPh : t.peta.topicPh}
              aria-label={kind === "root" ? t.peta.rootPh : t.peta.topicPh}
              className="h-10 touch:min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink"
            />
            {query.trim() && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-float">
                {loadingHighlight ? (
                  <li className="px-3 py-2 text-sm text-ink-subtle">
                    {t.common.loading}
                  </li>
                ) : suggestions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-ink-subtle">{t.peta.noMatch}</li>
                ) : (
                  suggestions.map((s) => (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => {
                          if (kind === "root") setRootBw(s.key);
                          else setTopicKey(s.key);
                          setQuery("");
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-surface-sunken"
                      >
                        {s.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      {hits && (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
          <span>{hits}</span>
          <button
            type="button"
            onClick={() =>
              root
                ? onExplore({ kind: "root", key: root.bw })
                : topicKey && onExplore({ kind: "topic", key: topicKey })
            }
            className="inline-flex items-center gap-1 font-medium text-illumination hover:underline"
          >
            {t.peta.explore} <ArrowUpRight size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => (root ? setRootBw(null) : setTopicKey(null))}
            className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
          >
            <X size={14} aria-hidden /> {t.peta.clear}
          </button>
        </p>
      )}

      <div className="mb-2 flex min-h-[2.5rem] flex-wrap items-center gap-x-3 gap-y-1">
        <p
          id={readoutId}
          aria-live="polite"
          hidden={!!revealing}
          className="min-w-0 flex-1 text-sm text-ink-muted"
        >
          {readout}
        </p>
        {revealing && (
          <p aria-hidden className="min-w-0 flex-1 text-sm text-ink">
            <span className="tabular-nums text-ink-subtle">
              {t.peta.revealing(revealing.revelationOrder)}:
            </span>{" "}
            <span className="font-medium">{revealing.name}</span>{" "}
            <span className="text-ink-subtle">
              ({t.common.surah} {revealing.id}, {place(revealing.type)})
            </span>
          </p>
        )}
        {selectedId && verses[selectedId - 1] && (
          <button
            type="button"
            onClick={() => open(selectedId)}
            className="inline-flex h-9 touch:min-h-11 items-center gap-1.5 rounded-lg bg-illumination px-3 text-sm font-semibold text-white dark:text-paper"
          >
            <BookOpen size={15} aria-hidden />
            {t.peta.read(`${verses[selectedId - 1].s}:${verses[selectedId - 1].a}`)}
          </button>
        )}
      </div>

      <MushafMap
        layout={layout}
        verses={verses}
        surahMap={surahMap}
        dark={dark}
        highlight={highlight}
        marks={marks}
        hoverId={hoverId}
        selectedId={selectedId}
        onHover={setHoverId}
        onPick={pick}
        label={t.peta.mapLabel}
        describedBy={readoutId}
        reveal={reveal}
        onRevealSurah={setRevealing}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
        {(["Meccan", "Medinan", "Hijra"] as const).map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor:
                  p === "Hijra"
                    ? palette.hijra
                    : p === "Meccan"
                      ? palette.pie[0]
                      : palette.pie[1],
              }}
              aria-hidden
            />
            {p === "Hijra" ? t.legend.hijra : place(p)}
          </span>
        ))}
        <span className="text-ink-subtle">{t.peta.rowsAre}</span>
        <button
          type="button"
          onClick={() => setReveal({ ms: 6000 })}
          title={t.peta.revealNote}
          className="ml-auto inline-flex min-h-9 touch:min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-illumination hover:bg-surface-sunken"
        >
          <Play size={14} aria-hidden /> {t.peta.replay}
        </button>
      </div>
    </Card>
  );
}
