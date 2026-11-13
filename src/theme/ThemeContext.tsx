import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_PALETTE,
  PALETTES,
  resolvePalette,
  type Palette,
  type PaletteKey,
} from "./palettes";
import {
  THEMES,
  THEME_NAMES,
  hexToChannels,
  setActiveTheme,
  type ThemeName,
} from "./tokens";

/** A named theme, or the device's light/dark setting. */
export type ThemeChoice = ThemeName | "system";
export const THEME_CHOICES: readonly ThemeChoice[] = ["system", ...THEME_NAMES];

interface ThemeState {
  paletteKey: PaletteKey;
  setPaletteKey: (k: PaletteKey) => void;
  palette: Palette;
  /** Optional custom primary colour overriding the palette primary. */
  customPrimary: string | null;
  setCustomPrimary: (c: string | null) => void;
  /** Resolved primary colour (custom takes precedence). */
  primary: string;
  /** The chosen theme ("system" follows the device). */
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  /** The theme on screen. */
  themeName: ThemeName;
  /** Its base: true on the dark themes (night colours, `dark:` classes). */
  dark: boolean;
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

// Every font here must cover the Quranic marks (U+06D6–U+06ED). Markazi Text
// was dropped: it lacks 22 of them (waqf signs, small meem/waw/yeh, sifr), so
// the browser drew those from a fallback font, out of place.
export const ARABIC_FONTS = [
  "KFGQPC Hafs",
  "Amiri Quran",
  "Amiri",
  "Scheherazade New",
  "Noto Naskh Arabic",
  "Lateef",
];
const DEFAULT_FONT = ARABIC_FONTS[0];
const knownFont = (f: unknown): string | undefined =>
  typeof f === "string" && ARABIC_FONTS.includes(f) ? f : undefined;

const systemScheme = () =>
  typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-color-scheme: dark)")
    : undefined;

interface Persisted {
  paletteKey: PaletteKey;
  customPrimary: string | null;
  theme: ThemeChoice;
  arabicFont: string;
  arabicScale: number;
}

function load(): Persisted {
  const defaults: Persisted = {
    paletteKey: DEFAULT_PALETTE,
    customPrimary: null,
    theme: "system",
    arabicFont: DEFAULT_FONT,
    arabicScale: 1,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Persisted> & { dark?: boolean };
      const saved = { ...defaults, ...stored };
      return {
        ...saved,
        // Before named themes there was only a dark switch.
        theme: (THEME_CHOICES as readonly string[]).includes(stored.theme ?? "")
          ? saved.theme
          : typeof stored.dark === "boolean"
            ? stored.dark
              ? "dark"
              : "light"
            : "system",
        // Palettes before the redesign (emerald, blue, sunset, purple) fall back to lapis.
        paletteKey: saved.paletteKey in PALETTES ? saved.paletteKey : DEFAULT_PALETTE,
        // Settings saved before named themes also predate the KFGQPC face,
        // which is now the default: move them to it once.
        arabicFont:
          stored.theme === undefined
            ? DEFAULT_FONT
            : (knownFont(saved.arabicFont) ?? DEFAULT_FONT),
      };
    }
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
  const [theme, setTheme] = useState<ThemeChoice>(initial.theme);
  const [systemDark, setSystemDark] = useState(() => !!systemScheme()?.matches);
  useEffect(() => {
    const mq = systemScheme();
    if (!mq) return;
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const themeName: ThemeName =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const dark = THEMES[themeName].dark;
  // Named before children render, so canvas code reads the right colours.
  setActiveTheme(themeName);
  const [arabicFont, setArabicFont] = useState<string>(initial.arabicFont);
  const [arabicScale, setArabicScale] = useState<number>(initial.arabicScale);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset.theme = themeName;
    // Browser/Android chrome colour follows the app's paper, not the OS scheme.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEMES[themeName].tokens.paper);
  }, [dark, themeName]);

  // The chosen accent drives the `illumination` token (links, focus, selection).
  useEffect(() => {
    // Lapis is each theme's own illumination token; other accents come in a
    // day and a night value.
    const accent =
      customPrimary ??
      (paletteKey === DEFAULT_PALETTE
        ? THEMES[themeName].tokens.illumination
        : resolvePalette(paletteKey, dark).primary);
    if (/^#[0-9a-f]{6}$/i.test(accent))
      document.documentElement.style.setProperty("--illumination", hexToChannels(accent));
  }, [paletteKey, customPrimary, dark, themeName]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-arabic", `"${arabicFont}", "Amiri", serif`);
    root.style.setProperty("--arabic-scale", String(arabicScale));
  }, [arabicFont, arabicScale]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ paletteKey, customPrimary, theme, arabicFont, arabicScale }),
    );
  }, [paletteKey, customPrimary, theme, arabicFont, arabicScale]);

  const value = useMemo<ThemeState>(() => {
    const palette = resolvePalette(paletteKey, dark);
    const exportTheme = (): string => {
      const payload: Persisted = {
        paletteKey,
        customPrimary,
        theme,
        arabicFont,
        arabicScale,
      };
      return btoa(encodeURIComponent(JSON.stringify(payload)));
    };
    const importTheme = (code: string): boolean => {
      try {
        const payload = JSON.parse(
          decodeURIComponent(atob(code.trim())),
        ) as Partial<Persisted> & { dark?: boolean };
        if (payload.paletteKey && payload.paletteKey in PALETTES)
          setPaletteKey(payload.paletteKey);
        if ("customPrimary" in payload) setCustomPrimary(payload.customPrimary ?? null);
        if ((THEME_CHOICES as readonly string[]).includes(payload.theme ?? ""))
          setTheme(payload.theme!);
        else if (typeof payload.dark === "boolean")
          setTheme(payload.dark ? "dark" : "light");
        const font = knownFont(payload.arabicFont);
        if (font) setArabicFont(font);
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
      theme,
      setTheme,
      themeName,
      dark,
      arabicFont,
      setArabicFont,
      arabicScale,
      setArabicScale,
      exportTheme,
      importTheme,
    };
  }, [paletteKey, customPrimary, dark, theme, themeName, arabicFont, arabicScale]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** The chosen Qur'an font; the default outside the provider (tests). */
export function useArabicFont(): string {
  return useContext(ThemeContext)?.arabicFont ?? DEFAULT_FONT;
}
