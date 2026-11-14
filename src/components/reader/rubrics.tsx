import { Fragment, type ReactNode } from "react";

/** Rub' al-hizb (۞) and sajdah (۩) signs in the mushaf's red ink (DESIGN.md
 *  "The Red Ink Rule"); everything else as is. */
export function withRubrics(text: string): ReactNode {
  const parts = text.split(/([۞۩])/);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    i % 2 ? (
      <span key={i} className="quran-mark">
        {p}
      </span>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}
