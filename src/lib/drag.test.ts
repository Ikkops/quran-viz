import { describe, expect, it } from "vitest";
import { animateTo, axisLock, commits, rubberBand, velocity } from "./drag";

describe("axisLock", () => {
  it("waits for the slop", () => {
    expect(axisLock(6, 3)).toBeNull();
  });
  it("is sideways only when clearly horizontal", () => {
    expect(axisLock(20, 5)).toBe("x");
    expect(axisLock(-20, 9)).toBe("x");
    expect(axisLock(12, 10)).toBe("y");
    expect(axisLock(0, 15)).toBe("y");
  });
});

describe("velocity", () => {
  it("is zero without movement in time", () => {
    expect(velocity([])).toBe(0);
    expect(velocity([{ p: 5, t: 10 }])).toBe(0);
  });
  it("uses only the last 100 ms", () => {
    const v = velocity([
      { p: 0, t: 0 },
      { p: 300, t: 400 },
      { p: 350, t: 450 },
    ]);
    expect(v).toBe(1);
  });
  it("keeps the direction", () => {
    expect(
      velocity([
        { p: 100, t: 0 },
        { p: 40, t: 60 },
      ]),
    ).toBe(-1);
  });
});

describe("commits", () => {
  it("needs distance or a flick", () => {
    expect(commits(100, 600, 0)).toBe(false);
    expect(commits(200, 600, 0)).toBe(true);
    expect(commits(40, 600, 0.8)).toBe(true);
  });
  it("is cancelled by a flick back", () => {
    expect(commits(400, 600, -0.8)).toBe(false);
  });
  it("never commits a drag the wrong way", () => {
    expect(commits(-50, 600, 2)).toBe(false);
  });
});

describe("rubberBand", () => {
  it("resists", () => {
    expect(rubberBand(100)).toBe(30);
  });
});

describe("animateTo", () => {
  it("finishes at once without the Web Animations API", async () => {
    const el = document.createElement("div");
    const { done, animation } = animateTo(el, [{ opacity: 0 }], { duration: 100 });
    expect(animation).toBeNull();
    await expect(done).resolves.toBeUndefined();
  });
});
