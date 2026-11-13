import { useSyncExternalStore } from "react";

/**
 * Narrowest layout the app is designed for, in CSS px after zoom. The Interface
 * scale (CSS `zoom` on the app root) divides the viewport, so an unchecked 150%
 * left a 375px phone with a 250px layout and the page spilled sideways.
 */
export const MIN_LAYOUT_PX = 380;

/**
 * The zoom actually applied: the user's Interface scale, capped so the layout
 * stays at least MIN_LAYOUT_PX wide, and never pushed below 100% by the cap
 * (on a phone narrower than MIN_LAYOUT_PX, native size wins).
 */
export function effectiveUiScale(scale: number, viewportWidth: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  if (!(viewportWidth > 0)) return scale;
  const cap = Math.max(1, viewportWidth / MIN_LAYOUT_PX);
  return Math.min(scale, cap);
}

/** Layout width (CSS px after zoom) from which the nav rail replaces the bottom tabs. */
export const RAIL_MIN_LAYOUT_PX = 720;

/**
 * Whether the layout is wide enough for the nav rail. Decided in JS because CSS
 * zoom leaves media queries reading the unzoomed window: a 768px tablet at 150%
 * has a 512px layout but would still match `md:`.
 */
export function isWideLayout(viewportWidth: number, zoom: number): boolean {
  return viewportWidth > 0 && viewportWidth / zoom >= RAIL_MIN_LAYOUT_PX;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/**
 * The layout viewport's width (`device-width` on phones), re-rendering on
 * resize; 0 outside a browser. Not `innerWidth`: a mobile browser zooms out to
 * show overflowing content and then reports the overflow as its innerWidth, so
 * the cap would chase the very overflow it is meant to prevent.
 */
export function useViewportWidth(): number {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.clientWidth,
    () => 0,
  );
}
