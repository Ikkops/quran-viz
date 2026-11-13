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
  /** When the work (and the Indonesian edition, where known) came out. */
  published: { en: string; id: string };
  /** Left out of the Android app and downloaded there on request; `bytes`
   *  is the size of its files under `public/data` (checked by a test). */
  download?: { bytes: number };
}

export const TAFSIR_EDITIONS: TafsirEdition[] = [
  {
    id: "ar.muyassar",
    label: "Al-Muyassar (Arabic)",
    lang: "ar",
    kind: "ayah",
    source: "Al-Tafsir al-Muyassar",
    published: {
      en: "King Fahd Complex, Madinah, 1419 AH (1998)",
      id: "Kompleks Raja Fahd, Madinah, 1419 H (1998)",
    },
  },
  {
    id: "ar.jalalayn",
    label: "Al-Jalalayn (Arabic)",
    lang: "ar",
    kind: "ayah",
    source: "Tafsir al-Jalalayn",
    published: {
      en: "Begun by al-Mahalli (d. 864 AH / 1459), completed by as-Suyuti c. 870 AH (1465)",
      id: "Dimulai al-Mahalli (w. 864 H / 1459), dirampungkan as-Suyuti sekitar 870 H (1465)",
    },
  },
  {
    id: "id.mukhtasar-qul",
    label: "Al-Mukhtasar (Indonesia)",
    lang: "id",
    kind: "grouped",
    source: "Al-Mukhtasar fi Tafsir al-Qur'an (Indonesia), QUL tafsir resource 260",
    published: {
      en: "Markaz Tafsir, Riyadh; 3rd revised ed. 1436 AH (2015)",
      id: "Markaz Tafsir, Riyadh; cetakan ke-3 (revisi) 1436 H (2015)",
    },
  },
  {
    id: "id.saadi-qul",
    label: "As-Sa'di (Indonesia)",
    lang: "id",
    kind: "grouped",
    source: "As-Sa'di, Taysir al-Karim al-Rahman (Indonesia), QUL tafsir resource 503",
    published: {
      en: "Written by Abd ar-Rahman as-Sa'di, completed 1344 AH (1926)",
      id: "Ditulis Abdurrahman as-Sa'di, rampung 1344 H (1926)",
    },
  },
  {
    id: "id.muntakhab",
    label: "Al-Muntakhab, Quraish Shihab (Indonesia)",
    lang: "id",
    kind: "ayah",
    source: "Tafsir al-Muntakhab, M. Quraish Shihab et al., via Tanzil",
    published: {
      en: "Arabic: Supreme Council for Islamic Affairs, Cairo; Indonesian translation: Cairo, 2001, supervised by M. Quraish Shihab",
      id: "Arab: Majelis Tinggi Urusan Islam, Kairo; terjemahan Indonesia: Kairo, 2001, di bawah supervisi M. Quraish Shihab",
    },
  },
  {
    id: "id.jalalayn",
    label: "Al-Jalalain (Indonesia)",
    lang: "id",
    kind: "ayah",
    source: "Tafsir al-Jalalain (Indonesian), Tanzil edition via api.alquran.cloud",
    published: {
      en: "Begun by al-Mahalli (d. 864 AH / 1459), completed by as-Suyuti c. 870 AH (1465)",
      id: "Dimulai al-Mahalli (w. 864 H / 1459), dirampungkan as-Suyuti sekitar 870 H (1465)",
    },
    download: { bytes: 2734461 },
  },
  {
    id: "id.kemenag-wajiz",
    label: "Tafsir Wajiz Kemenag (Indonesia)",
    lang: "id",
    kind: "grouped",
    source:
      "Tafsir Wajiz, Kementerian Agama RI (quran.kemenag.go.id), via gadingnst/quran-api",
    published: {
      en: "Published as Tafsir Ringkas by the Lajnah Pentashihan Mushaf Al-Qur'an, 2016",
      id: "Terbit sebagai Tafsir Ringkas, Lajnah Pentashihan Mushaf Al-Qur'an, 2016",
    },
    download: { bytes: 2981862 },
  },
  {
    id: "id.kemenag-tahlili",
    label: "Tafsir Kemenag (Tahlili)",
    lang: "id",
    kind: "grouped",
    source: "Tafsir Tahlili, Kementerian Agama RI, via equran.id",
    published: {
      en: "Al-Qur'an dan Tafsirnya: first ed. 1975–1980; revised ed. 2004–2008",
      id: "Al-Qur'an dan Tafsirnya: edisi pertama 1975–1980; edisi yang disempurnakan 2004–2008",
    },
    download: { bytes: 8114002 },
  },
];

/** An edition's files, as paths under `data/`. */
export function tafsirFiles(ed: TafsirEdition): string[] {
  if (ed.kind === "ayah") return [`translations/${ed.id}.json`];
  return Array.from({ length: 114 }, (_, i) => `tafsir/${ed.id}/${i + 1}.json`);
}

/** What the Android build leaves out of `dist/data` (files and folders). */
export const DOWNLOADED_TAFSIR_PATHS = TAFSIR_EDITIONS.filter((t) => t.download).map(
  (t) => (t.kind === "ayah" ? `translations/${t.id}.json` : `tafsir/${t.id}`),
);

export function tafsirById(id: string): TafsirEdition {
  return TAFSIR_EDITIONS.find((t) => t.id === id) ?? TAFSIR_EDITIONS[0];
}
export const TRANSLITERATION_EDITION = "en.transliteration";
