/** Colour tokens are CSS variables (src/index.css ← src/theme/tokens.ts). */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  // On touch screens a tapped button kept its hover tint until the next tap
  // elsewhere; hover styles apply only where a real pointer can hover.
  future: { hoverOnlyWhenSupported: true },
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
        // DESIGN.md "Soft": cards and lifted options. A layered whisper on light
        // themes; on dark ones (`.dark`) only a top-edge highlight (index.css).
        soft: "var(--shadow-soft)",
      },
      // DESIGN.md type steps (rem, so the Interface scale applies). Body text
      // stays text-base / text-sm.
      fontSize: {
        display: [
          "1.625rem",
          { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        title: [
          "1.25rem",
          { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
        heading: [
          "1rem",
          { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "600" },
        ],
        eyebrow: [
          "0.75rem",
          { lineHeight: "1.33", letterSpacing: "0.01em", fontWeight: "600" },
        ],
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
