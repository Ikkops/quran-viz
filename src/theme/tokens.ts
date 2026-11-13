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

/** The token set for the current theme. */
export function tokens(dark: boolean): TokenSet {
  return dark ? DARK_TOKENS : LIGHT_TOKENS;
}

/** `#RRGGBB` → `"r g b"`, the channel form used by the CSS variables. */
export function hexToChannels(hex: string): string {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}
