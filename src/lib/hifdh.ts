// What a learner has memorised, kept by ayah so it holds whichever printed
// layout is chosen (page breaks differ between the Madinah and IndoPak
// mushafs), and the words they stumbled on while testing themselves.
// Stored as `qv.hifdh`.

export const HIFDH_KEY = "qv.hifdh";
const AYAHS = 6236;

/** 0 not started · 1 memorising · 2 memorised · 3 memorised but weak. */
export type HifdhStatus = 0 | 1 | 2 | 3;
export const HIFDH_STATUSES: readonly HifdhStatus[] = [0, 1, 2, 3];

export interface Stumble {
  /** How many times the word had to be peeked at. */
  n: number;
  at: number;
}

export interface Hifdh {
  /** One digit per ayah, in mushaf order: the ayah's `HifdhStatus`. */
  status: string;
  /** Keyed `"<ayah id>:<word index>"` (word index from 0). */
  stumbles: Record<string, Stumble>;
}

export const emptyHifdh = (): Hifdh => ({ status: "0".repeat(AYAHS), stumbles: {} });

/** Keep stored hifdh data only in the shape above; anything else starts empty. */
export function sanitizeHifdh(raw: unknown): Hifdh | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.status !== "string" || !/^[0-3]*$/.test(r.status)) return undefined;
  const status = r.status.slice(0, AYAHS).padEnd(AYAHS, "0");
  const stumbles: Record<string, Stumble> = {};
  if (r.stumbles && typeof r.stumbles === "object")
    for (const [k, v] of Object.entries(r.stumbles as Record<string, unknown>)) {
      const s = v as Partial<Stumble> | null;
      if (
        /^\d+:\d+$/.test(k) &&
        s &&
        Number.isInteger(s.n) &&
        (s.n as number) > 0 &&
        typeof s.at === "number"
      )
        stumbles[k] = { n: s.n as number, at: s.at };
    }
  return { status, stumbles };
}

export const statusOf = (h: Hifdh, id: number): HifdhStatus =>
  (Number(h.status[id - 1]) || 0) as HifdhStatus;

/** Give every ayah from `from` to `to` (global ids, inclusive) one status. */
export function setStatus(h: Hifdh, from: number, to: number, s: HifdhStatus): Hifdh {
  const a = Math.max(1, Math.min(from, to));
  const b = Math.min(AYAHS, Math.max(from, to));
  if (b < a) return h;
  return {
    ...h,
    status: h.status.slice(0, a - 1) + String(s).repeat(b - a + 1) + h.status.slice(b),
  };
}

/** How many ayahs from `from` to `to` have each status, indexed by status. */
export function countStatus(h: Hifdh, from = 1, to = AYAHS): number[] {
  const n = [0, 0, 0, 0];
  for (let i = Math.max(1, from); i <= Math.min(AYAHS, to); i++) n[statusOf(h, i)]++;
  return n;
}

/** Ids of the ayahs whose status is one of `which`. */
export function ayahsWith(h: Hifdh, which: readonly HifdhStatus[]): number[] {
  const ids: number[] = [];
  for (let i = 1; i <= AYAHS; i++) if (which.includes(statusOf(h, i))) ids.push(i);
  return ids;
}

/** One more stumble on word `w` (from 0) of ayah `id`. */
export function addStumble(h: Hifdh, id: number, w: number, now: number): Hifdh {
  const key = `${id}:${w}`;
  return {
    ...h,
    stumbles: { ...h.stumbles, [key]: { n: (h.stumbles[key]?.n ?? 0) + 1, at: now } },
  };
}

export const stumbleCount = (h: Hifdh, id: number, w: number): number =>
  h.stumbles[`${id}:${w}`]?.n ?? 0;
