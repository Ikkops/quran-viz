import { describe, expect, it } from "vitest";
import { DARK_TOKENS, LIGHT_TOKENS, THEMES } from "../theme/tokens";
import {
  RULE_COLORS,
  SHARED_COLORS,
  TAJWEED_EXAMPLES,
  TAJWEED_GROUPS,
  parseTajweed,
  tajweedColor,
} from "./tajweed";

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

  it("gives each rule its own colour, except the pairs that share one", () => {
    const shared = new Map(SHARED_COLORS);
    for (const key of ["color", "dark"] as const) {
      for (const [a, b] of SHARED_COLORS)
        expect(RULE_COLORS[a][key]).toBe(RULE_COLORS[b][key]);
      const colors = Object.keys(RULE_COLORS)
        .filter((code) => !shared.has(code))
        .map((code) => RULE_COLORS[code][key]);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it("returns undefined for an unknown rule", () => {
    expect(tajweedColor("zz", false)).toBeUndefined();
  });
});

describe("tajweed groups", () => {
  it("list every rule code exactly once, each with an example", () => {
    const codes = TAJWEED_GROUPS.flatMap((g) => g.rules.map((r) => r.code));
    expect([...codes].sort()).toEqual(Object.keys(RULE_COLORS).sort());
    for (const code of codes) expect(TAJWEED_EXAMPLES[code], code).toBeDefined();
  });

  it("keep each example to its own rule", () => {
    for (const [code, ex] of Object.entries(TAJWEED_EXAMPLES)) {
      const rules = parseTajweed(ex.marked).flatMap((s) => (s.rule ? [s.rule] : []));
      expect(rules, code).toEqual([code]);
    }
  });
});
