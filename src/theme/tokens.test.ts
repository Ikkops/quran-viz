import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DARK_TOKENS, LIGHT_TOKENS, THEMES, TOKEN_NAMES, hexToChannels } from "./tokens";

const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

/** The `--name: r g b;` declarations inside the first block matching `selector {`. */
function cssVars(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z-]+):\s*(\d+ \d+ \d+);/g)].map((m) => [m[1], m[2]]),
  );
}

describe("design tokens", () => {
  it.each([
    [":root", LIGHT_TOKENS],
    [".dark", DARK_TOKENS],
    ['[data-theme="cream"]', THEMES.cream.tokens],
    ['[data-theme="sepia"]', THEMES.sepia.tokens],
    ['[data-theme="warm-dark"]', THEMES["warm-dark"].tokens],
    ['[data-theme="black"]', THEMES.black.tokens],
  ])("index.css %s mirrors tokens.ts", (selector, set) => {
    const vars = cssVars(selector);
    for (const name of TOKEN_NAMES) {
      expect(vars[name], `--${name} in ${selector}`).toBe(hexToChannels(set[name]));
    }
  });

  it("converts hex to channels", () => {
    expect(hexToChannels("#1F4FA0")).toBe("31 79 160");
  });
});
