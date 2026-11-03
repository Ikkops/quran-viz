import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PALETTES, type Palette, type PaletteKey } from "./palettes";

interface ThemeState {
  paletteKey: PaletteKey;
  setPaletteKey: (k: PaletteKey) => void;
  palette: Palette;
  /** Optional custom primary colour overriding the palette primary. */
  customPrimary: string | null;
  setCustomPrimary: (c: string | null) => void;
  /** Resolved primary colour (custom takes precedence). */
  primary: string;
  dark: boolean;
  toggleDark: () => void;
  /** Arabic reading font (CSS family) and size multiplier for verse text. */
  arabicFont: string;
  setArabicFont: (f: string) => void;
  arabicScale: number;
  setArabicScale: (s: number) => void;
  /** Export the current theme as a shareable base64 code string. */
  exportTheme: () => string;
  /** Import and apply a theme from a code string. Returns true on success. */
  importTheme: (code: string) => boolean;
}

const ThemeContext = createContext<ThemeState | null>(null);

const STORAGE_KEY = "quranviz.theme";

export const ARABIC_FONTS = [
  "Amiri Quran",
  "Amiri",
  "Scheherazade New",
  "Noto Naskh Arabic",
  "Markazi Text",
  "Lateef",
];

interface Persisted {
  paletteKey: PaletteKey;
  customPrimary: string | null;
  dark: boolean;
  arabicFont: string;
  arabicScale: number;
}

function load(): Persisted {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const defaults: Persisted = {
    paletteKey: "emerald",
    customPrimary: null,
    dark: !!prefersDark,
    arabicFont: "Amiri Quran",
    arabicScale: 1,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    /* ignore */
  }
  return defaults;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = load();
  const [paletteKey, setPaletteKey] = useState<PaletteKey>(initial.paletteKey);
  const [customPrimary, setCustomPrimary] = useState<string | null>(
    initial.customPrimary,
  );
  const [dark, setDark] = useState<boolean>(initial.dark);
  const [arabicFont, setArabicFont] = useState<string>(initial.arabicFont);
  const [arabicScale, setArabicScale] = useState<number>(initial.arabicScale);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-arabic", `"${arabicFont}", "Amiri", serif`);
    root.style.setProperty("--arabic-scale", String(arabicScale));
  }, [arabicFont, arabicScale]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ paletteKey, customPrimary, dark, arabicFont, arabicScale }),
    );
  }, [paletteKey, customPrimary, dark, arabicFont, arabicScale]);

  const value = useMemo<ThemeState>(() => {
    const palette = PALETTES[paletteKey];
    const exportTheme = (): string => {
      const payload: Persisted = {
        paletteKey,
        customPrimary,
        dark,
        arabicFont,
        arabicScale,
      };
      return btoa(encodeURIComponent(JSON.stringify(payload)));
    };
    const importTheme = (code: string): boolean => {
      try {
        const payload = JSON.parse(
          decodeURIComponent(atob(code.trim())),
        ) as Partial<Persisted>;
        if (payload.paletteKey && payload.paletteKey in PALETTES)
          setPaletteKey(payload.paletteKey);
        if ("customPrimary" in payload) setCustomPrimary(payload.customPrimary ?? null);
        if (typeof payload.dark === "boolean") setDark(payload.dark);
        if (payload.arabicFont) setArabicFont(payload.arabicFont);
        if (typeof payload.arabicScale === "number") setArabicScale(payload.arabicScale);
        return true;
      } catch {
        return false;
      }
    };
    return {
      paletteKey,
      setPaletteKey,
      palette,
      customPrimary,
      setCustomPrimary,
      primary: customPrimary ?? palette.primary,
      dark,
      toggleDark: () => setDark((d) => !d),
      arabicFont,
      setArabicFont,
      arabicScale,
      setArabicScale,
      exportTheme,
      importTheme,
    };
  }, [paletteKey, customPrimary, dark, arabicFont, arabicScale]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
