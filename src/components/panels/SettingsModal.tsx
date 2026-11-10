import { useState } from "react";
import { Modal, ModalHeader, Select, Slider, Toggle } from "../ui";
import { PALETTES, type PaletteKey } from "../../theme/palettes";
import { ARABIC_FONTS, useTheme } from "../../theme/ThemeContext";
import { LANGS, MESSAGES, useI18n, type Lang } from "../../i18n/I18nContext";

export interface ChartSettings {
  bucketSize: number;
  extremesCount: number;
  /** Whole-interface zoom factor (CSS `zoom` on the app root). Default 1.5. */
  uiScale: number;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onSettings,
}: {
  open: boolean;
  onClose: () => void;
  settings: ChartSettings;
  onSettings: (s: ChartSettings) => void;
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.settings.language}
          </p>
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.settings.appearance}
          </p>
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
              <span className="mb-1.5 block text-sm text-slate-600 dark:text-slate-300">
                {t.settings.palette}
              </span>
              <div className="flex gap-2">
                {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      theme.setPaletteKey(k);
                      theme.setCustomPrimary(null);
                    }}
                    title={PALETTES[k].name}
                    className={
                      "h-8 w-8 rounded-full border-2 transition " +
                      (theme.paletteKey === k && !theme.customPrimary
                        ? "border-slate-800 dark:border-white"
                        : "border-transparent")
                    }
                    style={{ backgroundColor: PALETTES[k].primary }}
                  />
                ))}
                <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600">
                  <input
                    type="color"
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.settings.quranText}
          </p>
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
              dir="rtl"
              className="quran-text rounded-lg bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            >
              بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.settings.charts}
          </p>
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.settings.shareTheme}
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                const code = theme.exportTheme();
                setThemeCode(code);
                navigator.clipboard?.writeText(code).catch(() => {});
                setThemeMsg(t.settings.copied);
              }}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t.settings.exportTheme}
            </button>
            <div className="flex gap-2">
              <input
                value={themeCode}
                onChange={(e) => setThemeCode(e.target.value)}
                placeholder={t.settings.pasteTheme}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                onClick={() => {
                  const ok = theme.importTheme(themeCode);
                  setThemeMsg(ok ? t.settings.applied : t.settings.invalid);
                }}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t.common.apply}
              </button>
            </div>
            {themeMsg && <p className="text-xs text-emerald-500">{themeMsg}</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
