/** Scrolling this many px in one direction flips the reader's head. */
export const HIDE_STEP = 6;

/**
 * Whether the reader's head should be hidden after the list scrolled from
 * `lastY` to `y`: hide on a scroll down once past the head's own height, show
 * again on a scroll up or back at the top; small jitters change nothing.
 */
export function nextHeadHidden(
  hidden: boolean,
  y: number,
  lastY: number,
  headH: number,
): boolean {
  if (y <= 0) return false;
  if (y - lastY > HIDE_STEP && y > headH) return true;
  if (lastY - y > HIDE_STEP) return false;
  return hidden;
}
