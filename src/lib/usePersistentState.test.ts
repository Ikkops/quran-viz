import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { persisted, readPersisted, usePersistentState } from "./usePersistentState";
import { announceSyncApplied, onLocalChange, readStamps } from "./sync/changes";

beforeEach(() => localStorage.clear());

describe("usePersistentState", () => {
  it("restores a stored value on remount", () => {
    const first = renderHook(() => usePersistentState("t.flag", false));
    act(() => first.result.current[1](true));
    first.unmount();
    const second = renderHook(() => usePersistentState("t.flag", false));
    expect(second.result.current[0]).toBe(true);
  });

  it("takes a value another tab wrote", () => {
    const { result } = renderHook(() => usePersistentState("t.list", ["a"]));
    localStorage.setItem("t.list", JSON.stringify(["a", "b"]));
    act(() => void window.dispatchEvent(new StorageEvent("storage", { key: "t.list" })));
    expect(result.current[0]).toEqual(["a", "b"]);
  });

  it("stamps a synced setting the learner changes, not its first default", () => {
    const changed: string[] = [];
    const off = onLocalChange((k) => changed.push(k));
    const { result } = renderHook(() => usePersistentState("qv.reading.goal", 5));
    // The default written on first use is not a change: another device's
    // real choice must win over it.
    expect(readStamps()["qv.reading.goal"]).toBeUndefined();
    act(() => result.current[1](20));
    expect(readStamps()["qv.reading.goal"]).toBeGreaterThan(0);
    expect(changed).toEqual(["qv.reading.goal"]);
    off();
  });

  it("shows what sync stored, without stamping it as a change here", () => {
    const { result } = renderHook(() => usePersistentState("qv.lang", "en"));
    localStorage.setItem("qv.lang", JSON.stringify("id"));
    act(() => announceSyncApplied(["qv.lang"]));
    expect(result.current[0]).toBe("id");
    expect(readStamps()["qv.lang"]).toBeUndefined();
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
