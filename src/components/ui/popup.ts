// Shared by popups portalled into the app root (Select, the word popup).

/** The element the app's CSS `zoom` sits on; popups portal into it so they get
 *  the same zoom, theme and fonts. */
export function popupRoot(): HTMLElement {
  return document.getElementById("app-root") ?? document.body;
}

/** CSS zoom of the app root (1 in tests, where layout is empty). */
export function rootZoom(root: HTMLElement): number {
  const z = root.getBoundingClientRect().width / root.offsetWidth;
  return Number.isFinite(z) && z > 0 ? z : 1;
}
