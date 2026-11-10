import type { CapacitorConfig } from "@capacitor/cli";

// Android wrapper: the built SPA in dist/ (data included) ships inside the APK.
const config: CapacitorConfig = {
  appId: "io.github.ikkops.quranviz",
  appName: "Quran Viz",
  webDir: "dist",
};

export default config;
