import {
  READER_SCOPES,
  SCOPE_MAX,
  type ReaderScope,
  type ReaderTarget,
} from "../components/charts/common";

/** Top-level views. ("compare" became a reader layout; old links open the dashboard.) */
/** "home" is where the app opens: last read and the index. The old "browse"
 *  (Map) view is now the dashboard's Map tab: `#browse` opens it. */
export type View = "home" | "dashboard" | "structure" | "activity" | "settings";
export const VIEWS: readonly View[] = [
  "home",
  "dashboard",
  "structure",
  "activity",
  "settings",
];
const MAX_AYAH = 6236;

export interface HashState {
  view: View;
  /** View state carried in the link (dashboard only), e.g. `{v: "length"}`. */
  params: Record<string, string>;
  reader: ReaderTarget | null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Parse `#<view>[?<params>][/r/<scope>/<value>[/<anchor>]]`. Out-of-range
 *  reader values are clamped (surah 999 -> 114), junk falls back to defaults. */
export function parseHash(hash: string): HashState {
  const h = hash.replace(/^#/, "");
  const [head, ...rest] = h.split("/r/");
  const [viewPart, query = ""] = head.split("?");
  const view =
    viewPart === "browse"
      ? "dashboard"
      : (VIEWS as readonly string[]).includes(viewPart)
        ? (viewPart as View)
        : "home";
  const params: Record<string, string> = Object.fromEntries(new URLSearchParams(query));
  if (viewPart === "browse") params.tab = "map";
  const readerPart = rest.join("/r/");
  if (!readerPart) return { view, params, reader: null };
  const segs = readerPart.split("/");
  if (segs.length < 2) return { view, params, reader: null };
  const scope: ReaderScope = (READER_SCOPES as readonly string[]).includes(segs[0])
    ? (segs[0] as ReaderScope)
    : "surah";
  const value = Math.trunc(Number(segs[1]));
  if (!Number.isFinite(value)) return { view, params, reader: null };
  const anchorRaw = segs[2] !== undefined ? Math.trunc(Number(segs[2])) : NaN;
  return {
    view,
    params,
    reader: {
      scope,
      value: clamp(value, 1, SCOPE_MAX[scope]),
      anchor: Number.isFinite(anchorRaw) ? clamp(anchorRaw, 1, MAX_AYAH) : undefined,
    },
  };
}

/** The hash string (without `#`) for a view, its params and a reader target. */
export function serializeHash(
  view: View,
  reader: ReaderTarget | null,
  params: Record<string, string> = {},
): string {
  const q = new URLSearchParams(params).toString();
  const head = q ? `${view}?${q}` : view;
  if (!reader) return head;
  const anchor = reader.anchor !== undefined ? `/${reader.anchor}` : "";
  return `${head}/r/${reader.scope}/${reader.value}${anchor}`;
}
