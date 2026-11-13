// Range-loop logic for per-ayah recitation playback. Pure: the audio element
// lives in useRecitation; this decides what plays next.
//
// Ayahs are addressed by global verse id (1..6236), so a range may cross surah
// boundaries. The range is read again every time an ayah ends, which is what
// lets the user move its ends while audio plays: the ayah in progress finishes,
// then the new range applies (an ayah left outside it wraps to the new start).

import { BASE } from "./base";

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

/** Reciters scripts/fetch_audio.py can download (folder names under
 *  `audio/`); the reader lists the ones present locally. */
export const RECITERS = ["shuraym", "yasser"] as const;
export type ReciterId = (typeof RECITERS)[number];

export const REPEAT_CHOICES = [1, 2, 3, 5, 7, 10, 0] as const;
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

/** URL of one ayah's audio file (SSSAAA.mp3, as written by fetch_audio.py). */
export function ayahAudioUrl(reciter: string, surah: number, ayah: number): string {
  return `${BASE}audio/${reciter}/${pad3(surah)}${pad3(ayah)}.mp3`;
}

/** 1:1 is the basmalah; it is played before ayah 1 of the other surahs. */
export function basmalahAudioUrl(reciter: string): string {
  return ayahAudioUrl(reciter, 1, 1);
}

export function audioIndexUrl(reciter: string): string {
  return `${BASE}audio/${reciter}/index.json`;
}
