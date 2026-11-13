import type { CapacitorConfig } from "@capacitor/cli";

// Android wrapper: the built SPA in dist/ ships inside the APK. Build it with
// `npm run build:android`, which leaves out the tafsirs the app downloads.
const config: CapacitorConfig = {
  appId: "io.github.ikkops.quranviz",
  appName: "Quran Viz",
  webDir: "dist",
};

export default config;
