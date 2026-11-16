import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { popupRoot, rootZoom } from "../components/ui/popup";
import {
  animateTo,
  axisLock,
  commits,
  EASE_IN,
  EASE_OUT,
  prefersReducedMotion,
  rubberBand,
  type DragSample,
  velocity,
} from "./drag";
import { tick } from "./haptics";

export type SwipeDir = -1 | 1;

/** Share of the container's width a drag must pass to commit on release. */
export const PAGER_RATIO = 0.3;

/** Swiping left (dx < 0) goes to the next pane (+1), right to the previous. */
export const swipeDir = (dx: number): SwipeDir => (dx < 0 ? 1 : -1);

/** Where the track sits for a drag of `dx`: 1:1, or rubber-banded with no pane there. */
export const swipeOffset = (dx: number, can: boolean): number =>
  can ? dx : rubberBand(dx);

/** Whether a drag of `dx` is past the commit distance. */
export const pastThreshold = (dx: number, width: number): boolean =>
  Math.abs(dx) > width * PAGER_RATIO;

/** Whether a release at `dx` with velocity `v` (both signed, px and px/ms) commits. */
export const releaseCommits = (dx: number, width: number, v: number, can: boolean) =>
  can && commits(Math.abs(dx), width, v * Math.sign(dx), PAGER_RATIO);

/** Whether `el`, or an ancestor below `root`, scrolls sideways itself. */
export function inHorizontalScroller(el: Element, root: Element): boolean {
  for (let n: Element | null = el; n && n !== root; n = n.parentElement)
    if (
      n.scrollWidth > n.clientWidth &&
      /auto|scroll/.test(getComputedStyle(n).overflowX)
    )
      return true;
  return false;
}

const NO_SWIPE = "input, textarea, [role='slider'], [data-no-swipe], [data-select-popup]";

/** Run `f` once the main thread is idle (a short timeout where there is no
 *  `requestIdleCallback`, as in jsdom); returns the cancel. */
function whenIdle(f: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(f, { timeout: 1000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(f, 200);
  return () => clearTimeout(id);
}

const NONE = Symbol("none");

/**
 * A held-swipe pager: mid-drag the current pane and its neighbour are both
 * visible and follow the finger 1:1 (also under reduced motion, which only
 * shortens what plays after release). Let go past 30% of the width or flicked,
 * the track slides on and `onCommit(dir)` runs; else it springs back. With no
 * pane on that side (`canGo(dir)` false) it only gives a little.
 *
 * Between touchstart and release the hook does no React work: the finger
 * moves one `translateX` on the track (on its own compositor layer while
 * dragging). The neighbours must therefore be in the DOM before the drag:
 * `sides` lists the ones to mount, `absolute inset-y-0 w-full` at `left-full`
 * (+1) or `right-full` (-1), `aria-hidden` and `inert`. With `ahead` they are
 * mounted when the main thread is idle after each pane change (the reader:
 * cheap first screens); otherwise at the first drag, in a transition, and
 * dropped again once the drag settles (heavy panes: charts, whole tabs).
 *
 * Layout: spread `handlers` on a container with `touch-pan-y` that clips
 * sideways (`overflow-hidden`; for non-`ahead` callers it may be clipped only
 * while `sides` is non-empty). React touch handlers are enough: `touch-pan-y`
 * leaves sideways moves to us, so nothing needs `preventDefault`. Inside,
 * `trackRef` on a `relative` track holding the current pane in normal flow
 * and the neighbours.
 *
 * `current` is anything that changes when the caller moves to a new pane (its
 * index). After a commit the track is held at ∓100% (the neighbour in view)
 * until the render where `current` changes; a layout effect then drops the
 * transform before that frame paints, so the old pane never flashes back.
 */
export function useSwipePager({
  current,
  canGo,
  onCommit,
  enabled = true,
  ahead = false,
  onThreshold,
}: {
  current: unknown;
  canGo: (dir: SwipeDir) => boolean;
  onCommit: (dir: SwipeDir) => void;
  enabled?: boolean;
  /** Mount the neighbours when idle, before any drag (see above). */
  ahead?: boolean;
  onThreshold?: (past: boolean) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // The pane the neighbours were mounted for: a new pane drops them in the
  // very render that lands it.
  const [armedAt, setArmedAt] = useState<unknown>(NONE);
  const near = enabled && armedAt === current;
  const sides: SwipeDir[] = near ? ([-1, 1] as const).filter((d) => canGo(d)) : [];
  const arm = () => startTransition(() => setArmedAt(current));
  useEffect(() => {
    if (ahead && enabled)
      return whenIdle(() => startTransition(() => setArmedAt(current)));
  }, [ahead, enabled, current]);

  const st = useRef<{
    x: number;
    y: number;
    width: number;
    zoom: number;
    locked: boolean;
    dx: number;
    past: boolean;
    samples: DragSample[];
  } | null>(null);
  const anim = useRef<Animation | null>(null);
  // A commit waiting for `current` to change; starts are ignored meanwhile.
  const pending = useRef(false);

  const settle = () => {
    anim.current?.cancel();
    anim.current = null;
    const el = trackRef.current;
    if (el) {
      el.style.transform = "";
      el.style.willChange = "";
    }
  };
  const reset = () => {
    pending.current = false;
    settle();
  };
  useLayoutEffect(() => {
    if (pending.current) reset();
    // Only a pane change lands a commit; `reset` is a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    st.current = null;
    const el = e.target as Element;
    if (!enabled || pending.current || e.touches.length !== 1) return;
    if (el.closest(NO_SWIPE) || inHorizontalScroller(el, e.currentTarget)) return;
    // A spring-back still playing: the finger takes the track from where it rests.
    if (anim.current) settle();
    const t = e.touches[0];
    st.current = {
      x: t.clientX,
      y: t.clientY,
      width: e.currentTarget.offsetWidth,
      // Read once: it forces a style flush, too dear on every move.
      zoom: rootZoom(popupRoot()),
      locked: false,
      dx: 0,
      past: false,
      samples: [],
    };
  };

  const onTouchMove = (e: TouchEvent) => {
    const s = st.current;
    if (!s) return;
    const t = e.touches[0];
    const raw = t.clientX - s.x;
    const track = trackRef.current;
    if (!s.locked) {
      const axis = axisLock(raw, t.clientY - s.y);
      if (!axis) return;
      if (axis !== "x" || window.getSelection?.()?.toString()) {
        st.current = null;
        return;
      }
      s.locked = true;
      // Composited only while dragging: a standing layer would cost memory
      // and pin `fixed` descendants to the track.
      if (track) track.style.willChange = "transform";
      // Not mounted yet (a drag right after arriving, or a lazy caller).
      if (!near) arm();
    }
    const dir = swipeDir(raw);
    const can = canGo(dir);
    // The app root is zoomed: a px inside it is `zoom` px of the finger's.
    s.dx = raw / s.zoom;
    s.samples.push({ p: t.clientX, t: e.timeStamp });
    const past = can && pastThreshold(s.dx, s.width);
    if (past !== s.past) {
      tick();
      onThreshold?.(past);
    }
    s.past = past;
    if (track) track.style.transform = `translateX(${swipeOffset(s.dx, can)}px)`;
  };

  const onTouchEnd = () => {
    const s = st.current;
    st.current = null;
    if (!s?.locked) return;
    const el = trackRef.current;
    const dir = swipeDir(s.dx);
    const can = canGo(dir);
    const from = `translateX(${swipeOffset(s.dx, can)}px)`;
    const reduced = prefersReducedMotion();
    const v = velocity(s.samples) / s.zoom;
    if (!releaseCommits(s.dx, s.width, v, can)) {
      if (el) el.style.transform = "";
      const back = animateTo(el, [{ transform: from }, { transform: "none" }], {
        duration: reduced ? 80 : 200,
        easing: EASE_OUT,
      });
      anim.current = back.animation;
      const done = () => {
        // A new touch took over meanwhile: it owns the track now.
        if (anim.current !== back.animation) return;
        settle();
        if (!ahead) setArmedAt(NONE);
      };
      // No animation to wait for (tests): settle now.
      if (!back.animation) done();
      else void back.done.then(done);
      return;
    }
    pending.current = true;
    const out = animateTo(
      el,
      [{ transform: from }, { transform: `translateX(${-dir * 100}%)` }],
      { duration: reduced ? 80 : 180, easing: EASE_IN, fill: "forwards" },
    );
    anim.current = out.animation;
    const mine = out.animation;
    const commit = () => {
      onCommit(dir);
      // A caller that did not move gets its pane back.
      setTimeout(() => {
        if (pending.current && anim.current === mine) reset();
      }, 400);
    };
    // No animation to wait for (tests): commit now.
    if (!out.animation) return commit();
    void out.done.then(commit);
  };

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
    sides,
    trackRef,
  };
}
