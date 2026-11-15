import type { ReactNode } from "react";
import { cx } from "../ui";
import type { WindowRows } from "./readerShared";

/**
 * The start of the neighbouring window beside the list during a held swipe:
 * what the reader shows at scrollTop 0 once it gets there. It sits in the
 * pager's track, level with the viewport (`top` = the list's scrollTop) and
 * one viewport tall, with the list's room for the floating head above it.
 * Only the first few rows are drawn, so mounting it does not stall the drag.
 */
// shortcut: the peek is static (no audio/selection highlight, no scroll); upgrade only if windows ever open mid-way.
export function ReaderPeek({
  dir,
  rows,
  top,
  height,
  headH,
  renderRow,
}: {
  dir: -1 | 1;
  rows: WindowRows;
  top: number;
  height: number;
  headH: number;
  renderRow: (rows: WindowRows, i: number) => ReactNode;
}) {
  const n = Math.min(rows.count, rows.layoutPages ? 1 : rows.pages ? 2 : 8);
  return (
    <div
      aria-hidden
      // `inert` is not in React 18's types; passed through as an attribute.
      {...({ inert: "" } as object)}
      className={cx(
        "pointer-events-none absolute w-full overflow-hidden",
        dir === 1 ? "left-full" : "right-full",
      )}
      style={{ top, height, paddingTop: headH }}
    >
      {Array.from({ length: n }, (_, i) => (
        <div key={i}>{renderRow(rows, i)}</div>
      ))}
    </div>
  );
}
