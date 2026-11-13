import { describe, expect, it } from "vitest";
import { backAction, installBackButton } from "./androidBack";

describe("backAction", () => {
  it("closes an open window first", () => {
    expect(backAction(true, true)).toBe("close-dialog");
    expect(backAction(true, false)).toBe("close-dialog");
  });

  it("then steps back through history, then exits", () => {
    expect(backAction(false, true)).toBe("history-back");
    expect(backAction(false, false)).toBe("exit");
  });
});

describe("installBackButton", () => {
  it("is a no-op on the web", () => {
    const uninstall = installBackButton();
    expect(() => uninstall()).not.toThrow();
  });
});
