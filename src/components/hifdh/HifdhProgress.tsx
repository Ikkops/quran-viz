import { useMemo, useState } from "react";
import { Grid3x3 } from "lucide-react";
import type { QuranData } from "../../types/quran";
import type { ReaderTarget } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";
import { countStatus, progressBy, type Hifdh, type Progress } from "../../lib/hifdh";
import { Button, Card, SegmentedControl, cx } from "../ui";
import { SurahNameArt } from "../home/SurahRow";

type By = "surah" | "juz";

/** A group's shares along one bar, in the same order and colours everywhere
 *  on this card: memorised (lapis), needing review (rubric, as on the Peta
 *  Mushaf), being memorised (a lapis tint); the rest is the gutter. */
function Shares({
  g,
  vertical,
  className,
}: {
  g: Pick<Progress, "total" | "done" | "weak" | "learning">;
  vertical?: boolean;
  className?: string;
}) {
  const parts: [number, string][] = [
    [g.done - g.weak, "bg-illumination"],
    [g.weak, "bg-rubric"],
    [g.learning, "bg-illumination/30"],
  ];
  return (
    <span
      aria-hidden
      className={cx(
        "flex overflow-hidden bg-surface-sunken",
        vertical && "flex-col-reverse",
        className,
      )}
    >
      {parts.map(([v, color], i) =>
        v > 0 ? (
          <span
            key={i}
            className={cx("shrink-0", color)}
            style={{ [vertical ? "height" : "width"]: `${(100 * v) / g.total}%` }}
          />
        ) : null,
      )}
    </span>
  );
}

/** Activity → Memorisation: how much of the Qur'an is memorised, a map with
 *  one cell per surah (or juz), and the started ones as rows with their name
 *  (or ayah range) and shares. A cell or row opens it in the reader. */
export function HifdhProgress({
  data,
  hifdh,
  onOpen,
}: {
  data: QuranData;
  hifdh: Hifdh;
  onOpen: (t: ReaderTarget) => void;
}) {
  const { t, n } = useI18n();
  const h = t.hifdh;
  const { verses, surahs } = data;
  const [by, setBy] = useState<By>("surah");
  const [showAll, setShowAll] = useState(false);
  const groups = useMemo(
    () => [...progressBy(hifdh, verses, by === "surah" ? (v) => v.s : (v) => v.juz)],
    [hifdh, verses, by],
  );
  const all = useMemo(() => countStatus(hifdh), [hifdh]);
  const whole = {
    total: verses.length,
    done: all[2] + all[3],
    weak: all[3],
    learning: all[1],
  };
  const started = groups.filter(([, g]) => g.done + g.learning > 0);
  const rows = showAll ? groups : started;
  // Under 1% but not nothing reads "<1%", never a misleading "0%".
  const pct = (part: number, whole: number, digits = 0) => {
    const v = Math.round((10 ** digits * 100 * part) / Math.max(1, whole)) / 10 ** digits;
    return part > 0 && v === 0 ? `<${n(1)}%` : `${n(v)}%`;
  };
  const ref = (id: number) => {
    const v = verses[id - 1];
    return v ? `${surahs[v.s - 1]?.name ?? v.s} ${n(v.a)}` : "";
  };
  const rangeOf = (g: Progress) => h.progressRange(ref(g.from), ref(g.to));
  const nameOf = (k: number) =>
    by === "surah" ? (surahs[k - 1]?.name ?? n(k)) : h.juzLabel(k);
  const labelOf = (k: number, g: Progress) =>
    h.progressTile(
      by === "juz" ? `${nameOf(k)}, ${rangeOf(g)}` : nameOf(k),
      pct(g.done, g.total),
      n(g.done),
      n(g.total),
    ) + (g.weak ? ` · ${h.progressWeak(n(g.weak))}` : "");

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-heading text-ink">
          <Grid3x3 size={16} aria-hidden className="text-ink-subtle" /> {h.progressTitle}
        </h2>
        <SegmentedControl<By>
          ariaLabel={h.progressTitle}
          value={by}
          onChange={(v) => {
            setBy(v);
            setShowAll(false);
          }}
          options={[
            { value: "surah", label: h.extents.surah },
            { value: "juz", label: h.extents.juz },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink">
          {whole.done + whole.learning === 0
            ? h.mapEmpty
            : h.progressShare(pct(whole.done, whole.total, 1))}
        </p>
        <Shares g={whole} className="h-2 rounded-full" />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          {(
            [
              [h.statuses[2], all[2], "bg-illumination"],
              [h.progressReview, all[3], "bg-rubric"],
              [h.statuses[1], all[1], "bg-illumination/30"],
            ] as const
          ).map(([label, count, color]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span aria-hidden className={cx("size-2.5 rounded-sm", color)} />
              {label}
              <span className="font-medium tabular-nums text-ink">{n(count)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* The map is for the eye and the finger; keyboards and screen readers
          get the same groups, named, in the rows below. */}
      <ol
        aria-hidden
        className={cx(
          "grid gap-1",
          by === "surah"
            ? "grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))]"
            : "grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))]",
        )}
      >
        {groups.map(([k, g]) => (
          <li key={k}>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onOpen({ scope: by, value: k })}
              title={labelOf(k, g)}
              className="relative block aspect-square w-full overflow-hidden rounded ring-1 ring-inset ring-line transition-shadow hover:ring-2 hover:ring-illumination/70"
            >
              <Shares g={g} vertical className="absolute inset-0" />
            </button>
          </li>
        ))}
      </ol>

      {started.length > 0 && (
        <div className="flex flex-col gap-1">
          {/* As many 18rem columns as the card holds (it sits in a narrow
              column on desktop); never an implicit column, which would grow to
              the longest line and widen the page. */}
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-x-6">
            {rows.map(([k, g]) => {
              const surah = by === "surah" ? surahs[k - 1] : undefined;
              const counts = [
                h.progressCount(n(g.done), n(g.total)),
                g.weak ? h.progressWeak(n(g.weak)) : null,
                g.learning ? h.progressLearning(n(g.learning)) : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => onOpen({ scope: by, value: k })}
                    aria-label={labelOf(k, g)}
                    className="flex w-full flex-col gap-1.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-sunken"
                  >
                    <span className="flex w-full items-center gap-3">
                      <span className="w-7 shrink-0 text-sm tabular-nums text-ink-subtle">
                        {n(k)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {nameOf(k)}
                        </span>
                        {/* Wrapped, never cut: the range and counts are the point. */}
                        {by === "juz" && (
                          <span className="block text-xs tabular-nums text-ink-muted">
                            {rangeOf(g)}
                          </span>
                        )}
                        <span className="block text-xs tabular-nums text-ink-subtle">
                          {counts}
                        </span>
                      </span>
                      {surah && (
                        <SurahNameArt
                          s={surah}
                          className="shrink-0 text-[1.5rem] leading-none text-ink-muted"
                        />
                      )}
                      <span className="w-11 shrink-0 text-right text-sm font-medium tabular-nums text-ink">
                        {pct(g.done, g.total)}
                      </span>
                    </span>
                    <Shares g={g} className="ml-10 h-1.5 rounded-full" />
                  </button>
                </li>
              );
            })}
          </ul>
          {started.length < groups.length && (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="self-start"
            >
              {showAll ? h.progressStartedOnly : h.progressShowAll(n(groups.length))}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
