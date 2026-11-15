import { BookOpen, X } from "lucide-react";
import type { ReaderTarget } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";
import { Button } from "../ui";

/** What a tapped mark (or a histogram bucket) stands for, pinned above the
 *  chart until cleared, with a way into the reader. */
export interface Pinned {
  /** Identifies the mark, so a second tap on it can open the reader. */
  key: string;
  title: string;
  detail?: string;
  /** Open this in the reader (the main button). */
  target?: ReaderTarget;
  /** Several ayahs to choose from (a histogram bucket). */
  examples?: { label: string; target: ReaderTarget }[];
  /** Lower bound of a selected histogram bucket. */
  bucket?: number;
}

export function MarkReadout({
  pinned,
  onOpen,
  onClear,
}: {
  pinned: Pinned;
  onOpen: (t: ReaderTarget) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface-sunken px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tabular-nums text-ink">{pinned.title}</p>
        {pinned.detail && <p className="text-sm text-ink-muted">{pinned.detail}</p>}
        {pinned.target && (
          <p className="text-xs text-ink-subtle">{t.dashboard.tapAgain}</p>
        )}
        {pinned.examples && pinned.examples.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-subtle">{t.dashboard.bucketFirst}</span>
            {pinned.examples.map((e) => (
              <button
                key={e.label}
                type="button"
                onClick={() => onOpen(e.target)}
                className="h-8 rounded-md border border-line bg-surface px-2 text-sm font-medium tabular-nums text-illumination transition-colors hover:border-illumination/40 touch:min-h-11"
              >
                {e.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {pinned.target && (
        <Button
          variant="primary"
          onClick={() => onOpen(pinned.target!)}
          icon={<BookOpen size={16} aria-hidden />}
        >
          {t.dashboard.openInReader}
        </Button>
      )}
      <button
        type="button"
        onClick={onClear}
        aria-label={t.dashboard.clearSelection}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink touch:min-h-11 touch:min-w-11"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
