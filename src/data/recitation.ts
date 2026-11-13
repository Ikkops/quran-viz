// Range-loop logic for per-ayah recitation playback. Pure: the audio element
// lives in useRecitation; this decides what plays next.
//
// Ayahs are addressed by global verse id (1..6236), so a range may cross surah
// boundaries. The range is read again every time an ayah ends, which is what
// lets the user move its ends while audio plays: the ayah in progress finishes,
// then the new range applies (an ayah left outside it wraps to the new start).

import { BASE } from "./base";
import { RECITER_INFO, type ReciterId } from "./reciters";

/** Inclusive range of global verse ids, from <= to. */
export interface LoopRange {
  from: number;
  to: number;
}

/** Repeat counts; 0 means repeat forever. */
export interface LoopOptions {
  ayahRepeat: number;
  rangeRepeat: number;
}

/** Where playback is. `ayahPass`/`rangePass` count completed plays. */
export interface Cursor {
  id: number;
  ayahPass: number;
  rangePass: number;
  /** Playing the basmalah that precedes ayah `id`. */
  basmalah: boolean;
}

/** Loop counts plus playback feel, persisted as `qv.audio.options`. */
export interface RecitationOptions extends LoopOptions {
  /** Silence between ayahs, in seconds. */
  gap: number;
  rate: number;
}

export {
  LOCAL_RECITERS,
  RECITERS,
  RECITER_INFO,
  type ReciterId,
  type ReciterInfo,
} from "./reciters";

/** How many times an ayah (or the range) plays: 1 is once, 0 is forever. The
 *  player words them as repetitions (plays − 1): none, 1×, 2×, 3×, 5×, 11×, ∞. */
export const REPEAT_CHOICES = [1, 2, 3, 4, 6, 12, 0] as const;

/** The next repeat setting when the repeat button is pressed (wraps to none). */
export function nextRepeat(plays: number): number {
  const i = REPEAT_CHOICES.indexOf(plays as (typeof REPEAT_CHOICES)[number]);
  return REPEAT_CHOICES[(i + 1) % REPEAT_CHOICES.length];
}

/** "" for no repeat, "∞" for forever, else the repetitions ("2×" = 3 plays). */
export function repeatBadge(plays: number): string {
  return plays === 0 ? "∞" : plays <= 1 ? "" : `${plays - 1}×`;
}
export const GAP_CHOICES = [0, 0.5, 1, 2, 3] as const;
export const RATE_CHOICES = [0.75, 0.9, 1, 1.1, 1.25, 1.5] as const;

export const DEFAULT_RECITATION: RecitationOptions = {
  ayahRepeat: 1,
  rangeRepeat: 1,
  gap: 0,
  rate: 1,
};

/** Keep stored options only where each value is still one of the choices. */
export function sanitizeRecitationOptions(raw: unknown): RecitationOptions | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const pick = (v: unknown, allowed: readonly number[], d: number) =>
    typeof v === "number" && allowed.includes(v) ? v : d;
  const d = DEFAULT_RECITATION;
  return {
    ayahRepeat: pick(r.ayahRepeat, REPEAT_CHOICES, d.ayahRepeat),
    rangeRepeat: pick(r.rangeRepeat, REPEAT_CHOICES, d.rangeRepeat),
    gap: pick(r.gap, GAP_CHOICES, d.gap),
    rate: pick(r.rate, RATE_CHOICES, d.rate),
  };
}

/** First play of `id`, preceded by its basmalah when one is due. */
export function cursorAt(
  id: number,
  needsBasmalah: (id: number) => boolean,
  rangePass = 0,
): Cursor {
  return { id, ayahPass: 0, rangePass, basmalah: needsBasmalah(id) };
}

/** True when ayah `id` lies outside `range` (an edited range left it behind). */
export function outsideRange(id: number, range: LoopRange): boolean {
  return id < range.from || id > range.to;
}

/** The cursor after the current file ends, or null when playback is done. */
export function advance(
  cur: Cursor,
  range: LoopRange,
  opts: LoopOptions,
  needsBasmalah: (id: number) => boolean,
): Cursor | null {
  if (cur.basmalah) return { ...cur, basmalah: false };
  const ayahPass = cur.ayahPass + 1;
  if (opts.ayahRepeat === 0 || ayahPass < opts.ayahRepeat) return { ...cur, ayahPass };
  if (cur.id < range.from) return cursorAt(range.from, needsBasmalah, cur.rangePass);
  if (cur.id < range.to) return cursorAt(cur.id + 1, needsBasmalah, cur.rangePass);
  // End of a pass (or the range moved behind the cursor): wrap or stop.
  const rangePass = cur.rangePass + 1;
  if (opts.rangeRepeat !== 0 && rangePass >= opts.rangeRepeat) return null;
  return cursorAt(range.from, needsBasmalah, rangePass);
}

/** Move one end of the range by `delta`, clamped to [1, max]; the other end
 *  follows when they would cross, so from <= to always holds. */
export function shiftRange(
  range: LoopRange,
  end: "from" | "to",
  delta: number,
  max: number,
): LoopRange {
  const clamp = (n: number) => Math.min(max, Math.max(1, n));
  if (end === "from") {
    const from = clamp(range.from + delta);
    return { from, to: Math.max(from, range.to) };
  }
  const to = clamp(range.to + delta);
  return { from: Math.min(range.from, to), to };
}

/** Set one end of the range to `id`, keeping from <= to. */
export function setRangeEnd(range: LoopRange, end: "from" | "to", id: number): LoopRange {
  return end === "from"
    ? { from: id, to: Math.max(id, range.to) }
    : { from: Math.min(range.from, id), to: id };
}

const pad3 = (n: number) => String(n).padStart(3, "0");

/** SSSAAA.mp3, the per-ayah file name used by everyayah.com and fetch_audio.py. */
export function audioFileName(surah: number, ayah: number): string {
  return `${pad3(surah)}${pad3(ayah)}.mp3`;
}

/** Where the dev server serves `audio/` (the Android app passes its own). */
export const WEB_AUDIO_BASE = `${BASE}audio/`;

/** URL of one ayah's audio file under `base` (a folder URL ending in "/"). */
export function ayahAudioUrl(
  reciter: string,
  surah: number,
  ayah: number,
  base: string = WEB_AUDIO_BASE,
): string {
  return `${base}${reciter}/${audioFileName(surah, ayah)}`;
}

/** 1:1 is the basmalah; it is played before ayah 1 of the other surahs. */
export function basmalahAudioUrl(reciter: string, base?: string): string {
  return ayahAudioUrl(reciter, 1, 1, base);
}

export function audioIndexUrl(reciter: string): string {
  return `${WEB_AUDIO_BASE}${reciter}/index.json`;
}

/** The files one surah needs: its ayahs, plus 001001.mp3 when the basmalah is
 *  recited before its first ayah. */
export function surahAudioFiles(
  surah: number,
  ayahCount: number,
  hasBismillah: boolean,
): string[] {
  const files = Array.from({ length: ayahCount }, (_, i) => audioFileName(surah, i + 1));
  if (hasBismillah && surah !== 1) files.unshift(audioFileName(1, 1));
  return files;
}

/** Estimated download size of some surahs: the whole set's size, shared out by
 *  word count (recitation length follows the text closely enough). */
export function estimateAudioBytes(
  reciter: ReciterId,
  words: number,
  totalWords: number,
): number {
  return totalWords > 0 ? (RECITER_INFO[reciter].bytes * words) / totalWords : 0;
}

/** "25 MB" / "1.5 GB", rounded for a label. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

/** Estimated length of one ayah in seconds: the whole set's playing time
 *  (bytes at a constant bitrate) shared out by letter count. The player
 *  replaces it with the real length once the file has loaded. */
export function estimateAyahSeconds(
  reciter: ReciterId,
  letters: number,
  totalLetters: number,
): number {
  const info = RECITER_INFO[reciter];
  if (!info || totalLetters <= 0) return 0;
  const total = (info.bytes * 8) / (info.bitrate * 1000);
  return (total * letters) / totalLetters;
}

/** "1:05" / "1:02:07" for a playing time in seconds. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Where a playing time (seconds from the range's start) falls: the ayah and
 *  the offset inside it. `lengths[i]` is the length of ayah `from + i`. */
export function locateInRange(
  lengths: readonly number[],
  from: number,
  at: number,
): { id: number; offset: number } {
  let left = Math.max(0, at);
  for (let i = 0; i < lengths.length; i++) {
    if (left < lengths[i] || i === lengths.length - 1)
      return { id: from + i, offset: Math.min(left, Math.max(0, lengths[i] - 0.25)) };
    left -= lengths[i];
  }
  return { id: from, offset: 0 };
}
