import { Pause, Play, X } from "lucide-react";
import type { Surah, Verse } from "../../types/quran";
import { useRecitationContext } from "../../data/RecitationContext";
import { useI18n } from "../../i18n/I18nContext";
import { QuietIconButton } from "../ui";

/** The recitation going on while the reader is closed: the ayah, play/pause,
 *  stop, and a tap on the ayah to open the reader there. Sits just above the
 *  bottom tabs; its spacer keeps the page's last rows clear of it. */
export function NowPlayingBar({
  surahs,
  verses,
  onOpen,
}: {
  surahs: Surah[];
  verses: Verse[];
  onOpen: (id: number) => void;
}) {
  const { t } = useI18n();
  const { rec, readerOpen, reciterName } = useRecitationContext();
  // The reader has its own player.
  const v = rec.cursor && !readerOpen ? verses[rec.cursor.id - 1] : undefined;
  if (!v) return null;
  const name = surahs.find((s) => s.id === v.s)?.name ?? "";
  return (
    <>
      <div aria-hidden className="h-16" />
      <div
        role="region"
        aria-label={t.nowPlaying.label}
        className="fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-30 pb-2 pl-[calc(0.5rem+env(safe-area-inset-left))] pr-[calc(0.5rem+env(safe-area-inset-right))]"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-float">
          <button
            type="button"
            onClick={() => onOpen(v.id)}
            aria-label={`${t.nowPlaying.open}: ${name} ${v.s}:${v.a}${reciterName ? `, ${reciterName}` : ""}`}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg px-3 text-start transition-colors hover:bg-surface-sunken"
          >
            <span className="truncate text-xs text-ink-subtle">
              {t.nowPlaying.label}
              {reciterName && ` · ${reciterName}`}
            </span>
            <span className="truncate text-sm font-medium text-ink">
              {name} {v.s}:{v.a}
            </span>
          </button>
          <QuietIconButton
            label={rec.playing ? t.nowPlaying.pause : t.nowPlaying.play}
            onClick={rec.toggle}
            className="h-11 w-11"
          >
            {rec.playing ? <Pause size={20} /> : <Play size={20} />}
          </QuietIconButton>
          <QuietIconButton
            label={t.nowPlaying.stop}
            onClick={rec.stop}
            className="h-11 w-11"
          >
            <X size={20} />
          </QuietIconButton>
        </div>
      </div>
    </>
  );
}
