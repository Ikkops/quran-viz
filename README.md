# Quran — Data Visualization

A static React + TypeScript app for reading the Quran and exploring it
quantitatively: a reader, a dashboard of charts, and the mushaf's structure. It
is backed by the **quran-database-main** SQLite dataset and the QUL corpus,
turned into static JSON at build time. The same build ships as an Android app.

[`AGENTS.md`](AGENTS.md) is the full guide (commands, data pipeline, runtime
architecture, UI patterns); [`PRODUCT.md`](PRODUCT.md) and
[`DESIGN.md`](DESIGN.md) say who the app is for and how it should look.

## Features

- **Home**: where reading last stopped, today's reading time and streak, and
  the index of surahs, juz and manzils.
- **Reader**: ayah by ayah or as mushaf pages (four printed layouts), with
  several translations and tafsirs side by side, transliteration, tajweed
  colours, word-by-word meanings and grammar, translator footnotes, asbab
  al-nuzul, find-in-text, pins and collections with notes, and recitation with
  range repeat and word highlighting.
- **Dashboard**: each chart answers a question (surah length, verse-length
  distribution, opening categories, roots, topics, similar ayahs, word
  clouds…), with filters, a data table, and PNG / CSV export.
- **Structure**: totals and the Makki/Madani split, the 604-page mushaf map,
  hizb breakdown and the sajda markers.
- **Activity**: reading statistics and a daily goal; bookmarks, with backup to
  a file.
- **Settings**: language (English / Indonesian), themes, interface scale,
  Qur'an font, audio storage (Android).
- Shareable `#dashboard` / `#structure` links and deep links to any ayah.

## Data pipeline

The app ships only compact static JSON; the 209 MB SQLite DB is build‑time only.

```bash
npm run build:data   # scripts/build_data.py: quran.db -> public/data/*.json
```

The core outputs in `public/data/` (the full list is in `AGENTS.md`):

| File | Contents |
| --- | --- |
| `surahs.json` | 114 surahs + aggregates (words, letters, pages, juz span) |
| `verses.json` | 6,236 verses: structure (juz/hizb/rub/page/sajda) + computed word/letter counts + Arabic text |
| `editions.json` | index of the text editions (translations, transliteration, tafsir) |
| `translations/<id>.json` | one lazy‑loaded file per edition, indexed by ayah id |
| `meta.json` | juz/hizb ranges, totals, classification, provenance |

Word/letter counts are computed from the Uthmani text (words = whitespace split;
letters = Arabic letters after stripping diacritics). `hizb` (1–60) is mapped
from the authoritative `hizbs` table ranges; `rub` is the raw 1–240 quarter index.

## Develop

```bash
npm install
npm run build:data   # requires ../quran-database-main/quran.db(.gz) and ../reference/quran-refs/{qul,hadith}.db
npm run dev          # http://localhost:5173
npm test             # vitest: data utilities, stores and components
npm run build        # typecheck + production build to dist/
```

## Android app

The same build ships as an Android app via [Capacitor](https://capacitorjs.com/)
(`capacitor.config.ts`, `android/`), with the data bundled so it works offline;
recitation audio and three large tafsirs are downloaded on request.

- **Pull requests** build a signed APK and attach it to the Actions run.
- **Pushes to `main`** build it and publish a GitHub Release `v1.0.<run>`.
- On the tablet, [Obtainium](https://github.com/ImranR98/Obtainium) watches this
  repo's releases and installs updates.

One-time setup: the signing key lives in `~/.config/quran-viz-android/` (back it
up — a lost key means uninstalling and reinstalling the app); run
`scripts/android-set-secrets.sh` to copy it into the repo's Actions secrets.

## Stack

Vite · React 18 · TypeScript · Tailwind CSS · Recharts · lucide-react.
No backend — deployable to any static host.
