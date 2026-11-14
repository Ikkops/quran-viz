/** A bookmarked ayah: global ayah id, optional note, when it was added. */
export interface Bookmark {
  id: number;
  note: string;
  at: number;
}

export const BOOKMARKS_KEY = "qv.bookmarks";
const MAX_AYAH = 6236;

/** Sanitizer for stored bookmarks: drops malformed or duplicate entries. */
export function sanitizeBookmarks(raw: unknown): Bookmark[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<number>();
  const out: Bookmark[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const { id, note, at } = b as Record<string, unknown>;
    if (typeof id !== "number" || !Number.isInteger(id) || id < 1 || id > MAX_AYAH)
      continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      note: typeof note === "string" ? note.slice(0, 500) : "",
      at: typeof at === "number" && Number.isFinite(at) ? at : 0,
    });
  }
  return out;
}
