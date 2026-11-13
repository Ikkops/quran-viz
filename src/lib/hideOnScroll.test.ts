import { describe, expect, it } from "vitest";
import { nextHeadHidden } from "./hideOnScroll";

describe("nextHeadHidden", () => {
  it("hides on a scroll down past the head", () => {
    expect(nextHeadHidden(false, 300, 200, 100)).toBe(true);
  });
  it("stays shown while still within the head's height", () => {
    expect(nextHeadHidden(false, 80, 20, 100)).toBe(false);
  });
  it("shows again on a scroll up", () => {
    expect(nextHeadHidden(true, 500, 520, 100)).toBe(false);
  });
  it("ignores small jitters", () => {
    expect(nextHeadHidden(true, 503, 500, 100)).toBe(true);
    expect(nextHeadHidden(false, 497, 500, 100)).toBe(false);
  });
  it("always shows at the top", () => {
    expect(nextHeadHidden(true, 0, 10, 100)).toBe(false);
  });
});
