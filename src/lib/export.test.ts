import { describe, expect, it } from "vitest";
import { toCsv } from "./export";

describe("toCsv", () => {
  it("writes a header and quotes awkward fields", () => {
    expect(
      toCsv([
        { id: 1, name: "Al-Fatiha", note: 'say "hi", ok' },
        { id: 2, name: "البقرة", note: null },
      ]),
    ).toBe('id,name,note\r\n1,Al-Fatiha,"say ""hi"", ok"\r\n2,البقرة,');
  });
  it("is empty for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
