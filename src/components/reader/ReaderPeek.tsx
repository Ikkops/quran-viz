import { memo, type ReactNode } from "react";
import { cx } from "../ui";
import type { WindowRows } from "./readerShared";

/**
 * The start of a neighbouring window beside the list, in the pager's track:
 * what the reader shows at scrollTop 0 once it gets there. A full-height
 * pane laid out like the list (its padding, gutter and room for the floating
 * head), so the swap on arrival changes nothing on screen. Mounted when idle
 * and only the first few rows, so neither mounting it nor dragging it stalls.
 */
// shortcut: the peek is static (no audio/selection highlight, no scroll); upgrade only if windows ever open mid-way.
export const ReaderPeek = memo(ReaderPeekPane, (prev, next) =>
  // Out of sight while the list scrolls: its redraws wait until that ends.
  Boolean(
    next.frozen &&
    prev.rows === next.rows &&
    prev.dir === next.dir &&
    prev.headH === next.headH,
  ),
);

function ReaderPeekPane({
  dir,
  rows,
  headH,
  renderRow,
}: {
  dir: -1 | 1;
  rows: WindowRows;
  headH: number;
  renderRow: (rows: WindowRows, i: number) => ReactNode;
  /** The list is scrolling: skip redraws (the caller renders again after). */
  frozen?: boolean;
}) {
  const n = Math.min(rows.count, rows.layoutPages ? 1 : rows.pages ? 2 : 8);
  return (
    <div
      aria-hidden
      // `inert` is not in React 18's types; passed through as an attribute.
      {...({ inert: "" } as object)}
      className={cx(
        "pointer-events-none absolute inset-y-0 w-full overflow-hidden px-3 pt-1 [scrollbar-gutter:stable]",
        dir === 1 ? "left-full" : "right-full",
      )}
    >
      <div className="mx-auto max-w-4xl" style={{ paddingTop: headH }}>
        {Array.from({ length: n }, (_, i) => (
          <div key={i}>{renderRow(rows, i)}</div>
        ))}
      </div>
    </div>
  );
}
