import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import {
  chooseAudioFolder,
  hasFolderAccess,
  moveAudioTo,
  refreshVolumes,
  requestFolderAccess,
  useAudioDownloads,
  type AudioVolume,
} from "../../data/audioStore";
import { formatBytes } from "../../data/recitation";
import { useI18n } from "../../i18n/I18nContext";

const NONE: readonly string[] = [];
const btn =
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-ink-subtle px-3 text-sm font-medium text-ink hover:bg-surface-sunken disabled:opacity-50 touch:min-h-11";

/**
 * Where recitation audio is kept (Android app): the app's own storage, its
 * folder on an SD card, or any folder the learner chooses. Choosing moves the
 * audio already downloaded; the choice stays until it is changed here.
 */
export function AudioStorageSettings() {
  const { t } = useI18n();
  const a = t.settings.audio;
  const s = useAudioDownloads(NONE);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Coming back from the system's permission screen: look again.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      void hasFolderAccess().then(setGranted);
      void refreshVolumes();
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  const nameOf = (v: AudioVolume) =>
    v.custom ? v.id : v.removable ? a.sdCard : a.appStorage;
  const busy = !!s.moving || !!s.active;
  const choose = async () => {
    setNote(null);
    const result = await chooseAudioFolder();
    if (result === "unsupported") setNote(a.unsupported);
    else if (result === "unwritable") setNote(a.unwritable);
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="text-ink-muted">{a.current}</p>
        <p className="break-all font-medium text-ink">
          {s.location ? nameOf(s.location) : "…"}
        </p>
        {s.location && (
          <p className="text-xs tabular-nums text-ink-subtle">
            {a.free(formatBytes(s.location.free))}
          </p>
        )}
      </div>
      {s.cardMissing && <p className="text-rubric">{a.missing}</p>}
      {s.moving && (
        <p className="tabular-nums text-ink" aria-live="polite">
          {a.moving(s.moving.done, s.moving.total)}
        </p>
      )}
      {s.moveError && (
        <p className="text-rubric">
          {s.moveError === "space" ? a.noSpace : a.moveFailed(s.moveError)}
        </p>
      )}
      {note && <p className="text-rubric">{note}</p>}

      {granted === false ? (
        <div className="flex flex-col items-start gap-2 rounded-lg bg-surface-sunken p-3">
          <p className="text-ink-muted">{a.needAccess}</p>
          <button
            type="button"
            className={btn}
            onClick={() => void requestFolderAccess()}
          >
            {a.grant}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`${btn} self-start`}
          disabled={busy || granted === null}
          onClick={() => void choose()}
        >
          <FolderOpen size={16} aria-hidden /> {a.choose}
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {s.volumes
          .filter((v) => v.id !== s.location?.id)
          .map((v) => (
            <button
              key={v.id}
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => void moveAudioTo(v.id)}
            >
              {a.useVolume(nameOf(v))}
            </button>
          ))}
      </div>
      <p className="text-xs text-ink-subtle">{a.help}</p>
    </div>
  );
}
