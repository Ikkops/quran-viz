// Fawatih al-Suwar — the linguistic type of each surah's opening.
// A curated static lookup (per classical scholarship: al-Suyuti / al-Zarkashi)
// is used instead of regex on the Uthmani text, which misclassifies heavily.

export type FawatihCategory = keyof typeof CATEGORY_ORDER;

// Stable display order for the stacked-bar chart.
export const CATEGORY_ORDER = {
  "Muqatta'at": 0,
  "Praise & Glorification": 1,
  "Call (Nida')": 2,
  "Divine Oath (Qasam)": 3,
  "Direct Command (Amr)": 4,
  "Question (Istifham)": 5,
  "Condition / Event (Idha)": 6,
  "Warning / Woe / Du'a": 7,
  "Reasoning (Ta'lil)": 8,
  "Statement / Narrative": 9,
  Unknown: 10,
} as const;

const DEFAULT_CATEGORY = "Statement / Narrative";

// Surahs grouped by opening category. Anything not listed is a plain
// declarative/narrative opening (DEFAULT_CATEGORY).
const CATEGORY_SURAHS: Record<string, number[]> = {
  "Muqatta'at": [
    2, 3, 7, 10, 11, 12, 13, 14, 15, 19, 20, 26, 27, 28, 29, 30, 31, 32, 36, 38, 40, 41,
    42, 43, 44, 45, 46, 50, 68,
  ],
  "Praise & Glorification": [1, 6, 17, 18, 25, 34, 35, 57, 59, 61, 62, 64, 67, 87],
  "Call (Nida')": [4, 5, 22, 33, 49, 60, 65, 66],
  "Divine Oath (Qasam)": [
    37, 51, 52, 53, 75, 77, 79, 85, 86, 89, 90, 91, 92, 93, 95, 100, 103,
  ],
  "Direct Command (Amr)": [72, 96, 109, 112, 113, 114],
  "Question (Istifham)": [76, 78, 88, 94, 105, 107],
  "Condition / Event (Idha)": [56, 81, 82, 84, 99, 110],
  "Warning / Woe / Du'a": [83, 104, 111],
  "Reasoning (Ta'lil)": [106],
};

export const SURAH_CATEGORY: Record<number, string> = (() => {
  const map: Record<number, string> = {};
  for (const [category, surahs] of Object.entries(CATEGORY_SURAHS)) {
    for (const id of surahs) map[id] = category;
  }
  return map;
})();

/** Opening category for a surah (1–114). */
export function categorizeOpening(surahId: number): string {
  return SURAH_CATEGORY[surahId] ?? DEFAULT_CATEGORY;
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_ORDER);
