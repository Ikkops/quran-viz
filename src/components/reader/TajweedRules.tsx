import {
  TAJWEED_EXAMPLES,
  TAJWEED_GROUPS,
  parseTajweed,
  tajweedColor,
} from "../../data/tajweed";
import { WAQF_SIGNS } from "../../data/waqf";
import { useI18n } from "../../i18n/I18nContext";

const heading = "mt-6 mb-1 text-heading text-ink first:mt-0";

/**
 * The tajweed legend as a page: the stop signs with their counts, then the
 * rules grouped as tajweed books teach them, each with its colour, trigger
 * letters, how it is read and a real example word from the edition with only
 * that rule coloured. Opened from the reader settings ("Tajweed rules").
 */
export function TajweedRules({ dark }: { dark: boolean }) {
  const { t, n } = useI18n();
  const notes: Record<string, string | undefined> = t.tajweedGroups.notes;
  return (
    <div className="px-4 py-3">
      <p className="mb-3 text-sm text-ink-muted">{t.reader.tajweedIntro}</p>

      <h3 className={heading}>{t.tajweedGroups.stop}</h3>
      <ul className="divide-y divide-line">
        {WAQF_SIGNS.map((s) => {
          const [name, meaning] = t.waqf.signs[s.key];
          return (
            <li key={s.key} className="flex items-center gap-3 py-2">
              <span
                aria-hidden
                className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                  s.tone === "rubric" ? "bg-rubric/15" : "bg-illumination/15"
                }`}
              >
                {/* The mark sits high on its base; nudge it into the disc. */}
                <span
                  lang="ar"
                  dir="rtl"
                  className="relative top-[0.4em] font-arabic text-[2.75rem] leading-none text-ink"
                >
                  {"\u00A0" + s.char}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{name}</p>
                <p className="text-sm text-ink-muted">{meaning}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
                {s.key === "muanaqah"
                  ? t.waqf.pairs(n(s.count))
                  : t.waqf.count(n(s.count))}
              </span>
            </li>
          );
        })}
      </ul>

      {TAJWEED_GROUPS.map((g) => (
        <section key={g.key}>
          <h3 className={heading}>
            {t.tajweedGroups[g.key as Exclude<keyof typeof t.tajweedGroups, "notes">]}
          </h3>
          <ul className="divide-y divide-line">
            {g.rules.map(({ code, letters }) => {
              const color = tajweedColor(code, dark);
              const ex = TAJWEED_EXAMPLES[code];
              return (
                <li
                  key={code}
                  className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3"
                >
                  <div className="flex min-w-0 flex-[1_1_14rem] items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-1 h-3.5 w-3.5 shrink-0 rounded"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{t.tajweed[code]}</p>
                      <p className="text-sm text-ink-muted">
                        {t.tajweedTrigger[code]}
                        {letters && (
                          <>
                            {" "}
                            <span
                              lang="ar"
                              dir="rtl"
                              className="inline-block font-arabic text-lg leading-normal tracking-widest [word-spacing:0.3em]"
                              style={{ color }}
                            >
                              {letters}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="text-sm text-ink-muted">{t.tajweedHelp[code]}</p>
                    </div>
                  </div>
                  {ex && (
                    <div className="ms-auto shrink-0 text-right">
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
          {notes[g.key] && <p className="pb-1 text-xs text-ink-subtle">{notes[g.key]}</p>}
        </section>
      ))}
    </div>
  );
}
