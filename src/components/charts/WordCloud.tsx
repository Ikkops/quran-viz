import { useMemo } from "react";
import type { CloudWord } from "../../data/arabic";
import { cx } from "../ui";

export function WordCloud({
  words,
  arabic,
  primary,
}: {
  words: CloudWord[];
  arabic: boolean;
  primary: string;
}) {
  const { min, max } = useMemo(() => {
    if (!words.length) return { min: 0, max: 1 };
    return {
      min: words[words.length - 1].value,
      max: words[0].value,
    };
  }, [words]);

  const size = (v: number) => {
    if (max === min) return 18;
    const t = (v - min) / (max - min);
    return 12 + t * 36; // 12px .. 48px
  };

  return (
    <div
      dir={arabic ? "rtl" : "ltr"}
      className={cx(
        "flex h-full w-full flex-wrap content-center items-center justify-center gap-x-3 gap-y-1 overflow-y-auto p-2",
        arabic && "font-arabic",
      )}
    >
      {words.map((w) => {
        const t = max === min ? 0.5 : (w.value - min) / (max - min);
        return (
          <span
            key={w.text}
            title={`${w.text}: ${w.value}`}
            style={{
              fontSize: size(w.value),
              color: primary,
              opacity: 0.45 + 0.55 * t,
              lineHeight: 1.1,
            }}
            className="font-semibold transition hover:scale-110"
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}
