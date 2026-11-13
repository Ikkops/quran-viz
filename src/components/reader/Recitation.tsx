import { useMemo } from "react";
import {
  ChevronUp,
  Crosshair,
  Download,
  Trash2,
  X,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { Surah, Verse } from "../../types/quran";
import {
  GAP_CHOICES,
  RATE_CHOICES,
  REPEAT_CHOICES,
  setRangeEnd,
  shiftRange,
  type LoopRange,
} from "../../data/recitation";
import type {
  Recitation,
  RecitationOptions,
  ReciterIndex,
} from "../../data/useRecitation";
import { useI18n } from "../../i18n/I18nContext";
import { cx, QuietIconButton } from "../ui";

/** The Android app's per-surah audio download, as the player shows it. */
export interface AudioDownloadPrompt {
  /** What would be downloaded for this view ("Al-Baqara", "3 surahs"), or
   *  null when it is all on the device. */
  needed: { what: string; size: string } | null;
  /** The download in progress. */
  active: { what: string; done: number; total: number; waiting: number } | null;
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
}

/** Audio on the device for the chosen reciter (Android app). */
export interface AudioStorage {
  surahs: number;
  size: string;
  allSize: string;
  busy: boolean;
  onDownloadAll: () => void;
  onDeleteAll: () => void;
  /** Internal storage and any SD card, with free space. */
  locations: { id: string; label: string; free: string }[];
  location: string | null;
  /** The chosen SD card isn't inserted; internal storage is in use. */
  cardMissing: boolean;
  moving: { done: number; total: number } | null;
  moveError: string | null;
  onLocation: (id: string) => void;
}

const sel =
  "min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";

function Choice<T extends number>({
  label,
  value,
  choices,
  format,
  onChange,
}: {
  label: string;
  value: T;
  choices: readonly T[];
  format: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink-muted">
      {label}
      <select
        className={sel}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as T)}
      >
        {choices.map((c) => (
          <option key={c} value={c}>
            {format(c)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** One end of the range: surah and ayah dropdowns between −/+ steppers, plus
 *  "set here". Picking a surah jumps to its first ayah ("from") or its last
 *  ("to"), so a whole surah is two picks away. */
function RangeEnd({
  end,
  label,
  id,
  verses,
  surahs,
  firstIds,
  onPick,
  onShift,
  onSetHere,
  canSetHere,
}: {
  end: "from" | "to";
  label: string;
  id: number;
  verses: Verse[];
  surahs: Surah[];
  firstIds: number[];
  onPick: (id: number) => void;
  onShift: (d: 1 | -1) => void;
  onSetHere: () => void;
  canSetHere: boolean;
}) {
  const { t } = useI18n();
  const a = t.reader.audio;
  const v = verses[id - 1];
  const surah = v ? surahs.find((s) => s.number === v.s) : undefined;
  if (!v || !surah) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-ink-muted">{label}</span>
      <div className="flex items-center gap-1">
        <QuietIconButton label={a.earlier(label)} onClick={() => onShift(-1)}>
          <Minus size={15} />
        </QuietIconButton>
        <select
          className={cx(sel, "flex-1")}
          value={v.s}
          aria-label={a.surahOf(label)}
          onChange={(e) => {
            const s = surahs.find((x) => x.number === Number(e.target.value));
            if (s) onPick(firstIds[s.number] + (end === "from" ? 0 : s.ayahCount - 1));
          }}
        >
          {surahs.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.nameEn}
            </option>
          ))}
        </select>
        <select
          className={cx(sel, "w-[4.5rem] tabular-nums")}
          value={v.a}
          aria-label={a.ayahOf(label)}
          onChange={(e) => onPick(firstIds[v.s] + Number(e.target.value) - 1)}
        >
          {Array.from({ length: surah.ayahCount }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <QuietIconButton label={a.later(label)} onClick={() => onShift(1)}>
          <Plus size={15} />
        </QuietIconButton>
        <QuietIconButton
          label={a.setHere(label)}
          onClick={onSetHere}
          disabled={!canSetHere}
        >
          <Crosshair size={15} />
        </QuietIconButton>
      </div>
    </div>
  );
}

const refOf = (verses: Verse[], id: number) => {
  const v = verses[id - 1];
  return v ? `${v.s}:${v.a}` : "–";
};

const passCount = (done: number, total: number) =>
  total === 0 ? `${done + 1}` : `${Math.min(done + 1, total)}/${total}`;

/**
 * The slim player docked under the reader: play / previous / next, what is
 * playing, and a button for the options sheet (DESIGN.md "Float").
 */
export function MiniPlayer({
  rec,
  verses,
  reciterName,
  options,
  onOpenOptions,
  download,
}: {
  rec: Recitation;
  verses: Verse[];
  reciterName: string;
  options: RecitationOptions;
  onOpenOptions: () => void;
  /** Android app: offer or show the download of this view's audio. */
  download?: AudioDownloadPrompt | null;
}) {
  const { t } = useI18n();
  const a = t.reader.audio;
  const cur = rec.cursor;
  // Nothing to play here yet: the bar becomes the download offer.
  const offer =
    download &&
    !rec.playing &&
    (download.active || download.needed || rec.missing !== null);
  if (download && offer) {
    const missingRef = rec.missing !== null ? refOf(verses, rec.missing) : null;
    return (
      <div
        role="region"
        aria-label={a.bar}
        className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-3 py-1.5"
      >
        {download.active ? (
          <>
            <div className="min-w-0 flex-1 leading-tight" aria-live="polite">
              <p className="truncate text-sm font-semibold tabular-nums text-ink">
                {a.downloading(
                  download.active.what,
                  download.active.done,
                  download.active.total,
                )}
              </p>
              <div
                className="mt-1 h-1 overflow-hidden rounded-sm bg-surface-sunken"
                role="progressbar"
                aria-label={a.downloadProgress}
                aria-valuemin={0}
                aria-valuemax={download.active.total}
                aria-valuenow={download.active.done}
              >
                <div
                  className="h-full bg-illumination transition-[width] motion-reduce:transition-none"
                  style={{
                    width: `${(100 * download.active.done) / Math.max(1, download.active.total)}%`,
                  }}
                />
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-subtle">
                {download.active.waiting > 0
                  ? a.waiting(download.active.waiting)
                  : reciterName}
              </p>
            </div>
            <QuietIconButton label={a.cancelDownload} onClick={download.onCancel}>
              <X size={18} />
            </QuietIconButton>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1 leading-tight" aria-live="polite">
              <p
                className={cx(
                  "truncate text-sm",
                  download.error ? "text-rubric" : "font-semibold text-ink",
                )}
              >
                {download.error
                  ? a.downloadFailed(download.error)
                  : missingRef
                    ? a.notOnDevice(missingRef)
                    : a.notDownloaded}
              </p>
              <p className="truncate text-xs text-ink-subtle">
                {download.needed
                  ? a.downloadSize(download.needed.what, download.needed.size)
                  : reciterName}
              </p>
            </div>
            {download.needed && (
              <button
                type="button"
                onClick={download.onStart}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-illumination px-3 text-sm font-semibold text-white touch:min-h-11 dark:text-paper"
              >
                <Download size={16} aria-hidden />
                {a.download}
              </button>
            )}
          </>
        )}
        <QuietIconButton label={a.options} onClick={onOpenOptions}>
          <ChevronUp size={19} />
        </QuietIconButton>
      </div>
    );
  }
  // Three columns: what is playing, the transport centred under the reader,
  // and the options button. The side columns share the leftover width equally
  // so the play button sits in the middle of the bar.
  return (
    <div
      role="region"
      aria-label={a.bar}
      className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-t border-line bg-surface px-2 py-1.5"
    >
      <div className="min-w-0 pl-1 leading-tight" aria-live="polite">
        {rec.error ? (
          <p className="truncate text-sm text-rubric">{a.failed(rec.error)}</p>
        ) : cur ? (
          <>
            <p className="truncate text-sm font-semibold tabular-nums text-ink">
              {cur.basmalah ? `${a.basmalah} · ` : ""}
              {refOf(verses, cur.id)}
            </p>
            <p className="truncate text-xs tabular-nums text-ink-subtle">
              {a.pass(
                passCount(cur.ayahPass, options.ayahRepeat),
                passCount(cur.rangePass, options.rangeRepeat),
              )}
            </p>
          </>
        ) : (
          <>
            <p className="truncate text-sm text-ink-muted">{a.idle}</p>
            <p className="truncate text-xs text-ink-subtle">{reciterName}</p>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <QuietIconButton label={a.prevAyah} onClick={() => rec.step(-1)}>
          <SkipBack size={18} />
        </QuietIconButton>
        <button
          type="button"
          onClick={rec.toggle}
          aria-label={rec.playing ? a.pause : a.play}
          title={rec.playing ? a.pause : a.play}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-illumination text-white dark:text-paper"
        >
          {rec.playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <QuietIconButton label={a.nextAyah} onClick={() => rec.step(1)}>
          <SkipForward size={18} />
        </QuietIconButton>
      </div>
      <div className="flex justify-end">
        <QuietIconButton label={a.options} onClick={onOpenOptions}>
          <ChevronUp size={19} />
        </QuietIconButton>
      </div>
    </div>
  );
}

/** Everything else about recitation, for the options sheet: reciter, the
 *  range to loop, repeats, gap and speed. */
export function RecitationControls({
  rec,
  reciters,
  reciter,
  onReciter,
  verses,
  surahs,
  range,
  isDefaultRange,
  onRange,
  onResetRange,
  options,
  onOptions,
  storage,
}: {
  rec: Recitation;
  /** Reciters present locally. */
  reciters: ReciterIndex[];
  reciter: string;
  onReciter: (id: string) => void;
  verses: Verse[];
  surahs: Surah[];
  range: LoopRange;
  /** The range is still the reader's own scope (not edited). */
  isDefaultRange: boolean;
  onRange: (r: LoopRange) => void;
  onResetRange: () => void;
  options: RecitationOptions;
  onOptions: (o: RecitationOptions) => void;
  /** Android app: what is downloaded for this reciter. */
  storage?: AudioStorage | null;
}) {
  const { t } = useI18n();
  const a = t.reader.audio;
  const max = verses.length;
  // Global verse id of each surah's first ayah, indexed by surah number.
  const firstIds = useMemo(() => {
    const out: number[] = [];
    for (const v of verses) if (v.a === 1) out[v.s] = v.id;
    return out;
  }, [verses]);
  const cur = rec.cursor;
  const set = <K extends keyof RecitationOptions>(k: K, v: RecitationOptions[K]) =>
    onOptions({ ...options, [k]: v });

  return (
    <div className="flex flex-col gap-4 p-4">
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        {a.reciter}
        <select
          className={sel}
          value={reciter}
          onChange={(e) => onReciter(e.target.value)}
        >
          {reciters.map((r) => (
            <option key={r.id} value={r.id}>
              {a.reciterOption(r)}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-3">
        <RangeEnd
          end="from"
          label={a.from}
          id={range.from}
          verses={verses}
          surahs={surahs}
          firstIds={firstIds}
          onPick={(id) => onRange(setRangeEnd(range, "from", id))}
          onShift={(d) => onRange(shiftRange(range, "from", d, max))}
          onSetHere={() => cur && onRange(setRangeEnd(range, "from", cur.id))}
          canSetHere={!!cur}
        />
        <RangeEnd
          end="to"
          label={a.to}
          id={range.to}
          verses={verses}
          surahs={surahs}
          firstIds={firstIds}
          onPick={(id) => onRange(setRangeEnd(range, "to", id))}
          onShift={(d) => onRange(shiftRange(range, "to", d, max))}
          onSetHere={() => cur && onRange(setRangeEnd(range, "to", cur.id))}
          canSetHere={!!cur}
        />
        {!isDefaultRange && (
          <button
            type="button"
            onClick={onResetRange}
            className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm text-illumination hover:bg-surface-sunken"
          >
            <RotateCcw size={14} aria-hidden /> {a.resetRange}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Choice
          label={a.ayahRepeat}
          value={options.ayahRepeat}
          choices={REPEAT_CHOICES}
          format={a.times}
          onChange={(v) => set("ayahRepeat", v)}
        />
        <Choice
          label={a.rangeRepeat}
          value={options.rangeRepeat}
          choices={REPEAT_CHOICES}
          format={a.times}
          onChange={(v) => set("rangeRepeat", v)}
        />
        <Choice
          label={a.gap}
          value={options.gap}
          choices={GAP_CHOICES}
          format={a.seconds}
          onChange={(v) => set("gap", v)}
        />
        <Choice
          label={a.rate}
          value={options.rate}
          choices={RATE_CHOICES}
          format={(v) => `${v}×`}
          onChange={(v) => set("rate", v)}
        />
      </div>

      {storage && (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">{a.storageTitle}</h3>
          <p className="text-sm tabular-nums text-ink-muted">
            {a.onDevice(storage.surahs, storage.size)}
          </p>
          {storage.locations.length > 1 && (
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              {a.saveOn}
              <select
                className={cx(sel, "min-h-10 touch:min-h-11")}
                value={storage.location ?? ""}
                disabled={storage.busy}
                onChange={(e) => storage.onLocation(e.target.value)}
              >
                {storage.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {a.locationOption(l.label, l.free)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {storage.cardMissing && <p className="text-sm text-rubric">{a.cardMissing}</p>}
          {storage.moving && (
            <p className="text-sm tabular-nums text-ink" aria-live="polite">
              {a.moving(storage.moving.done, storage.moving.total)}
            </p>
          )}
          {storage.moveError && (
            <p className="text-sm text-rubric">
              {storage.moveError === "space"
                ? a.moveNoSpace
                : a.moveFailed(storage.moveError)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {storage.surahs < 114 && (
              <button
                type="button"
                onClick={storage.onDownloadAll}
                disabled={storage.busy}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-ink-subtle px-3 text-sm font-medium text-ink hover:bg-surface-sunken disabled:opacity-50 touch:min-h-11"
              >
                <Download size={15} aria-hidden /> {a.downloadAll(storage.allSize)}
              </button>
            )}
            {storage.surahs > 0 && (
              <button
                type="button"
                onClick={storage.onDeleteAll}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-rubric hover:bg-surface-sunken touch:min-h-11"
              >
                <Trash2 size={15} aria-hidden /> {a.deleteAll}
              </button>
            )}
          </div>
          <p className="text-xs text-ink-subtle">{a.sourceNote}</p>
        </section>
      )}
    </div>
  );
}
