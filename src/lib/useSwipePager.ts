import { useLayoutEffect, useRef, useState } from "react";
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

/**
 * A held-swipe pager: mid-drag the current pane and its neighbour are both
 * visible and follow the finger 1:1 (also under reduced motion, which only
 * shortens what plays after release). Let go past 30% of the width or flicked,
 * the track slides on and `onCommit(dir)` runs; else it springs back. With no
 * pane on that side (`canGo(dir)` false) it only gives a little.
 *
 * Layout: spread `handlers` on a container with `overflow-hidden touch-pan-y`
 * (React touch handlers are enough: `touch-pan-y` leaves sideways moves to us,
 * so nothing needs `preventDefault`). Inside, `trackRef` on a `relative`
 * track holding the current pane in normal flow and, only while `peek !== 0`,
 * the neighbour `absolute inset-y-0 w-full` at `left-full` (peek 1) or
 * `right-full` (peek -1), `aria-hidden` and `inert`. One `translateX` on the
 * track moves both.
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
  onThreshold,
}: {
  current: unknown;
  canGo: (dir: SwipeDir) => boolean;
  onCommit: (dir: SwipeDir) => void;
  enabled?: boolean;
  onThreshold?: (past: boolean) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Remembered with the pane it was set on: in the render that lands a commit
  // the neighbour of the *new* pane must not mount for a frame.
  const [peeked, setPeeked] = useState<{ dir: -1 | 0 | 1; at: unknown }>({
    dir: 0,
    at: current,
  });
  const peek = peeked.at === current ? peeked.dir : 0;
  const setPeek = (dir: -1 | 0 | 1) =>
    setPeeked((p) => (p.dir === dir && p.at === current ? p : { dir, at: current }));
  const st = useRef<{
    x: number;
    y: number;
    width: number;
    locked: boolean;
    dx: number;
    past: boolean;
    samples: DragSample[];
  } | null>(null);
  const anim = useRef<Animation | null>(null);
  // A commit waiting for `current` to change; starts are ignored meanwhile.
  const pending = useRef(false);

  const reset = () => {
    pending.current = false;
    anim.current?.cancel();
    anim.current = null;
    if (trackRef.current) trackRef.current.style.transform = "";
    setPeek(0);
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
    anim.current?.cancel();
    anim.current = null;
    const t = e.touches[0];
    st.current = {
      x: t.clientX,
      y: t.clientY,
      width: e.currentTarget.offsetWidth,
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
    if (!s.locked) {
      const axis = axisLock(raw, t.clientY - s.y);
      if (!axis) return;
      if (axis !== "x" || window.getSelection?.()?.toString()) {
        st.current = null;
        return;
      }
      s.locked = true;
    }
    const dir = swipeDir(raw);
    const can = canGo(dir);
    setPeek(can ? dir : 0);
    // The app root is zoomed: a px inside it is `zoom` px of the finger's.
    s.dx = raw / rootZoom(popupRoot());
    s.samples.push({ p: t.clientX, t: e.timeStamp });
    const past = can && pastThreshold(s.dx, s.width);
    if (past !== s.past) {
      tick();
      onThreshold?.(past);
    }
    s.past = past;
    if (trackRef.current)
      trackRef.current.style.transform = `translateX(${swipeOffset(s.dx, can)}px)`;
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
    const v = velocity(s.samples) / rootZoom(popupRoot());
    if (!releaseCommits(s.dx, s.width, v, can)) {
      if (el) el.style.transform = "";
      anim.current = animateTo(el, [{ transform: from }, { transform: "none" }], {
        duration: reduced ? 80 : 200,
        easing: EASE_OUT,
      }).animation;
      setPeek(0);
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
    peek,
    trackRef,
  };
}
