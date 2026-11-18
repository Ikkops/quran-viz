import { Fragment } from "react";
import type { Verse } from "../../types/quran";
import { parseTajweed, tajweedColor, type TajweedSegment } from "../../data/tajweed";
import { useArabicFont, useTheme } from "../../theme/ThemeContext";
import { ayahEnd } from "../../data/ayahContext";
import { withRubrics } from "./rubrics";
import { maskedParts, type WordMask } from "../../data/hifdh";
import { splitWords } from "../../data/mushafLayout";
import { MaskedWord } from "./Masked";

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
  const mark = ayahEnd(n, useArabicFont());
  return (
    <span className="whitespace-nowrap text-ink-muted">
      {" "}
      {mark}
    </span>
  );
}

/** One ayah's Arabic: tajweed-coloured when markup is given, red-ink signs
 *  otherwise, and the end medallion unless `noEnd`. With a `mask` (Hafalan
 *  mode) an ayah not yet revealed is drawn word by word, hidden parts as
 *  empty slots. */
export function AyahText({
  v,
  tajweed,
  noEnd,
  mask,
}: {
  v: Verse;
  tajweed?: string | null;
  noEnd?: boolean;
  mask?: WordMask | null;
}) {
  const hidden = !!mask && !mask.ayahShown(v.id);
  return (
    <>
      {hidden ? (
        splitWords(v.ar).map((w, i) => {
          const [show, hide] = maskedParts(mask, v.id, i, w);
          return (
            <Fragment key={i}>
              {i > 0 && " "}
              {hide ? <MaskedWord show={show} hide={hide} /> : withRubrics(w)}
            </Fragment>
          );
        })
      ) : tajweed ? (
        <TajweedSegs segs={parseTajweed(tajweed)} />
      ) : (
        withRubrics(v.ar)
      )}
      {!noEnd && <AyahEnd n={v.a} />}
    </>
  );
}
