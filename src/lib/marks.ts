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
}

export interface CollectionItem {
  /** Global ayah id. */
  id: number;
  note: string;
  at: number;
}

export interface Collection {
  id: string;
  name: string;
  color: MarkColor;
  items: CollectionItem[];
}

export interface Marks {
  pins: Pin[];
  collections: Collection[];
}

const ayahOk = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_AYAH;
const colorOf = (c: unknown, fallback: MarkColor): MarkColor =>
  (MARK_COLORS as readonly unknown[]).includes(c) ? (c as MarkColor) : fallback;
const nameOf = (n: unknown): string =>
  typeof n === "string" ? n.trim().slice(0, NAME_MAX) : "";
const timeOf = (t: unknown): number =>
  typeof t === "number" && Number.isFinite(t) ? t : 0;

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
    });
  }
  const outCols: Collection[] = [];
  for (const c of collections) {
    if (!c || typeof c !== "object") continue;
    const x = c as Record<string, unknown>;
    const name = nameOf(x.name);
    if (!fresh(x.id) || !name) continue;
    outCols.push({
      id: x.id,
      name,
      color: colorOf(x.color, MARK_COLORS[1]),
      items: sanitizeBookmarks(x.items) ?? [],
    });
  }
  return { pins: outPins, collections: outCols };
}

const newId = (prefix: string, taken: { id: string }[]): string => {
  let n = taken.length + 1;
  while (taken.some((x) => x.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
};

/** Put a pin on an ayah (it leaves wherever it was); on the ayah it already
 *  marks, take it off. */
export function movePin(m: Marks, pinId: string, ayah: number, now = Date.now()): Marks {
  return {
    ...m,
    pins: m.pins.map((p) =>
      p.id !== pinId ? p : { ...p, ayah: p.ayah === ayah ? null : ayah, at: now },
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
    pins: [...m.pins, { id: newId("p", m.pins), name: n, color, ayah, at: now }],
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
  const items = ayah === null ? [] : [{ id: ayah, note: "", at: now }];
  return {
    ...m,
    collections: [
      ...m.collections,
      { id: newId("c", m.collections), name: n, color, items },
    ],
  };
}

/** Rename or recolour a pin or a collection (an empty name is ignored). */
export function editMark(
  m: Marks,
  id: string,
  change: { name?: string; color?: MarkColor },
): Marks {
  const apply = <T extends { id: string; name: string; color: MarkColor }>(x: T): T => {
    if (x.id !== id) return x;
    const name = change.name === undefined ? x.name : nameOf(change.name) || x.name;
    return { ...x, name, color: change.color ?? x.color };
  };
  return { pins: m.pins.map(apply), collections: m.collections.map(apply) };
}

export function deleteMark(m: Marks, id: string): Marks {
  return {
    pins: m.pins.filter((p) => p.id !== id),
    collections: m.collections.filter((c) => c.id !== id),
  };
}

/** Add the ayah to a collection, or take it out if it is there. */
export function toggleInCollection(
  m: Marks,
  collectionId: string,
  ayah: number,
  now = Date.now(),
): Marks {
  return {
    ...m,
    collections: m.collections.map((c) =>
      c.id !== collectionId
        ? c
        : {
            ...c,
            items: c.items.some((i) => i.id === ayah)
              ? c.items.filter((i) => i.id !== ayah)
              : [...c.items, { id: ayah, note: "", at: now }],
          },
    ),
  };
}

export function setItemNote(
  m: Marks,
  collectionId: string,
  ayah: number,
  note: string,
): Marks {
  return {
    ...m,
    collections: m.collections.map((c) =>
      c.id !== collectionId
        ? c
        : {
            ...c,
            items: c.items.map((i) =>
              i.id === ayah ? { ...i, note: note.slice(0, 500) } : i,
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
