import { useMemo } from "react";
import {
  ChevronUp,
  Crosshair,
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
}: {
  rec: Recitation;
  verses: Verse[];
  reciterName: string;
  options: RecitationOptions;
  onOpenOptions: () => void;
}) {
  const { t } = useI18n();
  const a = t.reader.audio;
  const cur = rec.cursor;
  return (
    <div
      role="region"
      aria-label={a.bar}
      className="flex shrink-0 items-center gap-1 border-t border-line bg-surface px-2 py-1.5"
    >
      <QuietIconButton label={a.prevAyah} onClick={() => rec.step(-1)}>
        <SkipBack size={18} />
      </QuietIconButton>
      <button
        type="button"
        onClick={rec.toggle}
        aria-label={rec.playing ? a.pause : a.play}
        title={rec.playing ? a.pause : a.play}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-illumination text-white dark:text-paper"
      >
        {rec.playing ? <Pause size={19} /> : <Play size={19} className="ml-0.5" />}
      </button>
      <QuietIconButton label={a.nextAyah} onClick={() => rec.step(1)}>
        <SkipForward size={18} />
      </QuietIconButton>
      <div className="ml-1 min-w-0 flex-1 leading-tight" aria-live="polite">
        {rec.error ? (
          <p className="truncate text-sm text-rubric">{a.failed(rec.error)}</p>
        ) : cur ? (
          <>
            <p className="truncate text-sm font-semibold tabular-nums text-ink">
              {cur.basmalah ? `${a.basmalah} · ` : ""}
              {refOf(verses, cur.id)}
              <span className="ml-1.5 font-normal text-ink-subtle">
                {a.pass(
                  passCount(cur.ayahPass, options.ayahRepeat),
                  passCount(cur.rangePass, options.rangeRepeat),
                )}
              </span>
            </p>
            <p className="truncate text-xs text-ink-subtle">{reciterName}</p>
          </>
        ) : (
          <>
            <p className="truncate text-sm text-ink-muted">{a.idle}</p>
            <p className="truncate text-xs text-ink-subtle">{reciterName}</p>
          </>
        )}
      </div>
      <QuietIconButton label={a.options} onClick={onOpenOptions}>
        <ChevronUp size={19} />
      </QuietIconButton>
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
    </div>
  );
}
