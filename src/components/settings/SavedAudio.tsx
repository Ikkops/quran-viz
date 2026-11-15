import { useMemo, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import {
  deleteReciterAudio,
  deleteSurahAudio,
  useAudioDownloads,
} from "../../data/audioStore";
import { RECITERS, RECITER_INFO, formatBytes } from "../../data/recitation";
import { useI18n } from "../../i18n/I18nContext";
import type { Surah } from "../../types/quran";
import { cx } from "../ui";

const DELETE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-rubric transition-colors hover:bg-surface-sunken disabled:opacity-30 touch:min-h-11";

/**
 * The recitation audio on the device (Android app), reciter by reciter: how
 * many surahs and how much space, with a delete for the whole reciter and,
 * opened up, one per surah. This is the only place audio is deleted.
 */
export function SavedAudio({ surahs }: { surahs: Surah[] }) {
  const { t } = useI18n();
  const a = t.settings.audio;
  const s = useAudioDownloads(RECITERS);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const byId = useMemo(() => new Map(surahs.map((x) => [x.id, x])), [surahs]);

  const rows = RECITERS.flatMap((id) => {
    const have = s.downloaded[id] ?? {};
    const ids = Object.keys(have)
      .map(Number)
      .sort((x, y) => x - y);
    return ids.length > 0
      ? [{ id, ids, have, bytes: ids.reduce((n, k) => n + have[k], 0) }]
      : [];
  });
  const busy = working || !!s.moving;
  const run = async (job: () => Promise<void>) => {
    setWorking(true);
    try {
      await job();
    } finally {
      setWorking(false);
    }
  };

  if (rows.length === 0)
    return <p className="px-4 py-6 text-sm text-ink-muted">{a.savedEmpty}</p>;
  return (
    <div className="px-4 py-3">
      <p className="text-sm tabular-nums text-ink-muted">
        {a.savedTotal(formatBytes(rows.reduce((n, r) => n + r.bytes, 0)))}
      </p>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((r) => {
          const name = RECITER_INFO[r.id].name;
          const open = openFor === r.id;
          return (
            <li key={r.id} className="py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenFor(open ? null : r.id)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors hover:bg-surface-sunken"
                >
                  <ChevronRight
                    size={16}
                    aria-hidden
                    className={cx(
                      "shrink-0 text-ink-subtle transition-transform motion-reduce:transition-none",
                      open && "rotate-90",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {name}
                    </span>
                    <span className="block text-xs tabular-nums text-ink-subtle">
                      {a.savedLine(r.ids.length, formatBytes(r.bytes))}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={cx(DELETE, "h-9 px-3")}
                  onClick={() => {
                    if (
                      window.confirm(a.deleteReciterConfirm(name, formatBytes(r.bytes)))
                    )
                      void run(() => deleteReciterAudio(r.id));
                  }}
                >
                  <Trash2 size={15} aria-hidden /> {a.deleteReciter}
                </button>
              </div>
              {open && (
                <ul className="ms-6 mt-1">
                  {r.ids.map((n) => {
                    const surah = byId.get(n);
                    if (!surah) return null;
                    const label = `${n}. ${surah.name}`;
                    const size = formatBytes(r.have[n]);
                    return (
                      <li key={n} className="flex min-h-11 items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-ink">{label}</span>
                        <span className="tabular-nums text-ink-subtle">{size}</span>
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={a.deleteSurah(label)}
                          title={a.deleteSurah(label)}
                          className={cx(DELETE, "h-10 w-10 touch:min-w-11")}
                          onClick={() => {
                            if (window.confirm(a.deleteSurahConfirm(label, name, size)))
                              void run(() =>
                                deleteSurahAudio(r.id, {
                                  surah: n,
                                  ayahCount: surah.ayahCount,
                                  hasBismillah: surah.hasBismillah,
                                }),
                              );
                          }}
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
