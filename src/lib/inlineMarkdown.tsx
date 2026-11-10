import { Fragment, type ReactNode } from "react";

const BOLD = /\*\*([^*\n]+?)\*\*/g;

/** Renders the only markdown the surah introductions use, `**bold**`, as
 *  React nodes (no HTML injection). Lone or unpaired `*` stays literal. */
export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(BOLD)) {
    const at = m.index ?? 0;
    if (at > last) out.push(<Fragment key={`t${last}`}>{text.slice(last, at)}</Fragment>);
    out.push(
      <strong key={`b${at}`} className="font-semibold">
        {m[1]}
      </strong>,
    );
    last = at + m[0].length;
  }
  if (last < text.length)
    out.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>);
  return out;
}
