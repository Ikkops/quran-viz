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

/** Language name for an edition code; with `locale`, localized through
 *  `Intl.DisplayNames` (falls back to the English table). */
export function langName(code: string, locale?: string): string {
  if (locale && !locale.startsWith("en")) {
    try {
      const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
      if (name && name !== code) return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      /* unsupported code or runtime: use the table */
    }
  }
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

/** Groups translation editions by language for grouped selects. `locale`
 *  localizes the group labels; `first` (a language code) is listed first,
 *  then English, then the rest alphabetically. */
export function groupTranslations(
  index: EditionsIndex,
  locale?: string,
  first = "en",
): EditionGroup[] {
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
      label: langName(language, locale),
      editions: editions.sort((a, b) => a.englishName.localeCompare(b.englishName)),
    }))
    .sort((a, b) => {
      for (const lead of [first, "en"]) {
        if (a.language === lead) return -1;
        if (b.language === lead) return 1;
      }
      return a.label.localeCompare(b.label, locale);
    });
}

export function editionByIdentifier(
  index: EditionsIndex,
  id: string,
): Edition | undefined {
  return index.editions.find((e) => e.identifier === id);
}

export interface TafsirEdition {
  id: string;
  label: string;
  lang: "ar" | "id";
  /** `ayah`: one note per ayah, a translation-style file (`useTranslation`).
   *  `grouped`: one note per passage, per-surah files (`useGroupedTafsir`). */
  kind: "ayah" | "grouped";
  /** Provenance line shown under the note. */
  source: string;
}

export const TAFSIR_EDITIONS: TafsirEdition[] = [
  {
    id: "ar.muyassar",
    label: "Al-Muyassar (Arabic)",
    lang: "ar",
    kind: "ayah",
    source: "Al-Tafsir al-Muyassar",
  },
  {
    id: "ar.jalalayn",
    label: "Al-Jalalayn (Arabic)",
    lang: "ar",
    kind: "ayah",
    source: "Tafsir al-Jalalayn",
  },
  {
    id: "id.mukhtasar-qul",
    label: "Al-Mukhtasar (Indonesia)",
    lang: "id",
    kind: "grouped",
    source: "Al-Mukhtasar fi Tafsir al-Qur'an (Indonesia), QUL tafsir resource 260",
  },
  {
    id: "id.saadi-qul",
    label: "As-Sa'di (Indonesia)",
    lang: "id",
    kind: "grouped",
    source: "As-Sa'di, Taysir al-Karim al-Rahman (Indonesia), QUL tafsir resource 503",
  },
];

export function tafsirById(id: string): TafsirEdition {
  return TAFSIR_EDITIONS.find((t) => t.id === id) ?? TAFSIR_EDITIONS[0];
}
export const TRANSLITERATION_EDITION = "en.transliteration";
