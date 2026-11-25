import { sanitizeBookmarks } from "./bookmarks";

// Two kinds of mark on an ayah:
// - a pin marks one place and moves when it is set somewhere else (where a
//   reading stopped: tilawah, memorisation, a study circle);
// - a collection keeps any number of ayahs (favourites, a theme), each with
//   an optional note.
// Both carry a name and a colour the learner chooses. Stored as `qv.marks`.

export const MARKS_KEY = "qv.marks";
const MAX_AYAH = 6236;
const NAME_MAX = 40;

/** Colours on offer: mid-tones that read on every theme's paper. */
export const MARK_COLORS = [
  "#C2410C",
  "#B7791F",
  "#15803D",
  "#0F8B8D",
  "#2563EB",
  "#7C3AED",
  "#C02672",
  "#64748B",
] as const;
export type MarkColor = (typeof MARK_COLORS)[number];

export interface Pin {
  id: string;
  name: string;
  color: MarkColor;
  /** Global ayah id, or null while the pin hasn't been placed. */
  ayah: number | null;
  at: number;
  /** Last change (ms); the newer one wins when devices sync. */
  t?: number;
}

export interface CollectionItem {
  /** Global ayah id. */
  id: number;
  note: string;
  at: number;
  /** Last change (ms), for sync. */
  t?: number;
}

export interface Collection {
  id: string;
  name: string;
  color: MarkColor;
  items: CollectionItem[];
  /** Last rename or recolour (ms), for sync. */
  t?: number;
}

export interface Marks {
  pins: Pin[];
  collections: Collection[];
  /** What was deleted and when (ms), so sync doesn't bring it back: keyed
   *  `p:<pin id>`, `c:<collection id>` or `i:<collection id>:<ayah>`. */
  gone?: Record<string, number>;
}

const ayahOk = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_AYAH;
const colorOf = (c: unknown, fallback: MarkColor): MarkColor =>
  (MARK_COLORS as readonly unknown[]).includes(c) ? (c as MarkColor) : fallback;
const nameOf = (n: unknown): string =>
  typeof n === "string" ? n.trim().slice(0, NAME_MAX) : "";
const timeOf = (t: unknown): number =>
  typeof t === "number" && Number.isFinite(t) ? t : 0;
/** `{ t }` when `t` is a time, else nothing (older data has none). */
const stampOf = (t: unknown): { t?: number } =>
  typeof t === "number" && Number.isFinite(t) ? { t } : {};
const GONE_KEY = /^(?:[pc]:[^:]+|i:[^:]+:\d+)$/;

/** The marks a new learner starts with: one pin and one collection, named in
 *  the interface language. Old flat bookmarks become the collection's items. */
export function initialMarks(
  names: { pin: string; collection: string },
  oldBookmarks: unknown = null,
): Marks {
  return {
    pins: [{ id: "p1", name: names.pin, color: MARK_COLORS[4], ayah: null, at: 0 }],
    collections: [
      {
        id: "c1",
        name: names.collection,
        color: MARK_COLORS[1],
        items: sanitizeBookmarks(oldBookmarks) ?? [],
      },
    ],
  };
}

export function sanitizeMarks(raw: unknown): Marks | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { pins, collections } = raw as Record<string, unknown>;
  if (!Array.isArray(pins) || !Array.isArray(collections)) return undefined;
  const ids = new Set<string>();
  const fresh = (id: unknown): id is string =>
    typeof id === "string" && id !== "" && !ids.has(id) && !!ids.add(id);
  const outPins: Pin[] = [];
  for (const p of pins) {
    if (!p || typeof p !== "object") continue;
    const x = p as Record<string, unknown>;
    const name = nameOf(x.name);
    if (!fresh(x.id) || !name) continue;
    outPins.push({
      id: x.id,
      name,
      color: colorOf(x.color, MARK_COLORS[4]),
      ayah: ayahOk(x.ayah) ? x.ayah : null,
      at: timeOf(x.at),
      ...stampOf(x.t),
    });
  }
  const outCols: Collection[] = [];
  for (const c of collections) {
    if (!c || typeof c !== "object") continue;
    const x = c as Record<string, unknown>;
    const name = nameOf(x.name);
    if (!fresh(x.id) || !name) continue;
    const rawItems = Array.isArray(x.items) ? (x.items as Record<string, unknown>[]) : [];
    outCols.push({
      id: x.id,
      name,
      color: colorOf(x.color, MARK_COLORS[1]),
      items: (sanitizeBookmarks(x.items) ?? []).map((b) => ({
        ...b,
        ...stampOf(rawItems.find((r) => r?.id === b.id)?.t),
      })),
      ...stampOf(x.t),
    });
  }
  const gone: Record<string, number> = {};
  const rawGone = (raw as Record<string, unknown>).gone;
  if (rawGone && typeof rawGone === "object")
    for (const [k, v] of Object.entries(rawGone as Record<string, unknown>))
      if (GONE_KEY.test(k) && typeof v === "number" && Number.isFinite(v)) gone[k] = v;
  return {
    pins: outPins,
    collections: outCols,
    ...(Object.keys(gone).length ? { gone } : {}),
  };
}

/** A new id, unique across devices (two devices adding a pin each must not
 *  both make "p2" and have sync take them for one). */
const newId = (prefix: string, taken: { id: string }[], now: number): string => {
  let id: string;
  do id = `${prefix}${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  while (taken.some((x) => x.id === id));
  return id;
};
const gone = (m: Marks, key: string, now: number) => ({ ...m.gone, [key]: now });

/** Put a pin on an ayah (it leaves wherever it was); on the ayah it already
 *  marks, take it off. */
export function movePin(m: Marks, pinId: string, ayah: number, now = Date.now()): Marks {
  return {
    ...m,
    pins: m.pins.map((p) =>
      p.id !== pinId ? p : { ...p, ayah: p.ayah === ayah ? null : ayah, at: now, t: now },
    ),
  };
}

export function addPin(
  m: Marks,
  name: string,
  color: MarkColor,
  ayah: number | null = null,
  now = Date.now(),
): Marks {
  const n = nameOf(name);
  if (!n) return m;
  return {
    ...m,
    pins: [
      ...m.pins,
      { id: newId("p", m.pins, now), name: n, color, ayah, at: now, t: now },
    ],
  };
}

export function addCollection(
  m: Marks,
  name: string,
  color: MarkColor,
  ayah: number | null = null,
  now = Date.now(),
): Marks {
  const n = nameOf(name);
  if (!n) return m;
  const items = ayah === null ? [] : [{ id: ayah, note: "", at: now, t: now }];
  return {
    ...m,
    collections: [
      ...m.collections,
      { id: newId("c", m.collections, now), name: n, color, items, t: now },
    ],
  };
}

/** Rename or recolour a pin or a collection (an empty name is ignored). */
export function editMark(
  m: Marks,
  id: string,
  change: { name?: string; color?: MarkColor },
  now = Date.now(),
): Marks {
  const apply = <T extends { id: string; name: string; color: MarkColor }>(x: T): T => {
    if (x.id !== id) return x;
    const name = change.name === undefined ? x.name : nameOf(change.name) || x.name;
    return { ...x, name, color: change.color ?? x.color, t: now };
  };
  return { ...m, pins: m.pins.map(apply), collections: m.collections.map(apply) };
}

export function deleteMark(m: Marks, id: string, now = Date.now()): Marks {
  const kind = m.pins.some((p) => p.id === id) ? "p" : "c";
  return {
    pins: m.pins.filter((p) => p.id !== id),
    collections: m.collections.filter((c) => c.id !== id),
    gone: gone(m, `${kind}:${id}`, now),
  };
}

/** Add the ayah to a collection, or take it out if it is there. */
export function toggleInCollection(
  m: Marks,
  collectionId: string,
  ayah: number,
  now = Date.now(),
): Marks {
  const c = m.collections.find((x) => x.id === collectionId);
  if (!c) return m;
  const had = c.items.some((i) => i.id === ayah);
  return {
    ...m,
    collections: m.collections.map((x) =>
      x !== c
        ? x
        : {
            ...x,
            items: had
              ? x.items.filter((i) => i.id !== ayah)
              : [...x.items, { id: ayah, note: "", at: now, t: now }],
          },
    ),
    ...(had ? { gone: gone(m, `i:${collectionId}:${ayah}`, now) } : {}),
  };
}

export function setItemNote(
  m: Marks,
  collectionId: string,
  ayah: number,
  note: string,
  now = Date.now(),
): Marks {
  return {
    ...m,
    collections: m.collections.map((c) =>
      c.id !== collectionId
        ? c
        : {
            ...c,
            items: c.items.map((i) =>
              i.id === ayah ? { ...i, note: note.slice(0, 500), t: now } : i,
            ),
          },
    ),
  };
}

/** Every marked ayah, once (for the map's dots). */
export function markedAyahs(m: Marks): number[] {
  const out = new Set<number>();
  for (const p of m.pins) if (p.ayah !== null) out.add(p.ayah);
  for (const c of m.collections) for (const i of c.items) out.add(i.id);
  return [...out];
}

/** Per ayah: the pins on it and the collections holding it. */
export function marksByAyah(
  m: Marks,
): Map<number, { pins: Pin[]; collections: Collection[] }> {
  const out = new Map<number, { pins: Pin[]; collections: Collection[] }>();
  const at = (id: number) => {
    let e = out.get(id);
    if (!e) out.set(id, (e = { pins: [], collections: [] }));
    return e;
  };
  for (const p of m.pins) if (p.ayah !== null) at(p.ayah).pins.push(p);
  for (const c of m.collections) for (const i of c.items) at(i.id).collections.push(c);
  return out;
}
