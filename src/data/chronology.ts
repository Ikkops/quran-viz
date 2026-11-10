import type {
  AsbabData,
  ChronoPeriod,
  ChronologyData,
  RevelationType,
  Surah,
  Verse,
} from "../types/quran";

export interface TimelineGroup {
  /** Index into the period's events, or null for surahs with no marker event. */
  event: number | null;
  surahs: Surah[];
}

export interface TimelinePeriod {
  period: ChronoPeriod;
  /** Surahs per marker event (chronological), unmarked surahs last. */
  groups: TimelineGroup[];
}

export interface TimelinePhase {
  phase: RevelationType;
  periods: TimelinePeriod[];
}

/** Groups (already filtered) surahs by phase → period → marker event, in
 *  chronological order; within a group, by revelation order. Periods with no
 *  surah are kept only when `keepEmpty` (so the unfiltered timeline still shows
 *  years like 7–8 AH as event-only rows). */
export function groupByTimeline(
  surahs: Surah[],
  chrono: ChronologyData,
  keepEmpty: boolean,
): TimelinePhase[] {
  const byPeriod = new Map<string, Map<number | null, Surah[]>>();
  for (const s of surahs) {
    const e = chrono.surahs[String(s.id)];
    if (!e) continue;
    const groups = byPeriod.get(e.period) ?? new Map<number | null, Surah[]>();
    const key = e.event ?? null;
    groups.set(key, [...(groups.get(key) ?? []), s]);
    byPeriod.set(e.period, groups);
  }
  const phases: TimelinePhase[] = [];
  for (const period of chrono.periods) {
    const groups = byPeriod.get(period.id);
    if (!groups && !keepEmpty) continue;
    const list: TimelineGroup[] = [...(groups?.entries() ?? [])]
      .map(([event, ss]) => ({
        event,
        surahs: [...ss].sort((a, b) => a.revelationOrder - b.revelationOrder),
      }))
      // Marker events in their (chronological) order, unmarked surahs last.
      .sort((a, b) => (a.event ?? Infinity) - (b.event ?? Infinity));
    let phase = phases[phases.length - 1];
    if (phase?.phase !== period.phase) {
      phase = { phase: period.phase, periods: [] };
      phases.push(phase);
    }
    phase.periods.push({ period, groups: list });
  }
  return phases;
}

/** Surah id → number of its ayahs covered by a verified asbab narration. */
export function asbabCountBySurah(
  asbab: AsbabData,
  verses: Verse[],
): Map<number, number> {
  const ids = new Set<number>();
  for (const [lo, hi] of asbab.items) for (let i = lo; i <= hi; i++) ids.add(i);
  const out = new Map<number, number>();
  for (const id of ids) {
    const v = verses[id - 1];
    if (v) out.set(v.s, (out.get(v.s) ?? 0) + 1);
  }
  return out;
}

/** "610–613" + phase span of a list of periods, e.g. "610–622". */
export function ceRange(periods: ChronoPeriod[]): string {
  const first = periods[0]?.ce.split("–")[0] ?? "";
  const last = periods[periods.length - 1]?.ce.split("–").pop() ?? "";
  return first === last ? first : `${first}–${last}`;
}
