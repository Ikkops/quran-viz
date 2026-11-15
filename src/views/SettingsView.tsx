import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button, Card, Select, Slider, cx } from "../components/ui";
import { PALETTES, type PaletteKey } from "../theme/palettes";
import { ARABIC_FONTS, THEME_CHOICES, useTheme } from "../theme/ThemeContext";
import { THEMES } from "../theme/tokens";
import { LANGS, MESSAGES, useI18n, type Lang } from "../i18n/I18nContext";
import { LAST_READ_COUNTS } from "../lib/lastRead";
import { SHORTCUTS } from "../lib/shortcuts";
import { isNativeApp } from "../data/audioStore";
import type { Surah } from "../types/quran";
import { AudioStorageSettings } from "../components/settings/AudioStorageSettings";

export interface ChartSettings {
  bucketSize: number;
  extremesCount: number;
  /** Whole-interface zoom factor (CSS `zoom` on the app root). Default 1.5;
   *  capped on narrow screens by `effectiveUiScale` (lib/uiScale.ts). */
  uiScale: number;
}

/** A titled card of settings; each child is one row, hairlines between rows. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="text-heading text-ink">{title}</h2>
      <div className="mt-1 divide-y divide-line *:py-3 [&>*:last-child]:pb-0">
        {children}
      </div>
    </Card>
  );
}

/** One setting: its label on the left, the control on the right; anything
 *  wider (a grid, a note) wraps onto its own line with `basis-full`. */
function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {label && <span className="text-sm text-ink">{label}</span>}
      {children}
    </div>
  );
}

/** Settings: language, theme, Qur'an text, last read, audio folder (in the
 *  Android app), charts, keyboard shortcuts, about. */
export function SettingsView({
  surahs,
  settings,
  onSettings,
  lastReadCount,
  onLastReadCount,
  onAbout,
  onWelcome,
}: {
  surahs: Surah[];
  settings: ChartSettings;
  onSettings: (s: ChartSettings) => void;
  /** How many "last read" places Home shows. */
  lastReadCount: number;
  onLastReadCount: (n: number) => void;
  onAbout: () => void;
  onWelcome: () => void;
}) {
  const theme = useTheme();
  const { t, lang, setLang } = useI18n();
  const [themeCode, setThemeCode] = useState("");
  const [themeMsg, setThemeMsg] = useState<string | null>(null);

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] items-start gap-4">
      <Section title={t.settings.language}>
        <div>
          <Select<Lang>
            ariaLabel={t.settings.language}
            value={lang}
            onChange={setLang}
            options={LANGS.map((l) => ({ value: l, label: MESSAGES[l].langName }))}
          />
        </div>
      </Section>
      <Section title={t.settings.appearance}>
        <Row label={t.settings.theme}>
          <div
            role="radiogroup"
            aria-label={t.settings.theme}
            className="grid basis-full grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2"
          >
            {THEME_CHOICES.map((c) => {
              const on = theme.theme === c;
              // "System" shows the day and night papers side by side.
              const a = THEMES[c === "system" ? "light" : c].tokens;
              const b = THEMES[c === "system" ? "dark" : c].tokens;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => theme.setTheme(c)}
                  className={cx(
                    "flex min-h-11 flex-col gap-1.5 rounded-lg border p-1.5 text-left text-xs transition-colors",
                    on
                      ? "border-illumination bg-illumination/10 font-semibold text-ink"
                      : "border-line bg-surface text-ink-muted hover:border-ink-subtle",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex h-9 items-center justify-center rounded-md border border-line/60 text-sm font-semibold"
                    style={{
                      background: `linear-gradient(90deg, ${a.paper} 50%, ${b.paper} 50%)`,
                      color: a.ink,
                    }}
                  >
                    <span style={{ color: a.ink }}>A</span>
                    <span style={{ color: b.ink }}>a</span>
                  </span>
                  <span className="flex items-center justify-between gap-1 px-0.5">
                    <span className="truncate">{t.settings.themes[c]}</span>
                    {on && (
                      <Check
                        size={13}
                        aria-hidden
                        className="shrink-0 text-illumination"
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Row>
        <div>
          <Slider
            label={t.settings.uiScale(Math.round(settings.uiScale * 100))}
            min={1}
            max={2}
            step={0.05}
            value={settings.uiScale}
            onChange={(e) => onSettings({ ...settings, uiScale: Number(e.target.value) })}
          />
        </div>
        <Row label={t.settings.palette}>
          <div className="flex gap-2">
            {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-label={PALETTES[k].name}
                aria-pressed={theme.paletteKey === k && !theme.customPrimary}
                onClick={() => {
                  theme.setPaletteKey(k);
                  theme.setCustomPrimary(null);
                }}
                title={PALETTES[k].name}
                className={
                  "h-10 w-10 touch:min-h-11 touch:min-w-11 rounded-full border-2 transition " +
                  (theme.paletteKey === k && !theme.customPrimary
                    ? "border-ink"
                    : "border-transparent")
                }
                style={{ backgroundColor: PALETTES[k].primary }}
              />
            ))}
            <label className="flex h-10 w-10 touch:min-h-11 touch:min-w-11 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-line focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-illumination">
              <input
                type="color"
                aria-label={t.settings.customColor}
                className="h-6 w-6 cursor-pointer opacity-0"
                value={theme.primary}
                onChange={(e) => theme.setCustomPrimary(e.target.value)}
              />
              <span
                className="pointer-events-none -ml-6 h-5 w-5 rounded-full"
                style={{ backgroundColor: theme.customPrimary ?? "transparent" }}
              />
            </label>
          </div>
        </Row>
      </Section>

      <Section title={t.settings.quranText}>
        <Row label={t.settings.arabicFont}>
          <Select
            className="w-52 max-w-full"
            ariaLabel={t.settings.arabicFont}
            value={theme.arabicFont}
            onChange={theme.setArabicFont}
            options={ARABIC_FONTS.map((f) => ({ value: f, label: f }))}
          />
        </Row>
        <div className="space-y-3">
          <Slider
            label={t.settings.arabicSize}
            min={0.5}
            max={2}
            step={0.05}
            value={theme.arabicScale}
            onChange={(e) => theme.setArabicScale(Number(e.target.value))}
          />
          <p
            lang="ar"
            dir="rtl"
            className="quran-text rounded-lg bg-surface-sunken px-3 py-2 text-ink"
          >
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
        </div>
      </Section>

      <Section title={t.settings.reading}>
        <Row label={t.settings.lastReadCount}>
          <Select
            className="w-36"
            ariaLabel={t.settings.lastReadCount}
            value={lastReadCount}
            onChange={onLastReadCount}
            options={LAST_READ_COUNTS.map((c) => ({
              value: c,
              label: t.settings.places(c),
            }))}
          />
          <p className="basis-full text-xs text-ink-subtle">{t.settings.lastReadHelp}</p>
        </Row>
      </Section>

      {isNativeApp() && (
        <Section title={t.settings.audioStorage}>
          <div>
            <AudioStorageSettings surahs={surahs} />
          </div>
        </Section>
      )}

      <Section title={t.settings.charts}>
        <div>
          <Slider
            label={t.settings.bucket}
            min={1}
            max={20}
            value={settings.bucketSize}
            onChange={(e) =>
              onSettings({ ...settings, bucketSize: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Slider
            label={t.settings.extremes}
            min={1}
            max={15}
            value={settings.extremesCount}
            onChange={(e) =>
              onSettings({ ...settings, extremesCount: Number(e.target.value) })
            }
          />
        </div>
      </Section>

      <Section title={t.settings.shareTheme}>
        <div className="space-y-2">
          <Button
            onClick={() => {
              const code = theme.exportTheme();
              setThemeCode(code);
              navigator.clipboard?.writeText(code).catch(() => {});
              setThemeMsg(t.settings.copied);
            }}
          >
            {t.settings.exportTheme}
          </Button>
          <div className="flex gap-2">
            <input
              value={themeCode}
              onChange={(e) => setThemeCode(e.target.value)}
              placeholder={t.settings.pasteTheme}
              aria-label={t.settings.pasteTheme}
              className="h-9 min-w-0 flex-1 rounded border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-ink-subtle touch:min-h-11"
            />
            <Button
              onClick={() => {
                const ok = theme.importTheme(themeCode);
                setThemeMsg(ok ? t.settings.applied : t.settings.invalid);
              }}
            >
              {t.common.apply}
            </Button>
          </div>
          <p aria-live="polite" className="text-sm text-ink-muted">
            {themeMsg}
          </p>
        </div>
      </Section>

      <Section title={t.app.shortcuts}>
        <div>
          <table className="w-full text-sm">
            <tbody>
              {SHORTCUTS.map((sc, i) => (
                <tr key={sc.keys} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-ink-muted">
                    {sc.keys}
                  </td>
                  <td className="py-2 text-ink">{t.shortcuts[i] ?? sc.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="col-span-full flex flex-wrap gap-2">
        <Button onClick={onAbout}>{t.settings.about}</Button>
        <Button variant="quiet" onClick={onWelcome}>
          {t.settings.welcomeAgain}
        </Button>
      </div>
    </div>
  );
}
