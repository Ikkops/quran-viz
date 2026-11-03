export interface Palette {
  name: string;
  primary: string;
  pie: [string, string]; // [Meccan, Medinan]
}

export const PALETTES: Record<string, Palette> = {
  emerald: { name: "Emerald", primary: "#10b981", pie: ["#10b981", "#8b5cf6"] },
  blue: { name: "Ocean Blue", primary: "#3b82f6", pie: ["#3b82f6", "#f59e0b"] },
  sunset: { name: "Sunset", primary: "#f97316", pie: ["#f97316", "#0ea5e9"] },
  purple: { name: "Royal Purple", primary: "#8b5cf6", pie: ["#8b5cf6", "#ec4899"] },
};

export type PaletteKey = keyof typeof PALETTES;

/** Colours for the Fawatih (surah-opening) categories. */
export const FAWATIH_COLORS: Record<string, string> = {
  "Muqatta'at": "#8b5cf6",
  "Praise & Glorification": "#10b981",
  "Call (Nida')": "#3b82f6",
  "Statement / Narrative": "#64748b",
  "Divine Oath (Qasam)": "#f59e0b",
  "Condition / Event (Idha)": "#06b6d4",
  "Direct Command (Amr)": "#ef4444",
  "Question (Istifham)": "#ec4899",
  "Warning / Woe / Du'a": "#f97316",
  "Reasoning (Ta'lil)": "#84cc16",
  Unknown: "#cbd5e1",
};
