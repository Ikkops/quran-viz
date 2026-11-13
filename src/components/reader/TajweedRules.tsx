import {
  TAJWEED_EXAMPLES,
  TAJWEED_LEGEND,
  parseTajweed,
  tajweedColor,
} from "../../data/tajweed";
import { useI18n } from "../../i18n/I18nContext";

/**
 * The tajweed legend as a page: each colour, its rule, one line on what it
 * means and a real example word from the edition with only that rule coloured.
 * Opened from the reader settings ("Tajweed rules").
 */
export function TajweedRules({ dark }: { dark: boolean }) {
  const { t } = useI18n();
  return (
    <div className="px-4 py-3">
      <p className="mb-3 text-sm text-ink-muted">{t.reader.tajweedIntro}</p>
      <ul className="divide-y divide-line">
        {TAJWEED_LEGEND.map((r) => {
          const color = tajweedColor(r.code, dark);
          const ex = TAJWEED_EXAMPLES[r.code];
          return (
            <li key={r.code} className="flex items-start gap-3 py-3">
              <span
                aria-hidden
                className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {t.tajweed[r.code] ?? r.name}
                </p>
                <p className="text-sm text-ink-muted">{t.tajweedHelp[r.code]}</p>
              </div>
              {ex && (
                <div className="shrink-0 text-right">
                  <p
                    lang="ar"
                    dir="rtl"
                    className="font-arabic text-2xl leading-loose text-ink"
                  >
                    {parseTajweed(ex.marked).map((seg, i) =>
                      seg.rule ? (
                        <span key={i} style={{ color }}>
                          {seg.text}
                        </span>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </p>
                  <p className="text-xs tabular-nums text-ink-subtle">{ex.ref}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
