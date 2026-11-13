import { BookOpen, Map as MapIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { BASE } from "../../data/base";
import { searchEditionFor } from "../../data/searchEdition";
import { LANGS, MESSAGES, useI18n, type Lang } from "../../i18n/I18nContext";
import { ARABIC_FONTS, useTheme } from "../../theme/ThemeContext";
import type { Edition } from "../../types/quran";
import { cx, Modal, Select } from "../ui";

export type WelcomeChoice = "read" | "map" | null;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      {children}
    </fieldset>
  );
}

/**
 * First run: one screen to pick the interface language, the Qur'an font and the
 * reader's translation, then start reading or open the map. Every choice is the
 * same setting Settings and the reader change later.
 */
export function Welcome({
  open,
  onDone,
  editions,
  edition,
  onEdition,
  onAbout,
}: {
  open: boolean;
  /** Close the screen, then go to the chosen destination (null: stay). */
  onDone: (choice: WelcomeChoice) => void;
  editions: Edition[];
  edition: string;
  onEdition: (id: string) => void;
  onAbout: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const theme = useTheme();
  const w = t.welcome;
  const translations = editions.filter(
    (e) => e.type === "translation" && (e.language === lang || e.language === "en"),
  );
  // Open on a translation in the interface language (a new learner's stored
  // edition is the English default even when the UI is Indonesian).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const pick = searchEditionFor(lang, edition, editions);
    if (pick !== edition) onEdition(pick);
  }, [lang, edition, editions, onEdition]);
  const pickLang = (l: Lang) => {
    setLang(l);
    // Follow the language unless the learner already picked one in it.
    onEdition(searchEditionFor(l, edition, editions));
  };

  return (
    <Modal
      open={open}
      onClose={() => onDone(null)}
      className="max-w-lg"
      ariaLabel={w.heading}
    >
      <div className="px-5 pb-5 pt-6 sm:px-7">
        <div className="flex items-center gap-4">
          <img
            src={`${BASE}favicon.svg`}
            alt=""
            aria-hidden
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-2xl ring-1 ring-line"
          />
          <div className="min-w-0">
            <h2 className="font-reading text-xl font-semibold leading-snug text-ink">
              {w.heading}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{w.intro}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <Field label={w.language}>
            <div className="grid grid-cols-2 gap-2">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => pickLang(l)}
                  className={cx(
                    "min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors",
                    lang === l
                      ? "border-illumination bg-illumination/10 text-ink"
                      : "border-line text-ink-muted hover:text-ink",
                  )}
                >
                  {MESSAGES[l].langName}
                </button>
              ))}
            </div>
          </Field>

          <Field label={w.font}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
              {ARABIC_FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={theme.arabicFont === f}
                  onClick={() => theme.setArabicFont(f)}
                  className={cx(
                    "flex flex-col items-stretch rounded-lg border px-3 pb-2 pt-1 text-left transition-colors",
                    theme.arabicFont === f
                      ? "border-illumination bg-illumination/10"
                      : "border-line hover:border-ink-subtle",
                  )}
                >
                  <span
                    lang="ar"
                    dir="rtl"
                    className="truncate text-right text-xl leading-[2.1] text-ink"
                    style={{ fontFamily: `"${f}", serif` }}
                  >
                    {w.sample}
                  </span>
                  <span className="text-xs text-ink-subtle">{f}</span>
                </button>
              ))}
            </div>
          </Field>

          <div>
            <Select
              label={w.translation}
              value={edition}
              onChange={onEdition}
              options={translations.map((e) => ({
                value: e.identifier,
                label: e.englishName,
              }))}
            />
            <p className="mt-1 text-xs text-ink-subtle">{w.translationHint}</p>
          </div>
        </div>

        <div className="mt-7 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onDone("read")}
            className="flex min-h-14 items-center gap-3 rounded-xl bg-illumination px-4 py-2.5 text-left text-white dark:text-paper"
          >
            <BookOpen size={20} aria-hidden className="shrink-0" />
            <span>
              <span className="block font-semibold">{w.read}</span>
              <span className="block text-xs opacity-85">{w.readHint}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDone("map")}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-left text-ink hover:bg-surface-sunken"
          >
            <MapIcon size={20} aria-hidden className="shrink-0 text-illumination" />
            <span>
              <span className="block font-semibold">{w.explore}</span>
              <span className="block text-xs text-ink-subtle">{w.exploreHint}</span>
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={onAbout}
          className="mx-auto mt-4 block min-h-10 touch:min-h-11 px-2 text-sm text-illumination underline-offset-4 hover:underline"
        >
          {w.about}
        </button>
      </div>
    </Modal>
  );
}
