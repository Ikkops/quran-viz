import { useState } from "react";
import { Check } from "lucide-react";
import type { Verse } from "../../types/quran";
import { useI18n } from "../../i18n/I18nContext";
import {
  HIFDH_STATUSES,
  setStatus,
  statusOf,
  type Hifdh,
  type HifdhStatus,
} from "../../lib/hifdh";
import { SegmentedControl, cx } from "../ui";

const EXTENTS = ["ayah", "page", "surah", "juz"] as const;
type Extent = (typeof EXTENTS)[number];

/** First and last ayah id of the page, surah or juz that holds ayah `id`. */
function extentRange(verses: Verse[], id: number, extent: Extent): [number, number] {
  const v = verses[id - 1];
  if (!v || extent === "ayah") return [id, id];
  const key = extent === "surah" ? "s" : extent;
  let from = id;
  let to = id;
  while (from > 1 && verses[from - 2][key] === v[key]) from--;
  while (to < verses.length && verses[to][key] === v[key]) to++;
  return [from, to];
}

/**
 * Mark what is memorised: choose how far it applies from this ayah (the ayah,
 * its page, surah or juz), then a status; choosing the status saves and
 * closes.
 */
export function HifdhSheet({
  ayah,
  verses,
  hifdh,
  onHifdh,
  onDone,
}: {
  ayah: number;
  verses: Verse[];
  hifdh: Hifdh;
  onHifdh: (h: Hifdh) => void;
  onDone: () => void;
}) {
  const { t, n } = useI18n();
  const h = t.hifdh;
  const [extent, setExtent] = useState<Extent>("ayah");
  const [from, to] = extentRange(verses, ayah, extent);
  const now = statusOf(hifdh, ayah);
  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-ink-muted">{h.applyTo}</p>
        <SegmentedControl<Extent>
          ariaLabel={h.applyTo}
          fullWidth
          value={extent}
          onChange={setExtent}
          options={EXTENTS.map((e) => ({ value: e, label: h.extents[e] }))}
        />
        <p className="text-xs tabular-nums text-ink-subtle">
          {h.ayahCount(n(to - from + 1))}
        </p>
      </div>
      <ul className="flex flex-col gap-0.5">
        {HIFDH_STATUSES.map((s: HifdhStatus) => (
          <li key={s}>
            <button
              type="button"
              aria-pressed={extent === "ayah" && s === now}
              onClick={() => {
                onHifdh(setStatus(hifdh, from, to, s));
                onDone();
              }}
              className={cx(
                "flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-surface-sunken",
                s === now ? "font-medium text-illumination" : "text-ink",
              )}
            >
              <span className="min-w-0 flex-1">{h.statuses[s]}</span>
              {s === now && <Check size={16} aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
