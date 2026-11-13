/** Colour tokens are CSS variables (src/index.css ← src/theme/tokens.ts). */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: token("paper"),
        surface: { DEFAULT: token("surface"), sunken: token("surface-sunken") },
        line: token("line"),
        ink: {
          DEFAULT: token("ink"),
          muted: token("ink-muted"),
          subtle: token("ink-subtle"),
        },
        makki: token("makki"),
        madani: token("madani"),
        hijra: token("hijra"),
        illumination: token("illumination"),
        rubric: token("rubric"),
      },
      boxShadow: {
        // DESIGN.md "Float": only for things above content (sheets, popovers, player).
        float: "0 8px 24px -8px rgb(27 34 48 / 0.18)",
      },
      fontFamily: {
        amiri: ["Amiri", "serif"],
        ui: ["var(--font-ui)"],
        reading: ["var(--font-reading)"],
      },
    },
  },
  plugins: [
    // `touch:` applies on touch screens (phone, tablet, the Android app), where
    // controls need a 44px target; pointer layouts keep their compact sizes.
    ({ addVariant }) => addVariant("touch", "@media (pointer: coarse)"),
  ],
};
