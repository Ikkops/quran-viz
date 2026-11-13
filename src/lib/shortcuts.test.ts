import { describe, expect, it } from "vitest";
import { shortcutFor } from "./shortcuts";

const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe("shortcutFor", () => {
  it("maps keys to actions", () => {
    expect(shortcutFor(k("k", { ctrlKey: true }), false, false)).toEqual({
      kind: "search",
    });
    expect(shortcutFor(k("/"), false, false)).toEqual({ kind: "search" });
    expect(shortcutFor(k("2"), false, false)).toEqual({
      kind: "view",
      view: "structure",
    });
    expect(shortcutFor(k("?"), false, false)).toEqual({ kind: "view", view: "settings" });
    expect(shortcutFor(k("b"), false, false)).toEqual({ kind: "bookmarks" });
  });
  it("stays out of the way while typing or with a window open", () => {
    expect(shortcutFor(k("2"), true, false)).toBeNull();
    expect(shortcutFor(k("/"), false, true)).toBeNull();
    // Ctrl/Cmd+K works everywhere.
    expect(shortcutFor(k("k", { metaKey: true }), true, true)).toEqual({
      kind: "search",
    });
  });
});
