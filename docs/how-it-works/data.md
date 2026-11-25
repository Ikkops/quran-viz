# Data and sources

## Where the data comes from

| Data | Source |
|---|---|
| Arabic text (Uthmani, tajweed), structure, most translations | the quran-database SQLite dataset (`quran.db`) |
| Indonesian tafsirs (Mukhtasar, Sa'di), three Indonesian translations, Indonesian word glosses, similar ayahs, topics, section themes | QUL, the Tarteel Quranic Universal Library (`qul.db`) |
| Asbab al-nuzul, verified against the hadith collections | `hadith.db` |
| Word meanings and transliteration per word | quran.com's word data |
| Grammar tags, lemmas and roots | the Quranic Arabic Corpus |
| Transliteration, Indonesian surah names, Kemenag Tahlili | equran.id |
| Jalalayn (Indonesian) | api.alquran.cloud |
| Kemenag Wajiz | the public gadingnst/quran-api crawl |
| Mushaf page layouts (Madinah 1441 and 1405, IndoPak 15 and 16), translator footnotes | the quran.com API |
| Word timings for 12 reciters | quran-align (CC BY 4.0) |
| Recitation audio | everyayah.com, mp3quran.net, QuranicAudio.com |

The large databases sit outside the repository: `../quran-database-main/` and `../reference/quran-refs/`. Smaller sources are fetched once into checked-in snapshots under `scripts/data/`. `scripts/fetch_reader_data.py` and `scripts/fetch_tafsir_id.py` refresh them, slowly and politely.

## Rebuilding

```bash
npm run build:data
```

`scripts/build_data.py` reads `quran.db`, unpacking `quran.db.gz` if needed, along with `qul.db` and `hadith.db`, and writes `public/data/`. It stops with a message if a source is missing. `scripts/reader_data.py` writes the reader's extras: footnotes, transliteration, mushaf layouts, word data, word timings and audio clips. Tests: `uv run --with pytest python -m pytest scripts/`.

## Facts worth knowing

- **The basmala.** In the database, the basmala is part of ayah 1 of every surah but at-Tawbah. The build strips it from ayah 1 of surahs 2–114 (al-Fatihah keeps it as its first ayah) and flags those surahs, so the reader draws the basmala as its own line.
- **Hizb and rubʿ.** The database's `hizb_id` is really the quarter-hizb (1–240). The build maps the 60 hizbs from the `hizbs` table and keeps the quarter as `rub`.
- **Word and letter counts** aren't in the database. They are counted from the Uthmani text after the basmala strip: words split at spaces, letters counted with the diacritics removed. They differ from the classical totals by convention, not because the text differs.
- **Makki and Madani** are set per surah, with per-ayah exceptions where the scholars note them. Where they differ, the app says so.

## The files the app reads

The core ones are `surahs.json`, `verses-cols.json`, `editions.json`, `meta.json`, one `translations/<edition>.json` per edition, and `tafsir/<edition>/<surah>.json` for the long tafsirs. They are loaded lazily, as a screen needs them. The Android build leaves out the three large tafsirs, which the app downloads on request from the same commit's `public/data/` on GitHub. `AGENTS.md` lists every file and its shape.
