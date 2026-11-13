import { useState } from "react";
import { Modal, ModalHeader, Select, Slider, Toggle } from "../ui";
import { PALETTES, type PaletteKey } from "../../theme/palettes";
import { ARABIC_FONTS, useTheme } from "../../theme/ThemeContext";
import { LANGS, MESSAGES, useI18n, type Lang } from "../../i18n/I18nContext";

export interface ChartSettings {
  bucketSize: number;
  extremesCount: number;
  /** Whole-interface zoom factor (CSS `zoom` on the app root). Default 1.5;
   *  capped on narrow screens by `effectiveUiScale` (lib/uiScale.ts). */
  uiScale: number;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onSettings,
  onAbout,
  onWelcome,
}: {
  open: boolean;
  onClose: () => void;
  settings: ChartSettings;
  onSettings: (s: ChartSettings) => void;
  onAbout: () => void;
  onWelcome: () => void;
}) {
  const theme = useTheme();
  const { t, lang, setLang } = useI18n();
  const [themeCode, setThemeCode] = useState("");
  const [themeMsg, setThemeMsg] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <ModalHeader title={t.settings.title} onClose={onClose} />
      <div className="space-y-5 px-5 py-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-subtle">
            {t.settings.language}
          </h3>
          <Select
            aria-label={t.settings.language}
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {MESSAGES[l].langName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-subtle">
            {t.settings.appearance}
          </h3>
          <div className="space-y-3">
            <Toggle
              checked={theme.dark}
              onChange={theme.toggleDark}
              label={t.settings.darkMode}
            />
            <Slider
              label={t.settings.uiScale(Math.round(settings.uiScale * 100))}
              min={1}
              max={2}
              step={0.05}
              value={settings.uiScale}
              onChange={(e) =>
                onSettings({ ...settings, uiScale: Number(e.target.value) })
              }
            />
            <div>
              <span className="mb-1.5 block text-sm text-ink-muted">
                {t.settings.palette}
              </span>
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
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-subtle">
            {t.settings.quranText}
          </h3>
          <div className="space-y-3">
            <Select
              label={t.settings.arabicFont}
              value={theme.arabicFont}
              onChange={(e) => theme.setArabicFont(e.target.value)}
            >
              {ARABIC_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
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
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-subtle">
            {t.settings.charts}
          </h3>
          <div className="space-y-4">
            <Slider
              label={t.settings.bucket}
              min={1}
              max={20}
              value={settings.bucketSize}
              onChange={(e) =>
                onSettings({ ...settings, bucketSize: Number(e.target.value) })
              }
            />
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
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-subtle">
            {t.settings.shareTheme}
          </h3>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                const code = theme.exportTheme();
                setThemeCode(code);
                navigator.clipboard?.writeText(code).catch(() => {});
                setThemeMsg(t.settings.copied);
              }}
              className="min-h-10 touch:min-h-11 rounded-lg bg-surface-sunken px-3 text-sm font-medium text-ink hover:bg-line/60"
            >
              {t.settings.exportTheme}
            </button>
            <div className="flex gap-2">
              <input
                value={themeCode}
                onChange={(e) => setThemeCode(e.target.value)}
                placeholder={t.settings.pasteTheme}
                aria-label={t.settings.pasteTheme}
                className="min-h-10 touch:min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
              />
              <button
                type="button"
                onClick={() => {
                  const ok = theme.importTheme(themeCode);
                  setThemeMsg(ok ? t.settings.applied : t.settings.invalid);
                }}
                className="min-h-10 touch:min-h-11 rounded-lg bg-surface-sunken px-3 text-sm font-medium text-ink hover:bg-line/60"
              >
                {t.common.apply}
              </button>
            </div>
            <p aria-live="polite" className="text-sm text-ink-muted">
              {themeMsg}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3">
          <button
            type="button"
            onClick={onAbout}
            className="min-h-10 touch:min-h-11 text-sm font-medium text-illumination hover:underline"
          >
            {t.settings.about}
          </button>
          <button
            type="button"
            onClick={onWelcome}
            className="min-h-10 touch:min-h-11 text-sm text-ink-muted hover:text-ink hover:underline"
          >
            {t.settings.welcomeAgain}
          </button>
        </div>
      </div>
    </Modal>
  );
}
