import { describe, expect, it } from "vitest";
import { parseHash, serializeHash } from "./hash";

describe("hash", () => {
  it("round-trips view, params and reader", () => {
    const h = serializeHash(
      "dashboard",
      { scope: "surah", value: 2, anchor: 262 },
      { v: "length", s: "revelation" },
    );
    expect(h).toBe("dashboard?v=length&s=revelation/r/surah/2/262");
    expect(parseHash("#" + h)).toEqual({
      view: "dashboard",
      params: { v: "length", s: "revelation" },
      reader: { scope: "surah", value: 2, anchor: 262 },
    });
  });

  it("keeps old links working", () => {
    expect(parseHash("#structure/r/juz/30")).toEqual({
      view: "structure",
      params: {},
      reader: { scope: "juz", value: 30, anchor: undefined },
    });
    expect(parseHash("")).toEqual({ view: "home", params: {}, reader: null });
  });

  it("clamps out-of-range reader values", () => {
    expect(parseHash("#dashboard/r/surah/999/99999").reader).toEqual({
      scope: "surah",
      value: 114,
      anchor: 6236,
    });
    expect(parseHash("#browse/r/page/0").reader?.value).toBe(1);
    expect(parseHash("#nope/r/surah/x").reader).toBeNull();
  });
});
