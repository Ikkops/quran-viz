import { describe, expect, it } from "vitest";
import { DARK_TOKENS, LIGHT_TOKENS, THEMES } from "../theme/tokens";
import { RULE_COLORS, parseTajweed, tajweedColor } from "./tajweed";

describe("parseTajweed (extra)", () => {
  it("preserves whitespace between segments", () => {
    const segs = parseTajweed("a [h[bc]d");
    expect(segs.map((s) => s.text).join("")).toBe("a bcd");
  });
});

describe("tajweed colours", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it.each([
    ["day", false, LIGHT_TOKENS],
    ["night", true, DARK_TOKENS],
  ] as const)("every rule reads at 4.5:1 on the %s surfaces", (_name, dark, set) => {
    for (const code of Object.keys(RULE_COLORS)) {
      const color = tajweedColor(code, dark)!;
      for (const bg of [set.paper, set.surface, set["surface-sunken"]]) {
        expect(contrast(color, bg), `${code} ${color} on ${bg}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
  });

  // The warm and black themes reuse the day / night colours. Qur'an text is set
  // large (1.6rem and up), so WCAG's large-text 3:1 is the floor there.
  it.each(["cream", "sepia", "warm-dark", "black"] as const)(
    "every rule reads at 3:1 on the %s surfaces",
    (name) => {
      const { dark, tokens: set } = THEMES[name];
      for (const code of Object.keys(RULE_COLORS)) {
        const color = tajweedColor(code, dark)!;
        for (const bg of [set.paper, set.surface, set["surface-sunken"]]) {
          expect(contrast(color, bg), `${code} ${color} on ${bg}`).toBeGreaterThanOrEqual(
            3,
          );
        }
      }
    },
  );

  it("gives each rule its own colour in each theme", () => {
    for (const key of ["color", "dark"] as const) {
      const colors = Object.values(RULE_COLORS).map((r) => r[key]);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it("returns undefined for an unknown rule", () => {
    expect(tajweedColor("zz", false)).toBeUndefined();
  });
});
