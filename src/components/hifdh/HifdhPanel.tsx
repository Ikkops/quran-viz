import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, ListChecks, MessageCircleQuestion, X } from "lucide-react";
import type { QuranData } from "../../types/quran";
import type { ReaderTarget } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";
import { splitWords } from "../../data/mushafLayout";
import {
  QUOTA_CHOICES,
  listStumbles,
  removeStumble,
  sambungStarts,
  setStatus,
  statusOf,
  type Hifdh,
  type HifdhPage,
} from "../../lib/hifdh";
import { AyahText } from "../reader/AyahText";
import { Button, Card, QuietIconButton, Select, Sheet } from "../ui";
import { openForReview, pageSpan, useHifdhPlan } from "./plan";

const SHOWN_STUMBLES = 50;

/**
 * Activity → Hafalan: what to recite today (new pages, recent and older
 * review), the "continue the ayah" self-test, and the words the learner
 * stumbled on.
 */
export function HifdhPanel({
  data,
  hifdh,
  onHifdh,
  onOpen,
}: {
  data: QuranData;
  hifdh: Hifdh;
  onHifdh: (h: Hifdh) => void;
  onOpen: (t: ReaderTarget) => void;
}) {
  const { t, n } = useI18n();
  const h = t.hifdh;
  const { verses, surahs } = data;
  const { plan, quota, setQuota } = useHifdhPlan(hifdh, verses);
  const [testing, setTesting] = useState(false);
  const starts = useMemo(() => sambungStarts(hifdh, verses), [hifdh, verses]);
  const stumbles = useMemo(() => listStumbles(hifdh), [hifdh]);
  const nothingMarked = !/[123]/.test(hifdh.status);

  const pages = (title: string, list: HifdhPage[]) => (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium text-ink-muted">{title}</h3>
      {list.length === 0 ? (
        <p className="text-sm text-ink-subtle">{h.none}</p>
      ) : (
        <ul className="flex flex-col">
          {list.map((p) => (
            <li key={p.page}>
              <button
                type="button"
                onClick={() => openForReview(p.page, onOpen)}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-surface-sunken"
              >
                <span className="w-16 shrink-0 tabular-nums text-ink-muted">
                  {h.pageLabel(p.page)}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {pageSpan(p, verses, surahs)}
                </span>
                <ArrowRight size={15} aria-hidden className="shrink-0 text-ink-subtle" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="flex items-center gap-2 text-heading text-ink">
          <ListChecks size={16} aria-hidden className="text-ink-subtle" /> {h.planTitle}
        </h2>
        {nothingMarked ? (
          <p className="text-sm text-ink-subtle">{h.planEmpty}</p>
        ) : (
          <>
            <p className="text-sm text-ink-subtle">{h.planHelp}</p>
            {pages(h.learning, plan.learning.slice(0, 3))}
            {pages(h.recent, plan.recent)}
            {pages(h.old, plan.old)}
            {plan.oldDue > plan.old.length && (
              <p className="text-xs tabular-nums text-ink-subtle">
                {h.oldMore(n(plan.oldDue - plan.old.length))}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <span className="text-sm text-ink">{h.quota}</span>
              <Select<string>
                className="w-24"
                size="sm"
                ariaLabel={h.quota}
                value={String(quota)}
                onChange={(v) => setQuota(Number(v))}
                options={QUOTA_CHOICES.map((q) => ({ value: String(q), label: n(q) }))}
              />
            </div>
          </>
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <h2 className="flex items-center gap-2 text-heading text-ink">
          <MessageCircleQuestion size={16} aria-hidden className="text-ink-subtle" />{" "}
          {h.sambung}
        </h2>
        <p className="text-sm text-ink-subtle">
          {starts.length === 0 ? h.sambungNone : h.sambungHelp}
        </p>
        <Button
          className="self-start"
          variant="primary"
          disabled={starts.length === 0}
          onClick={() => setTesting(true)}
        >
          {h.sambungStart}
        </Button>
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <h2 className="flex items-center gap-2 text-heading text-ink">
          <BookOpen size={16} aria-hidden className="text-ink-subtle" /> {h.mistakes}
        </h2>
        {stumbles.length === 0 ? (
          <p className="text-sm text-ink-subtle">{h.mistakesNone}</p>
        ) : (
          <ul className="divide-y divide-line">
            {stumbles.slice(0, SHOWN_STUMBLES).map((s) => {
              const v = verses[s.id - 1];
              if (!v) return null;
              const ref = `${v.s}:${v.a}`;
              return (
                <li key={`${s.id}:${s.w}`} className="flex items-center gap-2 py-1">
                  <button
                    type="button"
                    onClick={() => onOpen({ scope: "surah", value: v.s, anchor: v.id })}
                    aria-label={h.mistakeOpen(ref)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-surface-sunken"
                  >
                    <span lang="ar" dir="rtl" className="font-arabic text-xl text-ink">
                      {splitWords(v.ar)[s.w] ?? ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm tabular-nums text-ink-muted">
                      {surahs[v.s - 1]?.name} {ref}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-ink-subtle">
                      {h.times(n(s.n))}
                    </span>
                  </button>
                  <QuietIconButton
                    label={h.mistakeRemove(ref)}
                    onClick={() => onHifdh(removeStumble(hifdh, s.id, s.w))}
                  >
                    <X size={16} />
                  </QuietIconButton>
                </li>
              );
            })}
          </ul>
        )}
        {stumbles.length > SHOWN_STUMBLES && (
          <p className="text-xs tabular-nums text-ink-subtle">
            {h.mistakesMore(n(stumbles.length - SHOWN_STUMBLES))}
          </p>
        )}
      </Card>

      <Sheet
        open={testing}
        onClose={() => setTesting(false)}
        title={h.sambung}
        closeLabel={t.common.close}
      >
        {testing && (
          <SambungAyat data={data} starts={starts} hifdh={hifdh} onHifdh={onHifdh} />
        )}
      </Sheet>
    </div>
  );
}

/**
 * "Continue the ayah": an ayah the learner has memorised is shown; they
 * recite the next one, uncover it, and say whether they knew it. A miss marks
 * that ayah as needing review, a hit clears the mark.
 */
function SambungAyat({
  data,
  starts,
  hifdh,
  onHifdh,
}: {
  data: QuranData;
  starts: number[];
  hifdh: Hifdh;
  onHifdh: (h: Hifdh) => void;
}) {
  const { t, n } = useI18n();
  const h = t.hifdh;
  // The questions are drawn once, when the test opens: marking an ayah as
  // needing review must not reshuffle them.
  const [order] = useState(() => [...starts].sort(() => Math.random() - 0.5));
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(false);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const id = order[at % order.length];
  const v = data.verses[id - 1];
  const next = data.verses[id];
  if (!v || !next) return null;
  const answer = (ok: boolean) => {
    const was = statusOf(hifdh, next.id);
    if (!ok) onHifdh(setStatus(hifdh, next.id, next.id, 3));
    else if (was === 3) onHifdh(setStatus(hifdh, next.id, next.id, 2));
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
    setShown(false);
    setAt((i) => i + 1);
  };
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-3">
      <p className="text-sm tabular-nums text-ink-muted">
        {data.surahs[v.s - 1]?.name} {v.s}:{v.a}
        {score.total > 0 && ` · ${h.score(n(score.ok), n(score.total))}`}
      </p>
      <p lang="ar" dir="rtl" className="quran-text text-ink">
        <AyahText v={v} />
      </p>
      {shown ? (
        <>
          <p
            lang="ar"
            dir="rtl"
            className="quran-text border-t border-line pt-3 text-ink"
          >
            <AyahText v={next} />
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => answer(false)}>{h.ratings.forgot}</Button>
            <Button variant="primary" onClick={() => answer(true)}>
              {h.gotIt}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-subtle">{h.sambungPrompt}</p>
          <Button className="self-start" variant="primary" onClick={() => setShown(true)}>
            {h.sambungShow}
          </Button>
        </>
      )}
    </div>
  );
}
