import type { Palette } from "../../theme/palettes";
import { FAWATIH_COLORS } from "../../theme/palettes";
import type { SurahDatum } from "../../data/selectors";
import { categorizeOpening } from "../../data/fawatih";
import type { AyahPlace, Surah } from "../../types/quran";

/** Colour for a revelation place (fixed by DESIGN.md's Revelation Rule). */
export function placeColor(place: AyahPlace, palette: Palette): string {
  if (place === "Hijra") return palette.hijra;
  return place === "Medinan" ? palette.pie[1] : palette.pie[0];
}

/** Caveat shown wherever ayah-level places are used. */
export const PLACE_CAVEAT =
  "Ayah-level places follow the traditional mushaf surah headers; scholars differ on many.";

export type ColorMode = "type" | "fawatih";

/** A division the reader can be browsed by, in the order the reader lists them. */
export const READER_SCOPES = [
  "surah",
  "manzil",
  "juz",
  "hizb",
  "rub",
  "ruku",
  "page",
] as const;
export type ReaderScope = (typeof READER_SCOPES)[number];

/** Highest value of each reader scope (surah 1–114, juz 1–30, …). */
export const SCOPE_MAX: Record<ReaderScope, number> = {
  surah: 114,
  manzil: 7,
  juz: 30,
  hizb: 60,
  rub: 240,
  ruku: 558,
  page: 604,
};

/** Colour for a surah id outside the charts (reader badges, search results),
 *  following the same colour mode as the dashboard. Pass `place` (an ayah's
 *  own revelation place) to colour that ayah rather than its surah. */
export function surahColorById(
  sid: number,
  colorMode: ColorMode,
  palette: Palette,
  surahMap: Map<number, Surah>,
  place?: AyahPlace,
): string {
  if (colorMode === "fawatih")
    return FAWATIH_COLORS[categorizeOpening(sid)] ?? FAWATIH_COLORS.Unknown;
  return placeColor(place ?? surahMap.get(sid)?.type ?? "Meccan", palette);
}

/** What the reader should open at. `anchor` is a global ayah id to scroll to. */
export interface ReaderTarget {
  scope: ReaderScope;
  value: number;
  anchor?: number;
}

export interface ChartContext {
  palette: Palette;
  primary: string;
  colorMode: ColorMode;
  dark: boolean;
  /** Active legend keys (category/type). Empty ⇒ everything is fully shown. */
  activeKeys?: Set<string>;
  /** Open the reader at an arbitrary surah / juz / page (with optional anchor). */
  onOpen?: (target: ReaderTarget) => void;
  /** Convenience: open a surah at its top. Wraps `onOpen`. */
  onSelectSurah?: (id: number) => void;
  /** A small mark (bar, point, box) was hit. The dashboard opens the reader
   *  on a mouse click but only selects on a tap, so the readout can be read
   *  first; without it, charts fall back to `onOpen`. */
  onMark?: (target: ReaderTarget) => void;
}

/** Report a hit on a mark (see `ChartContext.onMark`). */
export function hitMark(ctx: ChartContext, target: ReaderTarget): void {
  (ctx.onMark ?? ctx.onOpen)?.(target);
}

/** The legend key a datum is coloured by under the current colour mode. */
export function surahKey(d: SurahDatum, ctx: ChartContext): string {
  return ctx.colorMode === "fawatih" ? d.category : d.type;
}

export function surahColor(d: SurahDatum, ctx: ChartContext): string {
  if (ctx.colorMode === "fawatih") {
    return FAWATIH_COLORS[d.category] ?? FAWATIH_COLORS.Unknown;
  }
  return d.type === "Meccan" ? ctx.palette.pie[0] : ctx.palette.pie[1];
}

/** Fade datums whose legend key is filtered out (empty selection ⇒ all shown). */
export function surahOpacity(d: SurahDatum, ctx: ChartContext): number {
  if (!ctx.activeKeys || ctx.activeKeys.size === 0) return 1;
  return ctx.activeKeys.has(surahKey(d, ctx)) ? 1 : 0.18;
}

/** Recharts hover band behind the active bar (reads on light and dark). */
export const CURSOR_FILL = "rgba(148,163,184,0.12)";

export function axisColor(dark: boolean): string {
  return dark ? "#94a3b8" : "#64748b";
}

export function gridColor(dark: boolean): string {
  return dark ? "#334155" : "#e2e8f0";
}
