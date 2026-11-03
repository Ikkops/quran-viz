# Quran — Data Visualization

A static React + TypeScript dashboard for exploring the Quran quantitatively and
textually. Rebuild of the original single-file `quran_data_visualization.tsx`,
now modular, typed, and backed by the richer **quran-database-main** SQLite
dataset instead of a manual Excel/CSV upload.

## Features

- **Dashboard** — 15 visualizations: words/letters/verses per surah, average
  verse length, size treemap & cards, words‑vs‑verses scatter, opening‑category
  (Fawatih) breakdown, juz→surah sunburst, verse‑length histogram & box plots,
  verse‑density heatmap, longest/shortest verses, and Arabic/English word clouds.
  Filter by surah or juz range, sort, colour by Meccan/Medinan or opening
  category, switch bar layout, and export any chart to PNG.
- **Structure** (new — enabled by the richer DB) — totals & Meccan/Medinan split,
  604‑page Mushaf density map, hizb (1–60) breakdown, and the 15 sajda markers.
- **Compare** (new) — view any surah with multiple translations side‑by‑side
  (100 editions, 43 languages), with an optional transliteration row.
- **Surah detail modal** — click any chart element to read a surah verse‑by‑verse
  with a chosen translation, transliteration toggle, in‑verse search, and an
  optional read‑only **tafsir context** (Al‑Muyassar / Al‑Jalalayn).
- Dark mode, colour palettes / custom colour, and shareable `#dashboard` /
  `#structure` / `#compare` URLs.

## Data pipeline

The app ships only compact static JSON; the 209 MB SQLite DB is build‑time only.

```bash
npm run build:data   # scripts/build_data.py: quran.db -> public/data/*.json
```

Outputs in `public/data/`:

| File | Contents |
| --- | --- |
| `surahs.json` | 114 surahs + aggregates (words, letters, pages, juz span) |
| `verses.json` | 6,236 verses: structure (juz/hizb/rub/page/sajda) + computed word/letter counts + Arabic text |
| `editions.json` | index of 100 text editions (translations, transliteration, tafsir) |
| `translations/<id>.json` | one lazy‑loaded file per edition, indexed by ayah id |
| `meta.json` | juz/hizb ranges, totals, classification, provenance |

Word/letter counts are computed from the Uthmani text (words = whitespace split;
letters = Arabic letters after stripping diacritics). `hizb` (1–60) is mapped
from the authoritative `hizbs` table ranges; `rub` is the raw 1–240 quarter index.

## Develop

```bash
npm install
npm run build:data   # requires ../quran-database-main/quran.db(.gz)
npm run dev          # http://localhost:5173
npm test             # vitest unit tests for the data utilities
npm run build        # typecheck + production build to dist/
```

## Stack

Vite · React 18 · TypeScript · Tailwind CSS · Recharts · lucide-react.
No backend — deployable to any static host.
