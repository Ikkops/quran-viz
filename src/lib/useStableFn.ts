import { useCallback, useLayoutEffect, useRef } from "react";

/** A function that keeps one identity and always calls the latest `fn`: for
 *  event handlers handed to memoised rows, which then skip re-rendering. */
export function useStableFn<A extends unknown[], R>(fn: (...args: A) => R) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
