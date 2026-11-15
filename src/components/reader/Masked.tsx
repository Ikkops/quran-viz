import { cx } from "../ui";

/** How a word the learner stumbled on is marked once it is visible again. */
export const STUMBLED =
  "underline decoration-rubric decoration-dotted decoration-1 underline-offset-[0.4em]";

/**
 * A word in Hafalan mode: the part still shown, then the hidden part drawn
 * transparent over a faint slot, so the word keeps its width and the page its
 * shape. The hidden part is kept from screen readers too.
 */
export function MaskedWord({
  show,
  hide,
  className,
}: {
  show: string;
  hide: string;
  className?: string;
}) {
  return (
    <>
      {show}
      <span
        aria-hidden
        className={cx("select-none rounded-sm bg-line/70 text-transparent", className)}
      >
        {hide}
      </span>
    </>
  );
}
