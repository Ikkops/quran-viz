// "Last read": where each recent stretch of reading stopped. Scrolling on
// through a surah moves the newest entry along with it; opening somewhere else
// starts a new entry. Stored as `qv.lastRead.list`, newest first.

export interface ReadStretch {
  /** Global ayah id the stretch stopped on. */
  id: number;
  /** Surah of that ayah (a stretch stays within one surah). */
  s: number;
  at: number;
}

export const LAST_READ_KEY = "qv.lastRead.list";
export const LAST_READ_COUNTS = [1, 3, 5, 10] as const;
export const DEFAULT_LAST_READ_COUNT = 5;
const MAX_KEPT = 10;
const MAX_AYAH = 6236;
/** Moving at most this many ayahs from the newest entry continues its stretch. */
export const STRETCH_REACH = 40;

export function sanitizeLastRead(raw: unknown): ReadStretch[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ReadStretch[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const { id, s, at } = x as Record<string, unknown>;
    if (typeof id !== "number" || !Number.isInteger(id) || id < 1 || id > MAX_AYAH)
      continue;
    if (typeof s !== "number" || !Number.isInteger(s) || s < 1 || s > 114) continue;
    if (out.some((e) => e.s === s)) continue;
    out.push({ id, s, at: typeof at === "number" && Number.isFinite(at) ? at : 0 });
  }
  return out.slice(0, MAX_KEPT);
}

/**
 * Record that `id` (in surah `s`) is being read. The newest entry moves there
 * when it is the same surah and within reach (reading on, or scrolling back a
 * little); otherwise a new entry goes on top. A surah appears once: an older
 * entry for it is replaced, so two stretches never sit side by side in one
 * surah. The list keeps at most ten; the screen shows as many as the setting says.
 */
export function recordRead(
  list: ReadStretch[],
  id: number,
  s: number,
  now: number,
): ReadStretch[] {
  const top = list[0];
  if (top && top.id === id) return list;
  if (top && top.s === s && Math.abs(top.id - id) <= STRETCH_REACH)
    return [{ id, s, at: now }, ...list.slice(1)];
  return [{ id, s, at: now }, ...list.filter((e) => e.s !== s)].slice(0, MAX_KEPT);
}
