import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { persisted, readPersisted, usePersistentState } from "./usePersistentState";

beforeEach(() => localStorage.clear());

describe("usePersistentState", () => {
  it("restores a stored value on remount", () => {
    const first = renderHook(() => usePersistentState("t.flag", false));
    act(() => first.result.current[1](true));
    first.unmount();
    const second = renderHook(() => usePersistentState("t.flag", false));
    expect(second.result.current[0]).toBe(true);
  });

  it("falls back to the initial value when sanitize rejects the stored one", () => {
    localStorage.setItem("t.lang", JSON.stringify("fr"));
    expect(readPersisted("t.lang", "en", persisted.oneOf(["en", "id"]))).toBe("en");
    localStorage.setItem("t.lang", JSON.stringify("id"));
    expect(readPersisted("t.lang", "en", persisted.oneOf(["en", "id"]))).toBe("id");
  });

  it("clamps numbers and rejects non-numbers", () => {
    localStorage.setItem("t.n", "9");
    expect(readPersisted("t.n", 1, persisted.number(0.5, 2))).toBe(2);
    localStorage.setItem("t.n", '"big"');
    expect(readPersisted("t.n", 1, persisted.number(0.5, 2))).toBe(1);
  });

  it("survives unparsable JSON", () => {
    localStorage.setItem("t.bad", "{nope");
    expect(readPersisted("t.bad", true, persisted.bool)).toBe(true);
  });
});
