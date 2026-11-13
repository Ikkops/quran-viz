/**
 * Design tokens ("Mushaf sebagai instrumen", see DESIGN.md).
 *
 * This file is the source of truth for colour values. `src/index.css` mirrors
 * them as RGB-channel CSS variables (`--ink: 27 34 48`) so Tailwind classes like
 * `text-ink` or `bg-makki/10` work; `tokens.test.ts` fails if the two drift.
 * Use the JS values where a CSS variable can't reach: SVG attributes (Recharts
 * fills), canvas, and PNG export.
 */
export const TOKEN_NAMES = [
  "paper",
  "surface",
  "surface-sunken",
  "line",
  "ink",
  "ink-muted",
  "ink-subtle",
  "makki",
  "madani",
  "hijra",
  "illumination",
  "rubric",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type TokenSet = Record<TokenName, string>;

export const LIGHT_TOKENS: TokenSet = {
  paper: "#F7F8F5",
  surface: "#FFFFFF",
  "surface-sunken": "#EDEFEA",
  line: "#D9DDD4",
  ink: "#1B2230",
  "ink-muted": "#4B5566",
  "ink-subtle": "#5F6878",
  makki: "#985D16",
  madani: "#0E7A5F",
  hijra: "#56658A",
  illumination: "#1F4FA0",
  rubric: "#B23A2A",
};

export const DARK_TOKENS: TokenSet = {
  paper: "#0E1320",
  surface: "#161C2C",
  "surface-sunken": "#0A0E18",
  line: "#283149",
  ink: "#E6E9EF",
  "ink-muted": "#AEB6C5",
  "ink-subtle": "#8F98AB",
  makki: "#D9A05A",
  madani: "#46B996",
  hijra: "#93A2C4",
  illumination: "#86A9EE",
  rubric: "#E87A68",
};

/** Named themes. Each is a full token set on a light or a dark base; the base
 *  decides the `dark` class (Tailwind `dark:` utilities, night tajweed colours). */
export const THEME_NAMES = [
  "light",
  "cream",
  "sepia",
  "dark",
  "warm-dark",
  "black",
] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEMES: Record<ThemeName, { dark: boolean; tokens: TokenSet }> = {
  light: { dark: false, tokens: LIGHT_TOKENS },
  // Warm off-white: a cream page.
  cream: {
    dark: false,
    tokens: {
      ...LIGHT_TOKENS,
      paper: "#FBF6EC",
      surface: "#FFFDF8",
      "surface-sunken": "#F2EBDC",
      line: "#E0D6C2",
      ink: "#2A241B",
      "ink-muted": "#584E3F",
      "ink-subtle": "#665B4B",
      makki: "#8E5612",
      madani: "#0C7058",
      hijra: "#505E83",
      rubric: "#A93626",
    },
  },
  // Brown paper.
  sepia: {
    dark: false,
    tokens: {
      ...LIGHT_TOKENS,
      paper: "#F1E4CC",
      surface: "#F8EEDB",
      "surface-sunken": "#E8D9BC",
      line: "#D0BD99",
      ink: "#33241A",
      "ink-muted": "#54402D",
      "ink-subtle": "#5F4A35",
      makki: "#7C4A0C",
      madani: "#0A5C48",
      hijra: "#45527A",
      illumination: "#1C4690",
      rubric: "#992F20",
    },
  },
  dark: { dark: true, tokens: DARK_TOKENS },
  // Brown-black: night reading without the blue cast.
  "warm-dark": {
    dark: true,
    tokens: {
      ...DARK_TOKENS,
      paper: "#1A1512",
      surface: "#241D18",
      "surface-sunken": "#130F0C",
      line: "#3A2F27",
      ink: "#EDE4D8",
      "ink-muted": "#C2B5A5",
      "ink-subtle": "#A39584",
    },
  },
  // True black, for OLED screens.
  black: {
    dark: true,
    tokens: {
      ...DARK_TOKENS,
      paper: "#000000",
      surface: "#0F0F12",
      "surface-sunken": "#070709",
      line: "#26262C",
      ink: "#E4E6EA",
      "ink-muted": "#A9AEB8",
      "ink-subtle": "#8A909C",
    },
  },
};

let active: ThemeName | null = null;
/** ThemeContext names the theme on screen, so canvas and SVG code that only
 *  knows `dark` still draws in the named theme's colours. */
export function setActiveTheme(name: ThemeName): void {
  active = name;
}

/** The token set on screen (the active theme when its base matches `dark`). */
export function tokens(dark: boolean): TokenSet {
  if (active && THEMES[active].dark === dark) return THEMES[active].tokens;
  return dark ? DARK_TOKENS : LIGHT_TOKENS;
}

/** `#RRGGBB` → `"r g b"`, the channel form used by the CSS variables. */
export function hexToChannels(hex: string): string {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}
