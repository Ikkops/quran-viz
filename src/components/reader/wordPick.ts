/** Where something sits on screen (viewport px), for placing a popup by it. */
export interface PickRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A word the learner picked: the ayah, the word (0-based) and where it sits. */
export interface WordPick {
  id: number;
  w: number;
  rect: PickRect;
}

/** An ayah the learner tapped, and the spot it was tapped at. */
export interface AyahPick {
  id: number;
  rect: PickRect;
}

/** An element's box. */
export function rectOf(el: Element): PickRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}

/** The line box of an inline element (an ayah running over several lines)
 *  that holds the point, else the whole element's box. */
export function rectAt(el: Element, x: number, y: number): PickRect {
  for (const r of el.getClientRects())
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  return rectOf(el);
}

/** Where a word was tapped, from the element. */
export function pickOf(id: number, w: number, el: Element): WordPick {
  return { id, w, rect: rectOf(el) };
}
