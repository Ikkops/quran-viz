import { useEffect, useState } from "react";
import { FolderOpen, ListMusic } from "lucide-react";
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
import type { Surah } from "../../types/quran";
import { Button, Sheet } from "../ui";
import { SavedAudio } from "./SavedAudio";

const NONE: readonly string[] = [];

/**
 * Where recitation audio is kept (Android app): the app's own storage, its
 * folder on an SD card, or any folder the learner chooses. Choosing moves the
 * audio already downloaded; the choice stays until it is changed here.
 */
export function AudioStorageSettings({ surahs }: { surahs: Surah[] }) {
  const { t } = useI18n();
  const [savedOpen, setSavedOpen] = useState(false);
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
        <div className="flex flex-col items-start gap-2">
          <p className="text-ink-muted">{a.needAccess}</p>
          <Button onClick={() => void requestFolderAccess()}>{a.grant}</Button>
        </div>
      ) : (
        <Button
          className="self-start"
          icon={<FolderOpen size={16} aria-hidden />}
          disabled={busy || granted === null}
          onClick={() => void choose()}
        >
          {a.choose}
        </Button>
      )}

      <div className="flex flex-wrap gap-2">
        {s.volumes
          .filter((v) => v.id !== s.location?.id)
          .map((v) => (
            <Button key={v.id} disabled={busy} onClick={() => void moveAudioTo(v.id)}>
              {a.useVolume(nameOf(v))}
            </Button>
          ))}
      </div>
      <p className="text-xs text-ink-subtle">{a.help}</p>
      <Button
        className="self-start"
        icon={<ListMusic size={16} aria-hidden />}
        onClick={() => setSavedOpen(true)}
      >
        {a.saved}
      </Button>
      <Sheet
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title={a.saved}
        closeLabel={t.common.close}
      >
        <SavedAudio surahs={surahs} />
      </Sheet>
    </div>
  );
}
