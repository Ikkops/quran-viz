import { describe, expect, it } from "vitest";
import { MIN_LAYOUT_PX, effectiveUiScale, isWideLayout } from "./uiScale";

describe("effectiveUiScale", () => {
  it("keeps the chosen scale on wide screens", () => {
    expect(effectiveUiScale(1.5, 1440)).toBe(1.5);
    expect(effectiveUiScale(1.25, 1024)).toBe(1.25);
  });

  it("caps the scale so the layout stays MIN_LAYOUT_PX wide", () => {
    expect(effectiveUiScale(1.5, 500)).toBeCloseTo(500 / MIN_LAYOUT_PX);
    expect(500 / effectiveUiScale(1.5, 500)).toBeCloseTo(MIN_LAYOUT_PX);
  });

  it("never zooms below 100% on a narrow phone", () => {
    expect(effectiveUiScale(1.5, 375)).toBe(1);
    expect(effectiveUiScale(2, 320)).toBe(1);
  });

  it("falls back safely on bad input", () => {
    expect(effectiveUiScale(Number.NaN, 800)).toBe(1);
    expect(effectiveUiScale(1.5, 0)).toBe(1.5);
  });
});

describe("isWideLayout", () => {
  it("uses the layout width after zoom, not the window width", () => {
    expect(isWideLayout(1440, 1.5)).toBe(true); // 960px layout
    expect(isWideLayout(768, 1.5)).toBe(false); // 512px layout
    expect(isWideLayout(768, 1)).toBe(true);
    expect(isWideLayout(375, 1)).toBe(false);
    expect(isWideLayout(0, 1)).toBe(false);
  });
});
