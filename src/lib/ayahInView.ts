/** A vertical extent in viewport px. */
export interface Span {
  top: number;
  bottom: number;
}

/**
 * Whether an ayah can be read inside `band` (the scroller below the floating
 * head). `rects` are the ayah's own boxes: one whole row (`row`: ayah by ayah,
 * the Arabic at its top) or its words / lines (mushaf). A row counts when its
 * top is in the band or it covers the band; a word or line when its middle is
 * in the band. No rects (not rendered) is not in view.
 */
export function ayahInView(rects: Span[], band: Span, row: boolean): boolean {
  return rects.some((r) =>
    row
      ? (r.top >= band.top && r.top < band.bottom) ||
        (r.top < band.top && r.bottom > band.bottom)
      : (r.top + r.bottom) / 2 >= band.top && (r.top + r.bottom) / 2 <= band.bottom,
  );
}

/** Follow the recitation to the new ayah only when it is out of view and the
 *  learner was following: the previous ayah was in view, or there was none. */
export function shouldFollow(nowInView: boolean, prevInView: boolean | null): boolean {
  return !nowInView && prevInView !== false;
}
