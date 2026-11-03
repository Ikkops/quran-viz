import type { Edition, EditionsIndex } from "../types/quran";

export const LANG_NAMES: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  fa: "Persian",
  tr: "Turkish",
  ur: "Urdu",
  ru: "Russian",
  zh: "Chinese",
  de: "German",
  sq: "Albanian",
  id: "Indonesian",
  hi: "Hindi",
  fr: "French",
  es: "Spanish",
  cs: "Czech",
  bs: "Bosnian",
  az: "Azerbaijani",
  uz: "Uzbek",
  ug: "Uyghur",
  tt: "Tatar",
  th: "Thai",
  tg: "Tajik",
  ta: "Tamil",
  sw: "Swahili",
  sv: "Swedish",
  so: "Somali",
  si: "Sinhala",
  sd: "Sindhi",
  ro: "Romanian",
  pt: "Portuguese",
  pl: "Polish",
  no: "Norwegian",
  nl: "Dutch",
  ms: "Malay",
  ml: "Malayalam",
  ku: "Kurdish",
  ko: "Korean",
  ja: "Japanese",
  it: "Italian",
  ha: "Hausa",
  dv: "Divehi",
  bn: "Bengali",
  bg: "Bulgarian",
};

export function langName(code: string): string {
  return LANG_NAMES[code] ?? code.toUpperCase();
}

export function isRtl(code: string): boolean {
  return ["ar", "fa", "ur", "ps", "sd", "ug", "dv", "ku"].includes(code);
}

export interface EditionGroup {
  language: string;
  label: string;
  editions: Edition[];
}

/** Groups translation editions by language for grouped selects. */
export function groupTranslations(index: EditionsIndex): EditionGroup[] {
  const byLang = new Map<string, Edition[]>();
  for (const e of index.editions) {
    if (e.type !== "translation") continue;
    const arr = byLang.get(e.language) ?? [];
    arr.push(e);
    byLang.set(e.language, arr);
  }
  return [...byLang.entries()]
    .map(([language, editions]) => ({
      language,
      label: langName(language),
      editions: editions.sort((a, b) => a.englishName.localeCompare(b.englishName)),
    }))
    .sort((a, b) => {
      // English first, then alphabetical by language label.
      if (a.language === "en") return -1;
      if (b.language === "en") return 1;
      return a.label.localeCompare(b.label);
    });
}

export function editionByIdentifier(
  index: EditionsIndex,
  id: string,
): Edition | undefined {
  return index.editions.find((e) => e.identifier === id);
}

export const TAFSIR_EDITIONS = ["ar.muyassar", "ar.jalalayn"];
export const TRANSLITERATION_EDITION = "en.transliteration";
