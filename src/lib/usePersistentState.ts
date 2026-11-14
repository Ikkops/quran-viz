import { useEffect, useState } from "react";

/** Read `key` from localStorage, falling back to `initial` when it is missing,
 *  unparsable, or rejected by `sanitize`. */
export function readPersisted<T>(
  key: string,
  initial: T,
  sanitize?: (raw: unknown) => T | undefined,
): T {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return initial;
    const parsed: unknown = JSON.parse(raw);
    if (!sanitize) return parsed as T;
    const clean = sanitize(parsed);
    return clean === undefined ? initial : clean;
  } catch {
    return initial;
  }
}

/**
 * Like `useState`, but the value is mirrored to `localStorage` under `key`, so
 * it survives component unmounts (e.g. switching tabs) and full page reloads.
 * The initial render reads synchronously from storage, so there's no flicker.
 *
 * `sanitize` validates what was stored: return the (possibly repaired) value,
 * or `undefined` to fall back to `initial`. Use it whenever a stored value can
 * go stale (a removed option, an out-of-range number, a changed shape).
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  sanitize?: (raw: unknown) => T | undefined,
) {
  const [value, setValue] = useState<T>(() => readPersisted(key, initial, sanitize));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore (quota / private mode) */
    }
  }, [key, value]);

  // Another tab wrote this key: take its value, or this tab's next write
  // would put its own stale copy back over it (a bookmark added there, gone).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(readPersisted(key, initial, sanitize));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // `initial` and `sanitize` are fresh on every render; the key is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue] as const;
}

/** Sanitizers for common shapes. */
export const persisted = {
  bool: (raw: unknown) => (typeof raw === "boolean" ? raw : undefined),
  oneOf:
    <T extends string>(allowed: readonly T[]) =>
    (raw: unknown) =>
      allowed.includes(raw as T) ? (raw as T) : undefined,
  number:
    (min: number, max: number) =>
    (raw: unknown): number | undefined =>
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.min(max, Math.max(min, raw))
        : undefined,
  /** Distinct strings, at most `max`, only `allowed` ones when given. */
  stringList:
    (max: number, allowed?: readonly string[]) =>
    (raw: unknown): string[] | undefined =>
      Array.isArray(raw)
        ? [...new Set(raw.filter((x): x is string => typeof x === "string"))]
            .filter((x) => !allowed || allowed.includes(x))
            .slice(0, max)
        : undefined,
};
