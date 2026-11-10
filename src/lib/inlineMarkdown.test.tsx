import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInline } from "./inlineMarkdown";

const html = (s: string) => render(<p>{renderInline(s)}</p>).container.innerHTML;

describe("renderInline", () => {
  it("renders **bold** as <strong> without the markers", () => {
    const out = html("Intro\n\n**Pokok-Pokok Isi:**\n\n1. Keimanan");
    expect(out).toContain('<strong class="font-semibold">Pokok-Pokok Isi:</strong>');
    expect(out).not.toContain("**");
  });

  it("leaves lone and unpaired asterisks literal", () => {
    const s = String.raw`in v?v?\.?\s*[0-9]+ and **open`;
    expect(render(<p>{renderInline(s)}</p>).container.textContent).toBe(s);
  });

  it("handles several bold runs on one line", () => {
    const out = html("a **b** c **d**");
    expect(out.match(/<strong/g)).toHaveLength(2);
  });
});
