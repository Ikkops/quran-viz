/** A word the learner tapped: the ayah, the word (0-based) and where it sits
 *  on screen (viewport px), for placing the popup. */
export interface WordPick {
  id: number;
  w: number;
  rect: { top: number; bottom: number; left: number; right: number };
}

/** Where a word was tapped, from the element. */
export function pickOf(id: number, w: number, el: Element): WordPick {
  const r = el.getBoundingClientRect();
  return { id, w, rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } };
}
