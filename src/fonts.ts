/**
 * Self-hosted fonts (Fontsource, all OFL-1.1). Vite bundles the woff2 files into
 * dist/, so the Android app renders the Qur'an in the chosen font offline.
 * Each @font-face carries a unicode-range, so only the subsets a page uses load.
 *
 * Qur'an fonts: the reader's choices in theme/ThemeContext.tsx (ARABIC_FONTS).
 * Literata ("Literata Variable") and Source Sans 3 ("Source Sans 3 Variable")
 * are the reading and UI faces of DESIGN.md (--font-reading / --font-ui).
 */
import "@fontsource/amiri-quran/400.css";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";
import "@fontsource/scheherazade-new/400.css";
import "@fontsource/scheherazade-new/700.css";
import "@fontsource/noto-naskh-arabic/400.css";
import "@fontsource/noto-naskh-arabic/700.css";
import "@fontsource/lateef/400.css";
import "@fontsource-variable/literata/opsz.css";
import "@fontsource-variable/literata/opsz-italic.css";
import "@fontsource-variable/source-sans-3/wght.css";

// The reading face (translations) loads at start, both styles and the Latin
// subsets they use, so the reader's text is drawn in it at once instead of
// in Georgia first.
for (const style of ["normal", "italic"])
  void document.fonts
    ?.load(`${style} 1em "Literata Variable"`, "A\u0101")
    .catch(() => undefined);
