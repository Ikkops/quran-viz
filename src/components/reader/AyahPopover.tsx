import { useI18n } from "../../i18n/I18nContext";
import { PopoverActions, PopoverCard, PopoverClose } from "./PopoverCard";
import type { AyahPick } from "./wordPick";

/** The small card by a tapped ayah in the mushaf layouts: its reference and
 *  its translation in the reader's edition, play and context. */
export function AyahPopover({
  pick,
  title,
  text,
  loading,
  lang,
  rtl,
  scale,
  holdHint,
  canPlay,
  onPlay,
  onContext,
  onClose,
}: {
  pick: AyahPick;
  /** "Al-Baqarah 2:255". */
  title: string;
  text: string | null | undefined;
  loading: boolean;
  lang: string;
  rtl: boolean;
  /** The reader's translation size. */
  scale: number;
  /** Say that holding a word shows its meaning (printed layout). */
  holdHint: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onContext: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <PopoverCard rect={pick.rect} label={title} onClose={onClose}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 pt-0.5 text-heading tabular-nums">{title}</p>
        <PopoverClose onClose={onClose} />
      </div>
      <p
        lang={loading || !text ? undefined : lang}
        dir={rtl && text ? "rtl" : undefined}
        className="mt-1 max-h-[calc(32*var(--zvh))] overflow-y-auto font-reading leading-relaxed text-ink"
        style={{ fontSize: `calc(0.9375rem * ${scale})` }}
      >
        {loading ? t.common.loading : text || "—"}
      </p>
      <PopoverActions canPlay={canPlay} onPlay={onPlay} onContext={onContext} />
      {holdHint && <p className="mt-2 text-xs text-ink-subtle">{t.reader.holdHint}</p>}
    </PopoverCard>
  );
}
