import { Fragment } from "react";
import type { Verse } from "../../types/quran";
import { parseTajweed, tajweedColor, type TajweedSegment } from "../../data/tajweed";
import { useArabicFont, useTheme } from "../../theme/ThemeContext";
import { ayahEndMark } from "../../data/ayahContext";
import { withRubrics } from "./rubrics";

/** Tajweed-coloured pieces of text (one word, or a whole ayah). */
export function TajweedSegs({ segs }: { segs: TajweedSegment[] }) {
  const { dark } = useTheme();
  return (
    <>
      {segs.map((seg, i) =>
        seg.rule ? (
          <span key={i} style={{ color: tajweedColor(seg.rule, dark) }}>
            {seg.text}
          </span>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

/** The ayah-end medallion with the ayah number, kept on the line of the last
 *  word (a no-break space before it). */
export function AyahEnd({ n }: { n: number }) {
  const arabicFont = useArabicFont();
  // The KFGQPC face draws the digits themselves as the medallion with its
  // number; U+06DD before them would add a second, empty one.
  const mark = arabicFont === "KFGQPC Hafs" ? ayahEndMark(n).slice(1) : ayahEndMark(n);
  return (
    <span className="whitespace-nowrap text-ink-muted">
      {" "}
      {mark}
    </span>
  );
}

/** One ayah's Arabic: tajweed-coloured when markup is given, red-ink signs
 *  otherwise, and the end medallion unless `noEnd`. */
export function AyahText({
  v,
  tajweed,
  noEnd,
}: {
  v: Verse;
  tajweed?: string | null;
  noEnd?: boolean;
}) {
  return (
    <>
      {tajweed ? <TajweedSegs segs={parseTajweed(tajweed)} /> : withRubrics(v.ar)}
      {!noEnd && <AyahEnd n={v.a} />}
    </>
  );
}
