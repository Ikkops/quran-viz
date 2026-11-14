// Translator footnotes (`footnotes/<edition>.json`, from the ETL): for each
// ayah id, [offset into the edition's text, note]. Only some editions have
// them.

import { useEffect, useState } from "react";
import { dataUrl } from "./base";

export const FOOTNOTE_EDITIONS: readonly string[] = [
  "id.kemenag-qul",
  "id.kfc-qul",
  "id.sabiq-qul",
  "en.sahih",
];

export type Footnotes = Record<string, [number, string][]>;

const cache = new Map<string, Footnotes>();
const inflight = new Map<string, Promise<Footnotes>>();

function load(id: string): Promise<Footnotes> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(id);
  if (!p) {
    p = fetch(dataUrl(`footnotes/${id}.json`))
      .then((r) => {
        if (!r.ok) throw new Error(`footnotes/${id}.json: ${r.status}`);
        return r.json() as Promise<Footnotes>;
      })
      .then((d) => {
        cache.set(id, d);
        return d;
      })
      .finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  return p;
}

/** Footnotes of the given editions that have them (others are skipped). A
 *  failed load just means no notes. */
export function useFootnotes(ids: string[]): Record<string, Footnotes> {
  const want = ids.filter((id) => FOOTNOTE_EDITIONS.includes(id));
  const key = want.join("|");
  const [, bump] = useState(0);
  useEffect(() => {
    let alive = true;
    for (const id of want)
      if (!cache.has(id))
        load(id).then(
          () => alive && bump((n) => n + 1),
          () => undefined,
        );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const out: Record<string, Footnotes> = {};
  for (const id of want) {
    const hit = cache.get(id);
    if (hit) out[id] = hit;
  }
  return out;
}
