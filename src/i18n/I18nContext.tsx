import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { en, type Messages } from "./en";
import { id } from "./id";

export const LANGS = ["en", "id"] as const;
export type Lang = (typeof LANGS)[number];

export const MESSAGES: Record<Lang, Messages> = { en, id };

export interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Messages;
  /** Locale-aware number formatting (1,234 in English, 1.234 in Indonesian). */
  n: (x: number) => string;
  /** Translated revelation place ("Meccan" → "Makkiyah"). */
  place: (p: string) => string;
  /** Translated opening category. */
  category: (c: string) => string;
  /** Surah-name meaning in the UI language. */
  meaning: (s: { id: number; meaning: string }) => string;
}

function make(lang: Lang, setLang: (l: Lang) => void): I18n {
  const t = MESSAGES[lang];
  const fmt = new Intl.NumberFormat(t.locale);
  return {
    lang,
    setLang,
    t,
    n: (x) => fmt.format(x),
    place: (p) => t.place[p] ?? p,
    category: (c) => t.category[c] ?? c,
    meaning: (s) => t.surahMeanings?.[s.id - 1] ?? s.meaning,
  };
}

// Outside a provider (unit tests), the UI renders in English.
const I18nCtx = createContext<I18n>(make("en", () => {}));

/** Browser language on first visit: Indonesian if it starts with "id". */
function initialLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  return navigator.language?.toLowerCase().startsWith("id") ? "id" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = usePersistentState<Lang>(
    "qv.lang",
    initialLang(),
    persisted.oneOf(LANGS),
  );
  const value = useMemo(() => make(lang, setLang), [lang, setLang]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = MESSAGES[lang].app.title;
  }, [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nCtx);
}
