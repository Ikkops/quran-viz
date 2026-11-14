import { Download, X } from "lucide-react";
import type { TafsirEdition } from "../../data/editions";
import { formatBytes } from "../../data/recitation";
import {
  cancelTafsirDownload,
  deleteTafsir,
  downloadTafsir,
  downloadable,
  type TafsirDownloads,
} from "../../data/tafsirStore";
import { useI18n } from "../../i18n/I18nContext";
import { QuietIconButton } from "../ui";

/** In the Android app, an edition that isn't on the device yet: what it is,
 *  its size, and a button to download it (then progress and cancel). */
export function TafsirDownloadOffer({
  ed,
  dl,
}: {
  ed: TafsirEdition;
  dl: TafsirDownloads;
}) {
  const { t } = useI18n();
  const d = t.reader.tafsirDownload;
  const active = dl.active?.id === ed.id ? dl.active : null;
  const busyElsewhere = !!dl.active && !active;
  const pct = active ? Math.round((100 * active.done) / Math.max(1, active.total)) : 0;
  return (
    <div className="rounded-lg border border-line bg-surface p-3" aria-live="polite">
      <p className="text-sm text-ink">
        {d.offer(ed.label, formatBytes(ed.download?.bytes ?? 0))}
      </p>
      {active ? (
        <div className="mt-2 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs tabular-nums text-ink-subtle">{d.downloading(pct)}</p>
            <div
              className="mt-1 h-1 overflow-hidden rounded-sm bg-surface-sunken"
              role="progressbar"
              aria-label={d.progress}
              aria-valuemin={0}
              aria-valuemax={active.total}
              aria-valuenow={active.done}
            >
              <div
                className="h-full bg-illumination transition-[width] motion-reduce:transition-none"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <QuietIconButton label={d.cancel} onClick={cancelTafsirDownload}>
            <X size={18} />
          </QuietIconButton>
        </div>
      ) : (
        <>
          {dl.failed === ed.id && (
            <p className="mt-1 text-sm text-rubric" role="alert">
              {d.failed}
            </p>
          )}
          <button
            type="button"
            disabled={busyElsewhere}
            onClick={() => void downloadTafsir(ed.id)}
            className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg bg-illumination px-3 text-sm font-semibold text-white disabled:opacity-50 touch:min-h-11 dark:text-paper"
          >
            <Download size={16} aria-hidden />
            {d.download}
          </button>
        </>
      )}
      <p className="mt-2 text-xs text-ink-subtle">{d.note}</p>
    </div>
  );
}

/** The line under a tafsir note: where it comes from, when it was published
 *  and, for a downloaded edition in the app, a way to remove it. */
export function TafsirSourceLine({
  ed,
  className,
}: {
  ed: TafsirEdition;
  className?: string;
}) {
  const { t, lang } = useI18n();
  return (
    <p className={className ?? "mt-2 text-xs text-ink-subtle"}>
      {ed.source}. {lang === "id" ? ed.published.id : ed.published.en}.
      {downloadable(ed) && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t.reader.tafsirDownload.removeConfirm(ed.label)))
                void deleteTafsir(ed.id);
            }}
            className="underline underline-offset-2 hover:text-ink"
          >
            {t.reader.tafsirDownload.remove}
          </button>
        </>
      )}
    </p>
  );
}
