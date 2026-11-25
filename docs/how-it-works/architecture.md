# Architecture

quran-viz has no backend. It runs in two stages:

```text
 build time (Python)                         run time (browser or Android WebView)
 ───────────────────                         ─────────────────────────────────────
 quran.db, qul.db, hadith.db ─┐
                              ├─► scripts/build_data.py ─► public/data/*.json ─► React app (src/)
 scripts/data/*.json.gz ──────┘     reader_data.py                                  │      ▲
 (checked-in snapshots)                                                              ▼      │
                                                                               localStorage
                                    on request only: audio, word timings, large tafsirs, sync
```

1. **At build time**, Python scripts read the source databases and snapshot files and write compact JSON into `public/data/`: surahs, verses, editions, translations, tafsirs, word data, morphology, roots, similar ayahs, topics, mushaf layouts, word timings. This is the only place the 209 MB SQLite database is touched. The JSON is committed. Never edit it by hand: run `npm run build:data`.
2. **At run time**, a static React app loads that JSON and does everything else in the browser: reading, search, charts, the player, memorisation and its scheduler. Your data lives in `localStorage`.

The Android app is the same build inside [Capacitor](https://capacitorjs.com/), with the data bundled so it works offline. The app goes online only for four things, and only when you ask:

- recitation audio
- word timings
- the three large Indonesian tafsirs
- sync

## The code

```text
src/
├── views/        # one per tab: Home, Activity, Dashboard, Structure, Settings
├── components/   # reader/, hifdh/, marks/, dashboard/, charts/, peta/, shell/, settings/, ui/
├── data/         # pure data shaping, loaders and stores (recitation, audio, tafsir downloads)
├── lib/          # pure logic with tests: hifdh (FSRS), marks, lastRead, khatam, sync/, …
├── i18n/         # en.ts and id.ts: every interface string
└── theme/        # tokens, themes, palettes
scripts/          # the Python ETL, audio and timing tools, and their tests
android/          # the Capacitor project
```

Logic that can be pure is pure and tested next to its file (`hifdh.ts` and `hifdh.test.ts`). Components stay thin.

## Start-up and splitting

`App.tsx` holds the app-wide state: bookmarks, memorisation, recitation, the current view and the reader target. It switches between the five views. The views, the reader, search and the sync engine load as separate chunks on first use. Recharts loads with the first chart. The verses load by column (`verses-cols.json`), which halves the parse time.

The address bar holds the state: `#dashboard?v=length` for a chart and its filters, `#home/r/surah/36/3730` for the reader at an ayah. A link opens exactly that view.

## Design

`PRODUCT.md` says who the app is for. `DESIGN.md` is the design system: the colours (ink on a cool paper, lapis for what can be touched, the mushaf's red ink for markers, ochre and malachite for Makki and Madani), the type, the spacing and the components. The tokens live in `src/index.css`, `tailwind.config.js` and `src/theme/tokens.ts`.
