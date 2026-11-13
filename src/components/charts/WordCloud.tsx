import { useMemo } from "react";
import type { CloudWord } from "../../data/arabic";
import { cx } from "../ui";
import { useI18n } from "../../i18n/I18nContext";

/** Word cloud sized on a square-root scale, so one dominant word (Allah)
 *  doesn't shrink every other word to the minimum. Click a word to search it. */
export function WordCloud({
  words,
  arabic,
  primary,
  onWordClick,
}: {
  words: CloudWord[];
  arabic: boolean;
  primary: string;
  onWordClick?: (word: string) => void;
}) {
  const { t: tr, n } = useI18n();
  const { min, max } = useMemo(() => {
    if (!words.length) return { min: 0, max: 1 };
    return {
      min: Math.sqrt(words[words.length - 1].value),
      max: Math.sqrt(words[0].value),
    };
  }, [words]);
  const t = (v: number) => (max === min ? 0.5 : (Math.sqrt(v) - min) / (max - min));

  return (
    <div
      lang={arabic ? "ar" : undefined}
      dir={arabic ? "rtl" : "ltr"}
      className={cx(
        "flex h-full w-full flex-wrap content-center items-center justify-center gap-x-3 gap-y-1 overflow-y-auto p-2",
        arabic && "font-arabic",
      )}
    >
      {words.map((w) => {
        const k = t(w.value);
        return (
          <button
            type="button"
            key={w.text}
            title={`${w.text}: ${n(w.value)} — ${tr.charts.clickSearch}`}
            onClick={() => onWordClick?.(w.text)}
            style={{
              fontSize: (arabic ? 16 : 14) + k * (arabic ? 44 : 40),
              color: primary,
              opacity: 0.5 + 0.5 * k,
              lineHeight: arabic ? 1.5 : 1.15,
            }}
            className="font-semibold transition hover:scale-110 hover:opacity-100"
          >
            {w.text}
          </button>
        );
      })}
    </div>
  );
}
