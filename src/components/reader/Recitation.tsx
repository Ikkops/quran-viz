import { useMemo, useState, useSyncExternalStore } from "react";
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
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { Surah, Verse } from "../../types/quran";
import {
  GAP_CHOICES,
  RATE_CHOICES,
  REPEAT_CHOICES,
  formatClock,
  locateInRange,
  nextRepeat,
  repeatBadge,
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
import { cx, QuietIconButton, Select } from "../ui";

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
}

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
    <Select<T>
      size="sm"
      label={label}
      value={value}
      onChange={onChange}
      options={choices.map((c) => ({ value: c, label: format(c) }))}
    />
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
        <Select
          size="sm"
          className="flex-1"
          value={v.s}
          ariaLabel={a.surahOf(label)}
          searchable
          onChange={(n) => {
            const s = surahs.find((x) => x.number === n);
            if (s) onPick(firstIds[s.number] + (end === "from" ? 0 : s.ayahCount - 1));
          }}
          options={surahs.map((s) => ({
            value: s.number,
            label: `${s.number}. ${s.name}`,
          }))}
        />
        <Select
          size="sm"
          className="w-[4.5rem] tabular-nums"
          value={v.a}
          ariaLabel={a.ayahOf(label)}
          onChange={(n) => onPick(firstIds[v.s] + n - 1)}
          options={Array.from({ length: surah.ayahCount }, (_, i) => ({
            value: i + 1,
            label: String(i + 1),
          }))}
        />
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

/** The seek bar: where playback is inside the range, as time. Lengths are
 *  estimates until an ayah has been played, so the end time firms up as the
 *  range plays. Dragging (or arrow keys) jumps to that moment's ayah. */
function SeekBar({
  rec,
  range,
  reciter,
}: {
  rec: Recitation;
  range: LoopRange;
  /** Estimates differ per reciter. */
  reciter: string;
}) {
  const { t } = useI18n();
  const a = t.reader.audio;
  const time = useSyncExternalStore(rec.clock.subscribe, rec.clock.get);
  const { lengthOf } = rec;
  const lengths = useMemo(
    () =>
      Array.from({ length: range.to - range.from + 1 }, (_, i) =>
        lengthOf(range.from + i),
      ),
    // `time.rev` changes when a real length replaces an estimate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.from, range.to, lengthOf, reciter, time.rev],
  );
  const total = useMemo(() => lengths.reduce((n, x) => n + x, 0), [lengths]);
  let pos = 0;
  if (time.id !== null && time.id >= range.from) {
    const idx = Math.min(time.id - range.from, lengths.length);
    for (let i = 0; i < idx; i++) pos += lengths[i];
    if (idx < lengths.length) pos += Math.min(time.t, lengths[idx]);
  }
  // While dragging, the thumb follows the finger; the jump happens on release.
  const [drag, setDrag] = useState<number | null>(null);
  const commit = () => {
    if (drag === null) return;
    const { id, offset } = locateInRange(lengths, range.from, drag);
    setDrag(null);
    rec.seek(id, offset);
  };
  const shown = drag ?? pos;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-muted">
        {formatClock(shown)}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(total))}
        step={1}
        value={Math.round(shown)}
        disabled={total <= 0}
        aria-label={a.seek}
        aria-valuetext={a.seekText(formatClock(shown), formatClock(total))}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="h-6 min-w-0 flex-1 cursor-pointer accent-illumination touch:h-11"
      />
      <span
        className="w-10 shrink-0 text-xs tabular-nums text-ink-muted"
        title={a.endEstimate}
      >
        {formatClock(total)}
      </span>
    </div>
  );
}

/** One end of the range in the bar: − ref +. The reference opens the options
 *  sheet, where the end can be picked by surah and ayah. */
function RangeStepper({
  label,
  text,
  onShift,
  onOpen,
}: {
  label: string;
  text: string;
  onShift: (d: 1 | -1) => void;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const a = t.reader.audio;
  const btn =
    "inline-flex h-8 w-8 items-center justify-center text-ink-muted hover:bg-surface-sunken hover:text-ink touch:h-11 touch:w-9";
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 items-center overflow-hidden rounded-lg border border-line"
    >
      <button
        type="button"
        className={btn}
        onClick={() => onShift(-1)}
        aria-label={a.earlier(label)}
        title={a.earlier(label)}
      >
        <Minus size={15} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onOpen}
        title={a.pickEnd(label)}
        className="h-8 min-w-[2.75rem] px-0.5 text-center text-xs font-semibold tabular-nums text-ink hover:bg-surface-sunken touch:h-11"
      >
        <span className="sr-only">{label} </span>
        {text}
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => onShift(1)}
        aria-label={a.later(label)}
        title={a.later(label)}
      >
        <Plus size={15} aria-hidden />
      </button>
    </div>
  );
}

/**
 * The player docked under the reader (DESIGN.md "Float"). The seek bar sits
 * between the two ends of the range (start on the left, end on the right);
 * under it, the transport with play in the middle: repeat, restart ayah,
 * previous, play, next, options. On a phone the range ends drop to a third row.
 */
export function MiniPlayer({
  rec,
  verses,
  reciter,
  reciterName,
  options,
  onOptions,
  range,
  onRange,
  roomy,
  onOpenOptions,
  download,
}: {
  rec: Recitation;
  verses: Verse[];
  reciter: string;
  reciterName: string;
  options: RecitationOptions;
  onOptions: (o: RecitationOptions) => void;
  range: LoopRange;
  onRange: (r: LoopRange) => void;
  /** Wide enough for the range ends beside the seek bar. */
  roomy: boolean;
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

  const max = verses.length;
  const repeat = repeatBadge(options.ayahRepeat);
  const repeatLabel = a.repeatButton(a.times(options.ayahRepeat));
  const fromStep = (
    <RangeStepper
      label={a.from}
      text={refOf(verses, range.from)}
      onShift={(d) => onRange(shiftRange(range, "from", d, max))}
      onOpen={onOpenOptions}
    />
  );
  const toStep = (
    <RangeStepper
      label={a.to}
      text={refOf(verses, range.to)}
      onShift={(d) => onRange(shiftRange(range, "to", d, max))}
      onOpen={onOpenOptions}
    />
  );
  // What is playing, in one line: "50:16 · 2/3" while an ayah repeats.
  const status = rec.error ? (
    <span className="text-rubric">{a.failed(rec.error)}</span>
  ) : cur ? (
    <span className="font-semibold tabular-nums text-ink">
      {cur.basmalah ? `${a.basmalah} · ` : ""}
      {refOf(verses, cur.id)}
      {options.ayahRepeat !== 1 && (
        <span className="font-normal text-ink-subtle">
          {" · "}
          {passCount(cur.ayahPass, options.ayahRepeat)}
        </span>
      )}
    </span>
  ) : (
    <span className="text-ink-subtle">{reciterName}</span>
  );
  const seek = <SeekBar rec={rec} range={range} reciter={reciter} />;
  return (
    <div
      role="region"
      aria-label={a.bar}
      className="flex shrink-0 flex-col gap-0.5 border-t border-line bg-surface px-2 py-1"
    >
      <div className="flex items-center gap-1.5">
        {roomy && fromStep}
        {seek}
        {roomy && toStep}
      </div>
      {/* The side columns share the leftover width equally, so play sits in
          the middle of the bar. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
        <div className="flex min-w-0 items-center justify-end gap-0.5">
          {roomy && (
            <p className="mr-auto min-w-0 truncate pl-1 text-sm" aria-live="polite">
              {status}
            </p>
          )}
          <button
            type="button"
            onClick={() =>
              onOptions({ ...options, ayahRepeat: nextRepeat(options.ayahRepeat) })
            }
            aria-label={repeatLabel}
            title={repeatLabel}
            aria-pressed={options.ayahRepeat !== 1}
            className={cx(
              "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors touch:h-11 touch:w-11",
              options.ayahRepeat !== 1
                ? "bg-illumination/15 text-illumination"
                : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            <Repeat size={18} aria-hidden />
            {repeat && (
              <span
                aria-hidden
                className="absolute bottom-0.5 right-0.5 rounded-sm bg-surface px-0.5 text-[0.625rem] font-bold leading-none tabular-nums"
              >
                {repeat}
              </span>
            )}
          </button>
          <QuietIconButton label={a.restart} onClick={rec.restart} disabled={!cur}>
            <RotateCcw size={18} />
          </QuietIconButton>
          <QuietIconButton label={a.prevAyah} onClick={() => rec.step(-1)}>
            <SkipBack size={18} />
          </QuietIconButton>
        </div>
        <button
          type="button"
          onClick={rec.toggle}
          aria-label={rec.playing ? a.pause : a.play}
          title={rec.playing ? a.pause : a.play}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-illumination text-white dark:text-paper"
        >
          {rec.playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <div className="flex min-w-0 items-center gap-0.5">
          <QuietIconButton label={a.nextAyah} onClick={() => rec.step(1)}>
            <SkipForward size={18} />
          </QuietIconButton>
          <QuietIconButton label={a.options} onClick={onOpenOptions}>
            <ChevronUp size={19} />
          </QuietIconButton>
          {roomy && cur && (
            <p className="ml-auto min-w-0 truncate pr-1 text-xs text-ink-subtle">
              {reciterName}
            </p>
          )}
        </div>
      </div>
      {!roomy && (
        <div className="flex items-center justify-between gap-2">
          {fromStep}
          <p className="min-w-0 truncate text-sm" aria-live="polite">
            {status}
          </p>
          {toStep}
        </div>
      )}
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
  reciterNote,
  onPlay,
  onCancel,
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
  /** Android app: what is on the device for a reciter ("12 surahs"). */
  reciterNote?: (id: string) => string | null;
  /** Start the range from its beginning with these options. */
  onPlay: () => void;
  /** Put the options back as they were when the sheet opened. */
  onCancel: () => void;
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
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex gap-2 border-b border-line bg-surface px-4 py-3">
        <button
          type="button"
          onClick={onPlay}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-illumination px-3 text-sm font-semibold text-white touch:min-h-11 dark:text-paper"
        >
          <Play size={16} aria-hidden /> {a.playNow}
        </button>
        <button
          type="button"
          onClick={onCancel}
          title={a.cancelHint}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink-subtle px-4 text-sm font-medium text-ink hover:bg-surface-sunken touch:min-h-11"
        >
          {a.cancel}
        </button>
      </div>
      <Select
        size="sm"
        label={a.reciter}
        value={reciter}
        onChange={onReciter}
        searchable={reciters.length > 8}
        options={reciters.map((r) => ({
          value: r.id,
          label: [a.reciterOption(r), reciterNote?.(r.id)].filter(Boolean).join(" · "),
        }))}
      />

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
