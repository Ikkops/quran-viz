import { useEffect, useState } from "react";

/**
 * Like `useState`, but the value is mirrored to `localStorage` under `key`, so
 * it survives component unmounts (e.g. switching tabs) and full page reloads.
 * The initial render reads synchronously from storage, so there's no flicker.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore (quota / private mode) */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
