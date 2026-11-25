import { defineConfig } from "vitepress";

// The docs site: `npm run docs:dev` to write, `npm run docs:build` for the
// static site that .github/workflows/docs.yml publishes to GitHub Pages.
export default defineConfig({
  title: "quran-viz docs",
  description: "How to use the Qur'an app, and how it works inside.",
  base: "/quran-viz/",
  lang: "en",
  cleanUrls: true,
  lastUpdated: true,
  head: [["link", { rel: "icon", href: "/quran-viz/favicon.svg" }]],
  themeConfig: {
    logo: "/favicon.svg",
    nav: [
      { text: "Guide", link: "/guide/install" },
      { text: "How it works", link: "/how-it-works/architecture" },
      { text: "Releases", link: "https://github.com/Ikkops/quran-viz/releases" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Install and update", link: "/guide/install" },
          { text: "Reading", link: "/guide/reading" },
          { text: "Listening", link: "/guide/listening" },
          { text: "Memorisation", link: "/guide/memorisation" },
          { text: "Bookmarks", link: "/guide/bookmarks" },
          { text: "Activity and khatam", link: "/guide/activity" },
          { text: "Dashboard and structure", link: "/guide/dashboard" },
          { text: "Settings, backup and sync", link: "/guide/settings" },
        ],
      },
      {
        text: "How it works",
        items: [
          { text: "Architecture", link: "/how-it-works/architecture" },
          { text: "Data and sources", link: "/how-it-works/data" },
          { text: "The reader", link: "/how-it-works/reader" },
          { text: "Audio and word timings", link: "/how-it-works/audio" },
          { text: "Memorisation scheduling", link: "/how-it-works/scheduling" },
          { text: "Storage and sync", link: "/how-it-works/storage-sync" },
          { text: "Build, test, release", link: "/how-it-works/build-release" },
          { text: "Languages", link: "/how-it-works/languages" },
        ],
      },
    ],
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/Ikkops/quran-viz" }],
    editLink: {
      pattern: "https://github.com/Ikkops/quran-viz/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    outline: [2, 3],
  },
});
