import type { Edition } from "../types/quran";

/** Preferred translation per UI language when the reader's edition is in another one. */
const PREFERRED: Record<string, string> = {
  id: "id.kemenag-qul",
  en: "en.sahih",
};

/** A query typed in Latin script (no Arabic letters): a translation word or a name. */
export function isLatinQuery(q: string): boolean {
  return /\p{Script=Latin}/u.test(q) && !/\p{Script=Arabic}/u.test(q);
}

/**
 * The translation a Latin-script search looks in: the reader's edition when it is
 * in the UI language, else that language's preferred (or first) edition, else the
 * reader's edition. An Indonesian learner typing "sabar" searches an Indonesian
 * translation even while reading Sahih International.
 */
export function searchEditionFor(
  lang: string,
  readerEdition: string,
  editions: Edition[],
): string {
  const byId = new Map(editions.map((e) => [e.identifier, e]));
  if (byId.get(readerEdition)?.language === lang) return readerEdition;
  const preferred = PREFERRED[lang];
  if (preferred && byId.get(preferred)?.type === "translation") return preferred;
  const first = editions.find((e) => e.language === lang && e.type === "translation");
  return first?.identifier ?? readerEdition;
}
