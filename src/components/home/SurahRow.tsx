import type { RevelationType, Surah } from "../../types/quran";
import { useI18n } from "../../i18n/I18nContext";

/** Place of revelation as a small picture: the Kaaba for Makkah, the Prophet's
 *  mosque (dome and minaret) for Madinah. Named for screen readers. */
export function PlaceIcon({ type, size = 14 }: { type: RevelationType; size?: number }) {
  const { place } = useI18n();
  return (
    <svg
      role="img"
      aria-label={place(type)}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={type === "Meccan" ? "shrink-0 text-makki" : "shrink-0 text-madani"}
    >
      <title>{place(type)}</title>
      {type === "Meccan" ? (
        // A cube with the kiswah's band.
        <path d="M2.5 3h11a.5.5 0 0 1 .5.5V5H2V3.5a.5.5 0 0 1 .5-.5ZM2 6.2h12v6.3a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V6.2Zm4.5 2.3V13h3V8.5a1.5 1.5 0 0 0-3 0Z" />
      ) : (
        // A dome between its base and a minaret.
        <path d="M12.5 1.5 13.6 4v9h-2.2V4l1.1-2.5ZM6 3.2c.2 1.1 3.6 2.3 3.6 5.3H10V13H2V8.5h.4c0-3 3.4-4.2 3.6-5.3Z" />
      )}
    </svg>
  );
}

/** The surah's calligraphic name, drawn by the surah-name ligature face from
 *  its three-digit number; the plain Arabic name is what screen readers get. */
export function SurahNameArt({ s, className }: { s: Surah; className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden className="font-surah">
        {String(s.id).padStart(3, "0")}
      </span>
      <span lang="ar" className="sr-only">
        {s.nameAr}
      </span>
    </span>
  );
}

/** One surah in the index: number, name in the accent colour, its meaning and
 *  place, and the calligraphic name; a hairline closes the row. */
export function SurahRow({ s, onOpen }: { s: Surah; onOpen: () => void }) {
  const i = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[3.75rem] items-center gap-3 border-b border-line px-1 py-2 text-left transition-colors hover:bg-surface-sunken dark:hover:bg-surface"
    >
      <span className="w-8 shrink-0 text-center text-base tabular-nums text-ink-muted">
        {s.id}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-illumination">
          {s.name}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="truncate">{i.meaning(s)}</span>
          <PlaceIcon type={s.type} />
          <span className="shrink-0 tabular-nums text-ink-subtle">
            · {i.t.home.ayahs(s.ayahCount)}
          </span>
        </span>
      </span>
      <SurahNameArt s={s} className="shrink-0 text-[2rem] text-ink" />
    </button>
  );
}
