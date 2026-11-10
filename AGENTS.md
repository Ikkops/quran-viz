# AGENTS.md

Context for agents working in `quran-viz/`. The workspace layout, reference
corpus, and the juz-writing protocol are in `../AGENTS.md`; this file covers the
app: commands, ETL, data gotchas, runtime architecture, and UI patterns.

## Commands (run from `quran-viz/`)

```bash
npm install
npm run build:data          # Python ETL: quran.db → public/data/*.json
npm run dev                 # Vite dev server (check port in output)
npm run build               # tsc --noEmit && vite build
npm run typecheck           # tsc --noEmit
npm run lint                # eslint .
npm run lint:fix            # eslint . --fix
npm run format              # prettier --write "src/**/*.{ts,tsx,css}"
npm run format:check        # prettier --check "src/**/*.{ts,tsx,css}"
npm test                    # vitest run (all JS)
npm test -- --reporter=verbose         # verbose output
npx vitest run src/data/selectors.test.ts   # single test file
npx vitest run -t "flags muqatta'at"        # single test by name
python3 -m pytest scripts/test_build_data.py        # Python ETL tests
```

`build:data` requires `../quran-database-main/quran.db` (if only `quran.db.gz`
exists, the script gunzips it automatically) **and** `../reference/quran-refs/qul.db`
+ `hadith.db` (it exits with a message if either is missing).

## Toolchain quirks

- **Vite 8 + `@vitejs/plugin-react` 6** is a hard peer pairing — bump both or neither.
- **ESLint** uses flat config (`eslint.config.js`). Four `react-hooks` v7 rules are off
  (`set-state-in-effect`, `no-mutation-after-render`, `incompatible-library`,
  `immutability`) — they fire on the lazy-fetch hooks and `useMemo` locals.
- **Prettier** is fully configured (`.prettierrc.json`) and integrated via
  `eslint-config-prettier`. Format before committing.
- **Tests** use jsdom + RTL (`vitest.config.ts`, `src/test/setup.ts`).
  `@tanstack/react-virtual` is mocked in tests (jsdom has 0-height container →
  0 virtual rows).
- **Android (Capacitor 8)**: `npx cap sync android` copies `dist/` into
  `android/app/src/main/assets/public/` (gitignored). `.github/workflows/android.yml`
  builds it; `versionCode` = run number and release signing both come from env
  vars in `android/app/build.gradle`. In the app, `<a download>` does nothing, so
  `lib/export.ts` routes PNG/CSV through `@capacitor/filesystem` + `@capacitor/share`
  when `Capacitor.isNativePlatform()`. `core.fileMode` is false here: keep
  `android/gradlew` at mode 100755 in the index (`git update-index --chmod=+x`).

## Architecture: two stages, no backend

**1. Build-time ETL (Python).** `scripts/build_data.py` reads the SQLite DB and
emits compact static JSON into `public/data/`. This is the only place the 209 MB
DB is touched. Outputs: `surahs.json`, `verses.json`, `editions.json`,
`meta.json`, `tajweed.json`, `wordbyword.json`, `morphology.json`, `roots.json`
(every corpus root with the ayah id of each occurrence, for the Root explorer),
`similar.json` (QUL similar-ayah pairs, deduplicated to undirected
`[a, b, score, words]`), `themes.json` (QUL section themes as ayah-id ranges),
`topics.json` (QUL topics + their ayah ids), `wordbyword-id.json` (QUL Indonesian
glosses paired with QUL's own Arabic words: pause marks dropped, the trailing
`(n)` ayah number dropped), `surah-info-{en,id}.json`, `asbab.json` (verified
Arabic asbab; ranges clamped to the surah's last ayah, since the source counts
al-ʿAlaq as 20 verses), `chronology.json` (the Browse timeline, see below),
`tafsir/<ident>/<surah>.json` (the two QUL Indonesian
tafsirs, `id.mukhtasar-qul` and `id.saadi-qul`, as passage lists
`[[fromAyah, toAyah, text], …]`: QUL repeats a passage's text on every ayah of
its `group_key`, so `group_tafsir` keeps it once; Sa'di is ~9 MB, hence per-surah
files), and one `translations/<edition>.json` per edition
(including the three QUL Indonesian ones, `id.kemenag-qul`/`id.kfc-qul`/
`id.sabiq-qul`, cleaned of footnote residue in five verses). Regenerate with
`npm run build:data` — **never hand-edit files in `public/data/`.**

**Revelation order and ayah-level places.** `surahs[].revelationOrder` (1–114,
the standard Egyptian order) comes from `qul.db` `chapters.revelation_order`; the
ETL fails unless it is a permutation of 1..114. Per-ayah places come from the
checked-in `scripts/data/ayah_place_exceptions.json` (164 ayahs): the
Makki/Madani labels of the old `Dataset-Verse-by-Verse.xlsx`, which follow the
Egyptian-mushaf surah headers, corrected where two sources agree (added 6:141 and
39:52–54, removed 16:114 and 22:56). Only ayahs whose place differs from their
surah's get `verses[].p` (`Meccan` | `Medinan` | `Hijra` = revealed en route:
22:52–55, 28:85, 47:13); `surahs[].exceptions` counts them and
`meta.classificationByAyah` gives the ayah-level split. These are traditional
attributions that commentators dispute; the UI always shows `PLACE_CAVEAT`
(`components/charts/common.ts`). Use `ayahPlace(v, surahMap)` from
`data/selectors.ts`, never `v.p` alone.

**Surah chronology (Browse → Sort → Timeline).** The checked-in
`scripts/data/surah_chronology.json` places each surah in the one period its
revelation began: five Makkah periods (sirah phases, `m1`–`m5`) and ten Madinah
years (`y1`–`y10`), each with dated marker events from `../sirah/00-timeline.md`.
Long surahs carry `span` (Hijri years, e.g. Al-Baqarah `[1, 10]`). `basis` says
how it was dated: `asbab` (a verified `sahih-ar` narration names the event; its
`refs` must be covered by `asbab.json`), `sirah`, or `urutan` (only the surah's
band in the Egyptian order; the card says "approx."). `check_chronology` fails
the ETL unless 1..114 appear once, periods/events exist, refs exist, and the
period's phase matches the surah's Makki/Madani header (or the entry has a
`typeNote`). Grouping is `groupByTimeline` in `data/chronology.ts`. Edit the
JSON, never `public/data/chronology.json`.

The ETL reads read-only from `../reference/quran-refs/qul.db` (the `meta_ruku`,
`meta_manzil`, `similar`, `themes`, `topics`/`topic_ayahs`, `translations`,
`wbw` (`wbw-id`), `surah_info` and `tafsirs` (`mukhtasar-id`, `saadi-id`) tables) and from `hadith.db` only `asbab` rows
with `source='sahih-ar'` (never `wahidi-en`, a copyrighted translation).

**2. Runtime (static React).** The app fetches the prebuilt JSON; there is no server.

- `data/useQuranData.ts` — fetches the 4 core JSON files on mount. Returns
  `{ surahs, verses, editions, meta }` or null while loading.
- `data/useTranslation(editionId)` — lazy-fetches a single translation edition.
  LRU-capped at 24 editions. Returns `{ data, loading, error }`.
- `data/useLazyJson<T>(key, enabled)` — generic singleton-cache hook. Backs
  `useTajweed`, `useWordByWord`, `useMorphology`, `useRoots`, `useSimilar`,
  `useThemes`, `useTopics`, `useAsbab`, `useSurahInfo`, `useChronology`. (Grouped tafsir has its
  own per-surah loader, `data/useGroupedTafsir(ident, surahIds)`; the tafsir list
  and each edition's kind — `ayah` vs `grouped` — live in
  `data/editions.ts:TAFSIR_EDITIONS`.) Pass
  `useLazyJson("tajweed", showTajweed)`. Module-global cache + inflight-dedupe.
  Returns `{ data, loading, error }`. To add a new lazy-loaded data file, drop a
  thin wrapper around `useLazyJson`.
- `data/base.ts` — exports `BASE` and `dataUrl(path)`. Always use `dataUrl()`
  instead of reading `import.meta.env.BASE_URL` directly.
- `data/arabic.ts` — `normalizeArabic(str)` strips diacritics + unifies alef
  variants (ٱ↔ا↔أ↔إ↔آ). Must normalize before any Arabic text matching.
  For spelling-tolerant search use `searchKeyArabic` (also writes the dagger
  alif out, so `صلاة` matches `ٱلصَّلَوٰةَ`; ى→ي, ة→ه, hamza seats unified) and
  `findArabicMatch` to map a match back onto the Uthmani string for
  highlighting. The word cloud counts by that key and shows `displayArabic`
  forms; its stopwords must cover Uthmani spellings too (ذٰلك → `ذالك`).

**Data-shaping vs. presentation.** Pure transforms live in `src/data/`
(`selectors.ts` filter/aggregate, `stats.ts`, `enrich.ts`, `fawatih.ts`,
`arabic.ts`) and are unit-tested. Components in `src/components/charts/` are
presentational and receive a `ChartContext` (`components/charts/common.ts`:
`{ palette, primary, colorMode, dark, activeKeys?, onOpen?, onSelectSurah? }`).
`HorizontalBarChart<T>` is the shared bar-chart primitive (morphology charts use
it). To add a visualization: create a chart component, add an entry to
`VIZ_DEFS` in `views/vizDefs.ts` (group, icon, which controls it `uses` —
range/sort/color/layout; unused controls are hidden — and `autoHeight` for views
that lay themselves out and grow instead of filling the fixed chart box), then
add its case to `renderChart()` in `views/DashboardView.tsx`. Structural views go
in `views/StructureView.tsx`. `migrateViz` maps retired `qv.viz` values (the
old per-metric and per-language ids) to current ones; extend it when removing
an id.

**UI primitives** (`src/components/ui/index.tsx`):

- `Modal` — optional `width` (fraction of the overlay's content width, `null` =
  default) + `onWidthChange` add drag handles on both side edges (pointer
  capture, zoom-corrected, committed on release; double-click resets to `null`;
  ←/→ when a handle is focused). The reader persists it as `qv.reader.width`.
- `Modal` — supports `fullHeight` prop. When true, the panel fills its overlay
  (`h-full flex flex-col`), children should use `flex-1` for the scroll area.
  When false, the panel centers in a `max-h-full` box that scrolls. Never size
  with `vh`: the app root has CSS `zoom` (Interface scale), which multiplies
  `vh`. Elsewhere use `calc(N*var(--zvh))` (`--zvh` is set on the app root).
- `cx(...parts)` — className join helper. Import from `../ui`.
- `SegmentedControl`, `Toggle`, `Select`, `Badge`, `Card`, `SectionTitle`,
  `IconButton`, `Slider`, `Skeleton`, `ModalHeader`.

**Views.** `App.tsx` switches Dashboard / Browse / Structure / Compare. Browse
(`views/BrowseView.tsx`) shows surah, juz and manzil cards; juz/manzil stats come
from `divisionCards()` in `data/sections.ts`, and `components/cards/SurahCard`
is shared with the Opening-categories drill-down. State is mirrored
to the URL hash via `parseHash`/`serializeHash`. Clicking most chart elements
calls `onOpen`/`onSelectSurah`, opening `ReaderModal` (scopes: surah, manzil,
juz, hizb, rub', ruku', page). Theme (palette, dark mode, custom primary) is
global via `theme/ThemeContext.tsx`.

## Non-obvious data facts (read before touching the ETL or structural charts)

- **`ayahs.hizb_id` in the DB is the rub' (quarter-hizb) index 1–240, NOT the hizb.** It does **not** divide evenly into the 60 hizbs. `build_data.py` maps hizb (1–60) from the `hizbs` table's ayah-id ranges and keeps the raw value as `rub` (1–240). Do not reintroduce `hizb_id / 4`.
- **Word/letter counts do not exist in the DB** — they are computed in the ETL from the Uthmani text (`w` = whitespace-split tokens; `l` = Arabic letters after stripping diacritics). The method is documented in the script header. They are computed *after* the basmala strip below, so they intentionally differ from classical scholarly figures (~77,400 words / ~323,700 letters); switching to the Imlaei (`quran-simple`) script raises the letter count, not lowers it, so the gap is a counting-convention difference, not a text-variant one.
- **The basmala is baked into ayah 1 of every surah except At-Tawbah (9)** in the DB's Arabic. The ETL strips the leading basmala from ayah 1 for surahs 2–114 (not 1, which keeps it as verse 1, and not 9, which has none) *before* counting and storing `ar`, and flags `surahs[].hasBismillah` for the strip set so the app can render the basmala as a separate line above verse 1. Matching is done on the diacritic/tag-stripped prefix (`strip_leading_basmala`), so it also applies to the tajweed edition.
- **`wordbyword.json` and `morphology.json` come from two other `type='quran'` editions.** `wordbyword.json` is `quran-wordbyword` parsed into per-ayah `[arabic, gloss]` pairs (lazy-loaded by `data/useWordByWord.ts` for the Reader's "Word by word" toggle). `morphology.json` is a *global aggregate* of `quran-corpus-qd` (the Quranic Arabic Corpus): top roots (Buckwalter→Arabic via `bw_to_arabic`) + part-of-speech counts (lazy-loaded by `data/useMorphology.ts` for the Dashboard "Morphology" charts). **Gotcha: unlike `ayahs.text`, both of these editions already exclude the basmala from ayah 1** (e.g. 2:1 is just the initials), so the ETL does NOT strip them — do not re-add a basmala strip there or you'll delete real content.
- **`tajweed.json` is the pre-annotated `quran-tajweed` edition** (a `type='quran'` edition, outside `EXPORT_TYPES`), exported ayah-id-indexed with inline rule markup like `بِسْمِ [h:1[ٱ]للَّهِ`. It is lazy-loaded only when the Reader's tajweed toggle is on (`data/useTajweed.ts`); markup is parsed client-side in `data/tajweed.ts`. There is **no** tajweed algorithm — the colouring comes entirely from this edition.
- **Arabic text is Uthmani and contains alef-wasla (ٱ, U+0671).** Any prefix/text matching on Arabic (e.g. `fawatih.ts` opening classification) must normalize alef variants first, or it silently misclassifies.
- **`verses.json` uses short keys** (`s`, `a`, `w`, `l`, `ar`, …) to stay small; the `Verse` type in `types/quran.ts` is the source of truth for that shape.
- **Audio editions (`is_audio=1`) are excluded** by the ETL; the app is text-only (no recitation playback).

## URL hash / deep links

`#<view>[?<params>][/r/<scope>/<value>[/<anchor>]]` — parsed and written by
`lib/hash.ts` (`parseHash` clamps reader values: surah 999 → 114).

Examples: `#dashboard`, `#structure/r/surah/2`, `#dashboard/r/surah/2/262`,
`#dashboard?v=length&m=letterCount&s=revelation&r=juz:28-30&p=Medinan`

Dashboard params (`v` viz, `m` metric, `c` cloud language, `s` sort,
`r` range `surah:a-b`/`juz:a-b`, `p` ayah place) come from
`dashboardToParams`/`paramsToDashboard` in `views/vizDefs.ts`. The dashboard
writes them with `history.replaceState` (no history entry per click); on load,
`seedDashboardFromHash` copies them into storage before the persisted state
initialises, so a shared link wins over the remembered view.

The reader target is mirrored to the hash on open/navigate/close. Last-read
position persists to `localStorage["qv.lastRead"]` for the Resume button.

## Persisted preferences

`lib/usePersistentState(key, initial, sanitize?)` mirrors state to localStorage;
pass a `sanitize` (helpers in `persisted.*`) whenever a stored value can go stale.
Keys: `qv.structure.tab`, `qv.compare.surah` / `qv.compare.editions` /
`qv.compare.translit`, `qv.viz`, `qv.metric` (Surah length metric), `qv.cloudLang`, `qv.root`,
`qv.topic` (explorer selections), `qv.filter`, `qv.horizontal`, `qv.activeKeys`,
`qv.settings`, `qv.browse.*` (Browse kind, query, sort, type filter),
`qv.bookmarks` (owned by `App`; sanitized by `lib/bookmarks.ts`),
`qv.search.translation`,
`qv.lastRead`, `qv.colorMode` (owned by `App`, shared by dashboard, reader and
search), `qv.edition` (reader translation), and `qv.reader.*` (gear-menu toggles,
`tafsirEdition`, `glossLang`, `translationScale`, `infoLang`, `width`). Theme,
Arabic font and the Arabic text scale live in `quranviz.theme` (`ThemeContext`);
the reader's "Arabic size" slider writes that same `arabicScale`.
localStorage is per origin, so settings only carry over on the same host:port.

## UI language (English / Indonesian)

All UI text lives in `src/i18n/en.ts` (source of truth; `Messages = typeof en`)
and `src/i18n/id.ts` (typed `Messages`, so a missing key fails `tsc`). Components
call `useI18n()` (`i18n/I18nContext.tsx`) for `t` (strings; params are functions),
`n` (locale number format — use it instead of `toLocaleString()`), `place`,
`category` and `meaning` (surah meaning; Indonesian meanings are a static list in
`id.ts`). Data keys stay English (`"Meccan"`, fawatih categories, POS tags): translate at
display time, never in `selectors`/data. The choice persists as `qv.lang`
(default from `navigator.language`); outside the provider (tests) it is English.
Never hard-code UI text in components: add it to both dictionaries. Dataset
content (translations, topic names, root glosses, CSV headers) is not translated.

## Keyboard shortcuts and loading

App-level shortcuts live in `lib/shortcuts.ts` (`shortcutFor` is pure and
tested; `SHORTCUTS` feeds the `?` help sheet): Ctrl/Cmd+K or `/` search, `1`–`4`
views, `B` bookmarks, `?` help. They are ignored while typing or while a window
is open (except Ctrl/Cmd+K). The reader keeps its own ←/→.

`useLazyJson` returns `retry()`; show it on load errors (`LoadState` in
`DashboardView`). The dashboard's ayah filter (`filter.place`) is ayah-level via
`ayahPlace`; `sanitizeFilter` fills fields missing from older stored filters.
CSV export (`lib/export.ts` `downloadCsv`, UTF-8 with BOM) uses the
per-view rows from `csvRows()` in `DashboardView`.

## Component patterns

- **Modals with internal popovers** (ReaderModal): pass a wrapper `handleClose`
  to `<Modal>` that closes the popover on first Escape, then the modal on
  second. The settings popover also closes on outside click (mousedown listener
  on `document`, checking `settingsRef` + `gearRef` for containment).
- **Adding a new lazy data source**: create `useFoo(enabled)` wrapping
  `useLazyJson`. Wire it in `DashboardView` (for morph-level) or `ReaderModal`
  (for verse-level). Surfaced errors go inline in the UI.
- **Search**: use `normalizeArabic(query)` for diacritic-insensitive Arabic
  matching. The `GlobalSearchModal` uses character-walking to map normalized
  indices back to original text for highlighting.

## Tajweed regex — sync both copies

The tajweed markup tag regex lives in two places. If the `quran-tajweed` edition
changes format, update both:

- `scripts/build_data.py` → `TAJWEED_TAG` (ETL validate step)
- `src/data/tajweed.ts` → `TAG` (client-side `parseTajweed`)

Both carry a `# MIRRORS src/data/tajweed.ts:TAG` / `// MIRRORS scripts/build_data.py` comment.
