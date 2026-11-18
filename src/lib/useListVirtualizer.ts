import { useCallback, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type VirtualizerOptions,
} from "@tanstack/react-virtual";

type Options = Omit<
  VirtualizerOptions<HTMLDivElement, Element>,
  "observeElementRect" | "observeElementOffset" | "scrollToFn" | "onChange"
>;

/**
 * `useVirtualizer` (same instance, same options), except that a scroll does
 * not re-render the component that owns it: the rows subscribe and re-render
 * alone, and the owner hears only when scrolling starts and stops
 * (`scrolling`). The reader is a big component; re-rendering all of it each
 * time a row crossed the screen's edge made those scroll frames long.
 */
export function useListVirtualizer(options: Options) {
  // One set for the hook's life (state, not a ref: it is read while rendering).
  const [subs] = useState(() => new Set<() => void>());
  const [scrolling, setScrolling] = useState(false);
  const resolved: VirtualizerOptions<HTMLDivElement, Element> = {
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    ...options,
    onChange: (v, sync) => {
      const notify = () => subs.forEach((f) => f());
      if (sync) flushSync(notify);
      else notify();
      setScrolling(v.isScrolling);
    },
  };
  const [virtualizer] = useState(() => new Virtualizer(resolved));
  virtualizer.setOptions(resolved);
  useLayoutEffect(() => virtualizer._didMount(), [virtualizer]);
  useLayoutEffect(() => virtualizer._willUpdate());
  const subscribe = useCallback(
    (f: () => void) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    [subs],
  );
  return { virtualizer, scrolling, subscribe };
}
