import { DARK_TOKENS, LIGHT_TOKENS } from "./tokens";

/**
 * A palette is the accent only (DESIGN.md "Lapis Illumination"). The revelation
 * colours — `pie` ([Meccan, Medinan]) and `hijra` — are fixed by the Revelation
 * Rule and filled in per theme by `resolvePalette`, so every palette and both
 * themes draw Makkiyah, Madaniyah and Hijra the same way.
 */
export interface Palette {
  name: string;
  /** Accent on the light paper. */
  primary: string;
  /** Accent on the night paper. */
  primaryDark: string;
  pie: [string, string]; // [Meccan, Medinan]
  hijra: string;
}

const revelation = (dark: boolean): Pick<Palette, "pie" | "hijra"> => {
  const t = dark ? DARK_TOKENS : LIGHT_TOKENS;
  return { pie: [t.makki, t.madani], hijra: t.hijra };
};

export const PALETTES: Record<string, Palette> = {
  lapis: {
    name: "Lapis",
    primary: LIGHT_TOKENS.illumination,
    primaryDark: DARK_TOKENS.illumination,
    ...revelation(false),
  },
  plum: {
    name: "Plum",
    primary: "#7A3E8E",
    primaryDark: "#C99BDB",
    ...revelation(false),
  },
  ink: { name: "Ink", primary: "#2F3B52", primaryDark: "#B9C3D6", ...revelation(false) },
};

export type PaletteKey = keyof typeof PALETTES;
export const DEFAULT_PALETTE: PaletteKey = "lapis";

/** The palette as drawn in the current theme: night accent and revelation colours. */
export function resolvePalette(key: PaletteKey, dark: boolean): Palette {
  const p = PALETTES[key] ?? PALETTES[DEFAULT_PALETTE];
  return { ...p, primary: dark ? p.primaryDark : p.primary, ...revelation(dark) };
}

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
