// Shared by the two finger-following gestures: dragging a bottom sheet down to
// close it, and swiping the reader sideways to the next window.

/** Arrivals decelerate; exits accelerate and are shorter (DESIGN.md, Motion). */
export const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
export const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";

/** The finger must travel this far before a gesture picks its axis. */
export const DRAG_SLOP = 10;
/** A release faster than this (px/ms) commits whatever the distance. */
export const FLICK = 0.5;

/**
 * Which way a touch is going once it has moved `DRAG_SLOP`: "x" when it is
 * mostly sideways (twice as far across as down), else "y"; null before that.
 */
export function axisLock(dx: number, dy: number): "x" | "y" | null {
  if (Math.hypot(dx, dy) < DRAG_SLOP) return null;
  return Math.abs(dx) >= 2 * Math.abs(dy) ? "x" : "y";
}

export interface DragSample {
  /** Position along the drag axis, px. */
  p: number;
  /** Timestamp, ms. */
  t: number;
}

/** Speed along the axis (px/ms, signed) over the last 100 ms of `samples`. */
export function velocity(samples: readonly DragSample[]): number {
  const last = samples[samples.length - 1];
  if (!last) return 0;
  const first = samples.find((s) => last.t - s.t <= 100) ?? last;
  const dt = last.t - first.t;
  return dt > 0 ? (last.p - first.p) / dt : 0;
}

/**
 * Whether a release finishes the gesture: dragged past `ratio` of `size`, or
 * flicked in the drag's own direction. A flick back the other way cancels.
 */
export function commits(distance: number, size: number, v: number, ratio = 0.3): boolean {
  if (distance <= 0) return false;
  if (v < -FLICK) return false;
  return v > FLICK || distance > size * ratio;
}

/** Resistance where there is nothing further to drag to. */
export const rubberBand = (d: number): number => d * 0.3;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Animate `el` and resolve when it ends. Resolves at once (returning null)
 * where the Web Animations API is missing, as in jsdom, so callers behave the
 * same without motion.
 */
export function animateTo(
  el: Element | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): { done: Promise<void>; animation: Animation | null } {
  if (!el || typeof el.animate !== "function")
    return { done: Promise.resolve(), animation: null };
  const animation = el.animate(keyframes, options);
  // A cancelled animation rejects `finished`; either way the caller moves on.
  const done = animation.finished.then(
    () => undefined,
    () => undefined,
  );
  return { done, animation };
}
