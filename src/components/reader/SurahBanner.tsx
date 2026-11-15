import type { CSSProperties } from "react";
import type { Surah } from "../../types/quran";
import { cx } from "../ui";
import { SurahNameArt } from "../home/SurahRow";

/** Strokes stay hairlines whatever the size. */
const LINE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  vectorEffect: "non-scaling-stroke",
} as const;

/** Rub el hizb: the eight-pointed star of two squares, a ring at its heart. */
function Star() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-[0.62em] w-[0.62em] shrink-0">
      <path
        d="M10 1L7.36 3.64H3.64V7.36L1 10L3.64 12.64V16.36H7.36L10 19L12.64 16.36H16.36V12.64L19 10L16.36 7.36V3.64H12.64Z"
        {...LINE}
        fill="currentColor"
        fillOpacity={0.14}
      />
      <path
        d="M5 5H15V15H5Z M10 2.9L17.1 10L10 17.1L2.9 10Z"
        {...LINE}
        strokeOpacity={0.55}
      />
      <circle cx="10" cy="10" r="2.2" fill="currentColor" />
    </svg>
  );
}

/** The small diamond between two stars of the border band. */
function Diamond() {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="h-[0.22em] w-[0.22em] shrink-0">
      <path d="M5 0L10 5L5 10L0 5Z" fill="currentColor" fillOpacity={0.6} />
    </svg>
  );
}

/** A side panel: stars and diamonds repeated as a band, clipped at the outer
 *  edge so whole stars always meet the cartouche. */
function Band({ toward }: { toward: "end" | "start" }) {
  return (
    <div
      aria-hidden
      className={cx(
        "flex h-full min-w-0 flex-1 items-center gap-[0.14em] overflow-hidden px-[0.12em]",
        toward === "end" ? "flex-row-reverse" : "flex-row",
      )}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="contents">
          <Star />
          <Diamond />
        </span>
      ))}
    </div>
  );
}

/** One lobed end of the cartouche (drawn for the left; `flip` mirrors it):
 *  two rules swelling into a lobe and meeting at a point, the inside filled. */
function CartoucheEnd({ flip }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 40"
      preserveAspectRatio="none"
      className={cx(
        "h-full w-[0.55em] shrink-0 overflow-visible",
        flip && "-scale-x-100",
      )}
    >
      <path
        d="M16.5 7C11 7 9 12 7 15L5 20L7 25C9 28 11 33 16.5 33Z"
        className="fill-surface"
      />
      <path
        d="M16.5 3C9 3 7 10 4 14L1 20L4 26C7 30 9 37 16.5 37 M16.5 7C11 7 9 12 7 15L5 20L7 25C9 28 11 33 16.5 33"
        {...LINE}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The start of a surah in the mushaf layouts, after the illuminated surah
 * banners of printed mushafs: a double-ruled frame whose side panels carry a
 * band of eight-pointed stars, and in the middle a cartouche with lobed ends
 * holding the calligraphic name, with the number and name small beside it.
 * Theme tokens only (the accent for frame and ornament, a second tone by
 * opacity), so it reads in every theme. Sized in `em`: the caller sets the
 * font size and the height.
 */
export function SurahBanner({
  s,
  className,
  style,
}: {
  s: Surah;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      role="img"
      aria-label={`${s.number}. ${s.name}`}
      dir="ltr"
      className={cx(
        "rounded-[0.12em] border border-illumination/60 bg-surface-sunken p-[0.07em] text-illumination dark:bg-paper",
        className,
      )}
      style={style}
    >
      <div className="flex h-full items-center rounded-[0.08em] border border-illumination/40">
        <Band toward="end" />
        <div className="flex h-[86%] max-w-[75%] shrink-0 items-stretch">
          <CartoucheEnd />
          <div className="relative -mx-px flex min-w-0 items-center justify-center gap-[0.45em] px-[0.35em]">
            {/* The cartouche's two rules above and below, and its inside. */}
            <svg
              aria-hidden
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
            >
              <rect x="0" y="7" width="100" height="26" className="fill-surface" />
              <path d="M0 3H100M0 7H100M0 33H100M0 37H100" {...LINE} />
            </svg>
            <span className="relative truncate font-ui text-[max(0.625rem,0.36em)] tabular-nums text-ink-muted">
              {s.number}. {s.name}
            </span>
            <SurahNameArt
              s={s}
              className="relative text-[1.15em] leading-none text-ink"
            />
          </div>
          <CartoucheEnd flip />
        </div>
        <Band toward="start" />
      </div>
    </div>
  );
}
