import { useMemo, useState } from "react";
import { Grid3x3 } from "lucide-react";
import type { QuranData } from "../../types/quran";
import type { ReaderTarget } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";
import { countStatus, progressBy, type Hifdh } from "../../lib/hifdh";
import { Card, SegmentedControl } from "../ui";

type By = "surah" | "juz";

/** Activity → Hafalan: how much of each surah (or juz) is memorised, one
 *  tile each, filled from the bottom by the memorised share of its ayahs; a
 *  rubric dot marks ayahs that need review. A tile opens it in the reader. */
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
  const groups = useMemo(
    () => progressBy(hifdh, verses, by === "surah" ? (v) => v.s : (v) => v.juz),
    [hifdh, verses, by],
  );
  const all = useMemo(() => countStatus(hifdh), [hifdh]);
  const done = all[2] + all[3];
  const pct = (part: number, whole: number, digits = 0) =>
    `${n(Math.round((10 ** digits * 100 * part) / Math.max(1, whole)) / 10 ** digits)}%`;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="flex items-center gap-2 text-heading text-ink">
        <Grid3x3 size={16} aria-hidden className="text-ink-subtle" /> {h.progressTitle}
      </h2>
      <p className="text-sm text-ink-subtle">
        {done === 0
          ? h.mapEmpty
          : h.mapSummary(pct(done, verses.length, 1), n(done), n(all[3]))}
      </p>
      <SegmentedControl<By>
        ariaLabel={h.progressTitle}
        value={by}
        onChange={setBy}
        options={[
          { value: "surah", label: h.extents.surah },
          { value: "juz", label: h.extents.juz },
        ]}
      />
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1">
        {[...groups].map(([k, g]) => {
          const name = by === "surah" ? (surahs[k - 1]?.name ?? "") : h.juzLabel(k);
          const label =
            h.progressTile(name, pct(g.done, g.total), n(g.done), n(g.total)) +
            (g.weak ? ` · ${h.progressWeak(n(g.weak))}` : "");
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => onOpen({ scope: by, value: k })}
                aria-label={label}
                title={label}
                className="relative flex h-11 w-full flex-col items-center justify-center overflow-hidden rounded-md border border-line bg-surface text-xs tabular-nums transition-colors hover:border-illumination/60"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 bg-illumination/25"
                  style={{ height: `${(100 * g.done) / g.total}%` }}
                />
                <span className="relative font-medium text-ink">{n(k)}</span>
                {g.done > 0 && (
                  <span className="relative text-[10px] leading-none text-ink-muted">
                    {pct(g.done, g.total)}
                  </span>
                )}
                {g.weak > 0 && (
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 size-1.5 rounded-full bg-rubric"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
