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
uv run --with pytest python -m pytest scripts/test_build_data.py  # if system pytest is missing
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
- **Restart `npm run dev` after editing `tailwind.config.js`**: a long-running dev
  server on this mount kept serving the old Tailwind output (old slate ramp, no
  token classes like `text-ink`) while the JS updated, so token-coloured UI
  rendered in the browser's default text colour (white under an OS dark scheme).
- **Tailwind** has `future.hoverOnlyWhenSupported`: `hover:` applies only where a
  pointer can hover, so a tapped button on a phone no longer keeps its tint.
- **Tests** use jsdom + RTL (`vitest.config.ts`, `src/test/setup.ts`).
  `@tanstack/react-virtual` is mocked in tests (jsdom has 0-height container →
  0 virtual rows).
- **Android (Capacitor 8)**: build with `npm run build:android` (leaves the
  downloadable tafsirs out), then `npx cap sync android` copies `dist/` into
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
`topics.json` (the curated topic tree, see below), `wordbyword-id.json` (QUL Indonesian
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
`id.sabiq-qul`, cleaned of footnote residue in five verses). Three more
Indonesian tafsirs come from checked-in snapshots that
`scripts/fetch_tafsir_id.py` writes to `scripts/data/tafsir/<name>.json.gz`
(6,236 notes in mushaf order; re-fetch only to refresh, sequential and polite):
`id.jalalayn` (api.alquran.cloud, written as `translations/id.jalalayn.json`
but not listed in `editions.json`), and Kemenag's `id.kemenag-tahlili`
(equran.id) and `id.kemenag-wajiz` (the gadingnst/quran-api crawl, cleaned by
`clean_scraped`), both grouped by `collapse_runs` (Kemenag repeats one note
over a passage). `id.muntakhab` (Quraish Shihab) is an ordinary quran.db
edition that `TAFSIR_EDITIONS` also lists as an `ayah` tafsir. Every
`TAFSIR_EDITIONS` entry carries `published` (en/id line shown after `source`
under each note). The three snapshot editions carry `download: { bytes }`
(checked against the files by `editions.test.ts`): `npm run build:android`
(`vite build --mode android`, the `androidData` plugin in `vite.config.ts`,
run by CI) deletes them from `dist/data`, and the app downloads one on request
(`data/tafsirStore.ts`) from `raw.githubusercontent.com/Ikkops/quran-viz/main/
public/data/` into `<Data>/data/<same path>`, with `downloads.json` written
only when every file is in. The loaders (`useTranslation`, `useGroupedTafsir`)
resolve URLs through `dataFileUrl`, so the device copy is read instead; until
then the reader settings and the context sheet show `TafsirDownloadOffer`
(size, progress, cancel) and the tafsir select adds the size. So new files for
those editions reach the app only once merged to `main`. Surah names:
`nameEn` is qul.db `chapters.name_simple` (quran.com spelling, "Al-Fatihah");
`nameId` comes from the checked-in `scripts/data/surah_names_id.json` (114
unique names, equran.id spelling: Ghafir, Al-Mujadilah, Al-Insyirah; the ETL
fails otherwise). Reader extras come from `scripts/fetch_reader_data.py`
snapshots (`scripts/data/{footnotes,translit,mushaf,timings,words}/*.json.gz`,
re-fetch only to refresh; it prints progress) and are written by
`scripts/reader_data.py` (tests in `scripts/test_reader_data.py`):
`translations/id.transliteration.json` (equran.id `teksLatin`),
`footnotes/<edition>.json` (`{ayah id: [[offset, note]]}`: quran.com's
`<sup foot_note>` markers moved onto the app's own text of `FOOTNOTE_EDITIONS`
with difflib where the wording differs, never inside a word), `mushaf/<layout>.json`
(`madinah-1441`, `madinah-1405`, `indopak-15`, `indopak-16`: per page, lines
as `[ayah id, first word]`, `["s", surah]`, `["b"]`; empty lines before a
surah's first ayah, across a page break too, become its name and basmala;
`check_layout` fails the ETL on gaps) and `timings/<reciter>/<surah>.json`
(quran-align, CC BY 4.0, 12 reciters: per ayah flat `[wordFrom, wordTo,
startMs, endMs, …]`; the other bitrates of those everyayah sets are the same
recordings). Words are `split_words` / `splitWords` (pause marks join the
word before, ۞ the word after); quran.com and quran-align split بَعْدَمَا in
three ayahs into two words, which `qc_word_map` maps back. Word details:
`words/<surah>.json` (per ayah, per app word: `[translit, English, Indonesian,
tags, lemma, root]`; glosses and transliteration from quran.com's QDC word
data, whose split `qdc_targets` maps onto the app's words — mostly one to
one, بعدما split in some ayahs, إل ياسين joined in 37:130; `GLOSS_FIXES`
holds 2:181's Indonesian glosses, shifted at the source; tags are the
`quran-corpus-qd` POS and features, one entry per word), `lexicon.json`
(`roots` `[ar, bw, count]`, `lemmas` `[ar, root, count, en, id]`; a lemma is
QUL's vowelled one when its letters and short vowels match the corpus's
`LEM`, else the corpus's spelled out by `buckwalter`) and `lexicon-occ.json`
(per lemma, flat `[ayah id, word]`). Regenerate with
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

**Topic tree (Dashboard → Topic explorer).** QUL's 2,512 topics mix three
sources (a thematic tree, the Quranic Arabic Corpus ontology, a flat English
index whose sub-entries like "of Moses" hang off `parent_id`), so one concept
appears several times (Moses / Musa / Moosa, Prayer / Salat / Namaz).
`scripts/topics.py` folds them: `cluster_topics` merges headings with the same
ayah set or Arabic name (roots also on a plural-insensitive English name; other
nodes only with siblings), plus the hand-picked `merge` groups; `build_tree`
hangs every cluster on the 11 categories / 78 subcategories (audited against the verses on 2026-11-11) of the checked-in
`scripts/data/topic_taxonomy.json` (`t` places QUL ids under a category, in
order; an unplaced cluster follows its QUL parent; `flatten` dissolves grouping
nodes such as "Stories", or a cluster that duplicates its category, into the
node above, ayahs included; empty leftovers are pruned). Every emitted cluster
needs an Indonesian name in `scripts/data/topic_names_id.tsv` (`id<TAB>name
[<TAB>English override[<TAB>Arabic override]]`, any member id; QUL's English
labels are often wrong, e.g. "Troop" for المسحور, so name from the verses).
The taxonomy's `verses` block (`remove`/`add` per QUL id, `"s:a"` refs) fixes
QUL mis-tags such as off-by-one refs (34:2 for 34:12) or false word matches. The
`split` list carves verses out of a topic that mixes senses of one Arabic word
(Hikmah vs. the name al-Hakim, aymān = oaths vs. right hands): each entry moves
`verses` from `from` either `to` an existing QUL id or into a new topic with an
`id` of 9000+ (`en`, optional `ar` and `under`), which is then placed and named
like a QUL id. Splits run before the `verses` block. The ETL fails on an unplaced or
unnamed cluster, a double placement, or an empty category. `topics.json` is a
flat node list, parents first: `{k, en, id, p, ar?, desc?, v?}` (`k` is the
category key or `t<QUL id>`, `v` the node's own ayah ids); the client
(`data/topics.ts:buildTopicTree`) rolls descendants' ayahs up into `all`. To
move or rename a topic, edit those two files and rerun the ETL.

The ETL reads read-only from `../reference/quran-refs/qul.db` (the `chapters`, `meta_ruku`,
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
`{ palette, primary, colorMode, dark, activeKeys?, onOpen?, onSelectSurah?, onMark? }`).
Charts report a hit on a small mark (bar, point, box) with `hitMark(ctx, target)`:
the dashboard's `onMark` opens the reader on a mouse click but only pins a
readout on a tap (pointer type recorded on the chart box), and a second tap on
the same mark opens it; without `onMark` it falls back to `onOpen`. Lists of
ayahs (extremes, explorer verse lists) call `onOpen` directly.
`HorizontalBarChart<T>` is the shared bar-chart primitive (morphology charts use
it). To add a visualization: create a chart component, add an entry to
`VIZ_DEFS` in `views/vizDefs.ts` (group, icon, which controls it `uses` —
range/sort/color/layout; unused controls are hidden — and `autoHeight` for views
that lay themselves out and grow instead of filling the fixed chart box), then
add its case to `renderChart()` in `views/DashboardView.tsx`, its question to
`t.viz.questions`, and its answer: a pure fact function in `data/answers.ts`
(tested) worded by `t.answers.*` in the `answer` memo of `DashboardView`.
Structural views go
in `views/StructureView.tsx`. `migrateViz` maps retired `qv.viz` values (the
old per-metric and per-language ids) to current ones; extend it when removing
an id.

**UI primitives** (`src/components/ui/index.tsx`):

- `Modal` — optional `width` (fraction of the overlay's content width, `null` =
  default) + `onWidthChange` add drag handles just outside both side edges (in the overlay
  padding, so they never cover the card's scrollbar; the `role="dialog"` element
  is a wrapper and the visible card is its child) (pointer
  capture, zoom-corrected, committed on release; double-click resets to `null`;
  ←/→ when a handle is focused). The reader persists it as `qv.reader.width`.
- `Modal` — supports `fullHeight` prop. When true, the panel fills its overlay
  (`h-full flex flex-col`), children should use `flex-1` for the scroll area.
  When false, the panel centers in a `max-h-full` box that scrolls. Never size
  with `vh`: the app root has CSS `zoom` (Interface scale), which multiplies
  `vh`. Elsewhere use `calc(N*var(--zvh))` (`--zvh` is set on the app root).
- `cx(...parts)` — className join helper. Import from `../ui`.
- `SegmentedControl`, `Toggle` (`role="switch"` + `aria-checked`, 44px row),
  `Select`, `Badge`, `Card`, `SectionTitle` (an `h2`; the app title is the `h1`),
  `IconButton`, `Slider`, `Skeleton`, `ModalHeader` (its heading names the dialog
  through `aria-labelledby` unless the `Modal` has `ariaLabel`; its close button
  is labelled). Open `Modal`s form a stack: only the topmost handles Escape and
  the focus trap, so About opened over Welcome closes on its own. `SegmentedControl` never
  grows wider than its container; a long strip scrolls sideways on phones.
- `Select` (`ui/Select.tsx`) — the app's dropdown; there are no native
  `<select>`s (their Android/browser pickers did not fit the app). Props:
  `options: { value, label, group? }[]`, `onChange(value)`, `label` or
  `ariaLabel`, `size="sm"`, `searchable` (filter field; folds case, accents,
  apostrophes and hyphens). A `role="combobox"` button opens a `role="listbox"`
  popup portalled into `#app-root` (so zoom, theme and fonts apply) and
  positioned `fixed` in the root's zoomed px (rect ÷ zoom), flipping above
  when there is no room below. Focus stays on the trigger
  (`aria-activedescendant`), so opening it blurs nothing. Escape closes only the
  list (capture-phase listener), so the sheet or popover around it stays open;
  `useDismiss`, the reader's ←/→, app shortcuts and Android back all treat
  `[data-select-popup]` / a focused combobox accordingly.
- `Sheet` — `side` is `bottom`, `top` or `right`. Its effect depends on `open`
  only (`onClose` through a ref): callers pass inline `onClose`s, and re-running
  the effect on every parent render used to pull focus out of a focused input,
  so Android's keyboard closed the moment it opened (bookmark name field).

**Design system.** `PRODUCT.md` (who the app is for) and
`DESIGN.md` ("Mushaf sebagai instrumen": tokens, type, rules) are the design
authority. Every screen uses the token classes; there are no `slate-*`/`gray-*`
classes and none should be added. Colour tokens live in `src/theme/tokens.ts`
(source of truth, also for SVG/canvas/PNG where CSS variables can't reach) and
are mirrored as RGB-channel variables in `src/index.css` (`:root` and `.dark`);
`tokens.test.ts` fails if they drift. Tailwind exposes them as `paper`,
`surface`/`surface-sunken`, `line`, `ink`/`ink-muted`/`ink-subtle`, `makki`,
`madani`, `hijra`, `illumination`, `rubric` (opacity works: `bg-makki/10`) and
the fonts as `font-ui` / `font-reading`. Makki/Madani/Hijra colours mean place of
revelation only. Fonts are self-hosted through Fontsource in `src/fonts.ts`
(never Google Fonts: the APK must render offline); a new Qur'an font must cover
U+06D6–U+06ED and be added there and to `ARABIC_FONTS`. The default is KFGQPC
Uthmanic Script HAFS (`src/assets/fonts/UthmanicHafs1Ver18.ttf`, shipped
unmodified as its licence requires, `@font-face` in `index.css`); it draws
Arabic-Indic digits as the ayah medallion, so `AyahEnd` omits U+06DD for it. `<meta theme-color>`
follows the dark toggle (`ThemeContext`). The Interface scale (CSS `zoom`) is
capped by `effectiveUiScale` (`lib/uiScale.ts`) so the layout never drops below
`MIN_LAYOUT_PX` (380) on narrow screens; it measures `documentElement.clientWidth`,
not `innerWidth`, which a phone inflates when content overflows. The root,
top bar, rail and tab bar pad for `env(safe-area-inset-*)` (`viewport-fit=cover`).

**Touch sizes.** `touch:` is a Tailwind variant for `@media (pointer: coarse)`
(`tailwind.config.js`). Compact controls keep their pointer size and add
`touch:min-h-11` (and `touch:min-w-11` for icon buttons) so every target is 44px
on a phone, a tablet and in the Android app. New controls under 44px need it.

**CSS zoom vs media queries.** The Interface scale zooms the app root, but media
queries still read the unzoomed window (a 1440px window at 150% matches `xl:`
with only 960px of layout). So layout choices that matter use available width:
`grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]` grids, the Dashboard's
wrapping sidebar (`flex-[1_1_14rem]` / `flex-[999_1_24rem]`), and `isWideLayout`
(`lib/uiScale.ts`, layout ≥ `RAIL_MIN_LAYOUT_PX` 720) for the navigation. Avoid
new `sm:`/`md:`/`lg:` breakpoints for structure.

**Shell** (`components/shell/Navigation.tsx`). At every width: `TopBar`
(brand, the page's name, search) and `BottomTabs` with the five views (Home,
Dashboard, Structure, Activity, Settings; ≥56px targets). There is no side rail.
While the reader is open both are hidden: the reader draws its own head and
fills the screen. Each view's scroll position is recorded when the view changes
(`changeView` in `App.tsx`, not from scroll events) and restored on return.
Android's back gesture (`lib/androidBack.ts`, `@capacitor/app`) closes an open
dialog with a synthetic Escape (so popovers close first), else goes back in
history, else exits. Search: a Latin-script query always searches a
translation, in the UI language (`searchEditionFor` in `data/searchEdition.ts`:
the reader's edition if it matches, else `id.kemenag-qul` / `en.sahih`); the
"also search translation" toggle adds the translation to Arabic queries.

**Palettes** (`theme/palettes.ts`) are accent-only (lapis, plum, ink, each with a
night variant); `resolvePalette(key, dark)` fills the fixed revelation colours
(`pie`, `hijra`) from the tokens and `ThemeContext` writes the accent into
`--illumination`. Stored pre-redesign keys (emerald, blue…) fall back to lapis.
Tajweed colours (`RULE_COLORS` in `data/tajweed.ts`) have a day and a night
value each; read them through `tajweedColor(rule, dark)`. `tajweed.test.ts`
fails if one drops below 4.5:1 on paper, surface or surface-sunken; new values
also go in DESIGN.md's frontmatter and Tajweed table.

**Dashboard** (`views/DashboardView.tsx`, `components/dashboard/`). Each chart
is a question with a computed one-line answer. `QuestionList` (the charts as
questions, grouped) sits beside the chart when the dashboard is ≥ 900px wide
(measured with `useElementWidth`), else the question heading opens it in a
`Sheet`. `FilterBar` shows the filters a chart `uses` as chips with popovers
(range, which ayahs, sort, colour, bars); a non-default chip has its own clear
button, and Reset appears once anything differs. `MarkReadout` is the pinned
readout for a tapped mark or a histogram bucket (count plus the first ayahs).
"Show data" (`qv.dashboard.table`) swaps the chart for `DataTable`, built from
the same `csvRows()` as the CSV (first 500 rows; the first cell opens the surah
or ayah); its column names come from `t.table.cols`. Recharts charts set
`accessibilityLayer` (arrow keys move the tooltip); `index.css` hides the
browser's click-focus ring on `.recharts-surface`.

**Code splitting.** `App.tsx` lazy-loads the three views, `ReaderView`,
`SettingsModal` and `GlobalSearchModal` (`React.lazy` + `Suspense`; the two
dialogs mount on first opening and stay mounted). Recharts lands in a shared
chunk loaded with the dashboard or Structure; html2canvas stays a dynamic
import in `lib/export.ts`. Keep heavy imports out of `App.tsx` and the shell.

**Home** (`views/HomeView.tsx`, view id `home`, where the app opens). "Last
read" (below), a today/streak line that opens Activity, then the index
(`components/home/QuranIndex.tsx`, the old Map index): surahs, juz or manzils
(`qv.browse.kind`), a surah filter (`qv.browse.query`), and sort / Makki-Madani
/ list-or-cards behind one "Sort and filter" button (`qv.browse.sort|type|layout`).
Surah rows (`SurahRow.tsx`): number, name in the accent colour, meaning, a
place icon (`PlaceIcon`: Kaaba = Makki, dome = Madani), and the calligraphic
name drawn by the "Surah Names" ligature font from the three-digit number
(`font-surah`, `src/assets/fonts/sura_names.woff2`, from quran.com's frontend).

**Last read** (`lib/lastRead.ts`, pure, tested; `qv.lastRead.list`). One entry
per stretch of reading: the reader reports the ayah at the top of the screen
once it has stayed 3 s (or the ayah being recited) through `onRead`;
`recordRead` moves the newest entry while the ayah is in the same surah within
`STRETCH_REACH` (40) ayahs, else starts a new entry, and keeps one entry per
surah (max 10). Home shows the newest `qv.lastRead.count` (1/3/5/10, default 5,
set in Settings). The old `qv.lastRead` target seeds the list once.

**Activity** (`views/ActivityView.tsx`, view id `activity`, `qv.activity.tab`):
Statistics (`components/home/ActivityPanel.tsx`: today, current and longest
streak, total time, bars per week, month, year or all time
(`qv.activity.period`), daily goal `qv.reading.goal`; maths in
`data/readingLog.ts`, store in `lib/readingStore.ts`, `useReadingTimer(reading)`
in `App`) and Bookmarks (`components/marks/MarksPanel.tsx`).

**Pins and collections** (`lib/marks.ts`, pure, tested; `qv.marks`, owned by
`App`). A pin has a name, a colour and at most one ayah, and moves when set on
another ayah; a collection has a name, a colour and any number of ayahs with
notes. Colours come from `MARK_COLORS`. First run makes one pin and one
collection named in the UI language and takes over the old `qv.bookmarks`. In
the reader each ayah has a pin button and a bookmark button that open
`components/marks/MarkSheet.tsx`.

**Settings** (`views/SettingsView.tsx`, view id `settings`): language, theme,
interface scale, accent, Qur'an font and size, last-read count, audio storage
(Android app only, `components/settings/AudioStorageSettings.tsx`), chart
settings, theme sharing, keyboard shortcuts, About, Welcome.

**Themes** (`theme/tokens.ts` `THEMES`, `ThemeContext`). Six named themes on a
light or dark base: light, cream, sepia, dark, warm-dark, black, plus "system"
(light or dark by device). `index.css` has `:root`, `.dark` and one
`[data-theme="…"]` block per extra theme (`tokens.test.ts` checks all); the
`dark` class stays on dark-based themes so `dark:` utilities and night tajweed
colours apply. `tokens(dark)` returns the active theme's set (`setActiveTheme`)
for canvas and SVG code. `theme.dark` is the base; `theme.theme` the choice.
Tajweed colours must keep 4.5:1 on light/dark and 3:1 (large text) on the
others (`tajweed.test.ts`). The lapis accent is each theme's own
`illumination` token.

**Views.** `App.tsx` switches Home / Dashboard / Structure / Activity /
Settings. The dashboard (`views/DashboardPage.tsx`, `qv.dashboard.tab`) is
Charts (`DashboardView`) or Map (the Peta Mushaf, `components/peta/`); an old
`#browse` link opens the Map tab. State is mirrored to the URL hash via
`parseHash`/`serializeHash`. Clicking most chart elements calls
`onOpen`/`onSelectSurah`, opening the reader (scopes: surah, manzil, juz, hizb,
rub', ruku', page).

**Reader** (`components/reader/`). A page, not a modal: when the hash has a
reader target, `App` renders `ReaderView` in the content column and keeps the
current view mounted but `hidden` (its state survives; its window scroll is
saved on open and restored on close). Opening pushes a history entry, moving
inside the reader (`replaceState`) does not, and closing steps back when the
reader was opened in this session — so Android back leaves the reader in one
step. Parts: `ReaderToolbar` (one row: back, the title as a button that opens
`GoToSheet` from the top, search, About this surah (a bottom sheet for the
surah of the ayah at the top), one icon that flips ayahs / mushaf pages, the
player's show/hide, settings), `GoToSheet` (surah, ayah and page columns kept
in step, "read by" scope, Go), `VerseRow` (one ayah: its number alone
as the marker that opens the context, play, pin, bookmark, context, and a
"more" menu with copy text/link, quran.com), `MushafPage`
(the scope grouped by mushaf page, continuous text, juz/hizb head margin),
`VerseContextPanel` ("Konteks ayat": Tafsir · Kata per kata · Asbab · Ayat
mirip · Akar & topik; each tab lazy-loads its file; per-ayah reverse indexes in
`data/ayahContext.ts`), `Recitation` (`MiniPlayer` docked at the bottom,
`RecitationControls` in a sheet), `AyahText` (Arabic with red-ink ۞/۩ and the
U+06DD ayah-end medallion), `readerShared` (prefs hook, scope helpers). Layouts
(`qv.reader.mode`): ayah by ayah or mushaf pages (Compare was removed). Mushaf
pages follow `qv.reader.layout`: a printed layout (`MushafLinesPage`, data in
`data/mushafLayout.ts`: whole pages, ayahs outside the scope dimmed, each
line's words spread to the width, the font fitted to the widest line after
`document.fonts.ready`, short lines centred) or `flow` (the old `MushafPage`,
grouped by `verses.page`). Tapping a word (ayah rows through `AyahWords`,
printed mushaf pages) opens `WordPopover` (`WordDetail.tsx`, portalled into
`#app-root` beside the word: the word, transliteration, meaning in the UI
language, root, play, ayah context); its "Click for more" opens
`WordDetailPage` in a bottom sheet (meanings, grammar worded by
`describeTags` from `t.word`, lemma, root and the lemmas from it, every
occurrence of the lemma, linking to the ayah). Word data (`data/words.ts`,
`useSurahWords`) loads per surah only for word by word or once a word is
tapped. Word by word in ayah rows uses the same data (so the recited word
lights there too); on printed mushaf pages it puts each word's meaning under
it (a `w-0 min-w-full` gloss that never widens the word, so the line fitting
holds). The mushaf highlights the ayah whose context is open only while the
sheet is open, and tints the player's edited range faintly. Search is find-in-text (`data/textSearch.ts`): every
hit in the Arabic (`findAllArabic`, spelling-tolerant) and in each translation
shown (`findAllLatin`, case and accents folded), plus `2:255`/`255` as an ayah;
nothing is filtered out, the field shows `n/total` with ↑/↓ (Enter, Shift+Enter)
and the stepped-to hit is scrolled to (`[data-match-current]`). Several
translations (`qv.reader.extraEditions`) and tafsirs (`qv.reader.extraTafsirs`,
the main `tafsirEdition` is also the context panel's) show under each ayah,
up to `MAX_EXTRA` extra each, loaded by `useTranslations` /
`useGroupedTafsirs`. Translator footnotes (`data/footnotes.ts`) are numbered
markers in the text (`TranslationText`); a pressed one shows its note below.
Transliteration follows the UI language (`transliterationFor`). Reading by
juz, hizb, rukuʿ or page, the head's title is the surah at the top and the
division is the bold subtitle. A sideways swipe on the list (≥ 80 px, mostly
horizontal, under 0.7 s) goes to the next (left) or previous (right) window,
like ←/→. Every ayah has a play button whenever a reciter exists; with the
player hidden it opens it. While a reciter with word timings
(`data/wordTimings.ts`, `TIMED_RECITERS`) plays, `AyahWords` (ayah rows)
and `MushafLinesPage` light up the word being recited from `rec.clock`. Only an
ayah someone chose is highlighted (`highlightId`: a link's anchor or a tapped
ayah), never the first ayah on opening. Section themes load in the UI language
(`themes.json` / `themes-id.json`; Indonesian from the checked-in
`scripts/data/themes_id.json`, keyed `surah:from-to`, which the ETL requires
to cover every section). The reader measures its own
width (`clientWidth`, so zoom-safe): below 560px the tools go icon-only. The
context opens in a bottom `Sheet` at every width (the docked side panel and
its `qv.reader.context` toggle are gone). The head
(toolbar + `QuranStrip`) floats over the list (`absolute`, the virtualizer's
`paddingStart`/`scrollPaddingStart` reserve its measured height) and slides away
on a scroll down, back on a scroll up (`nextHeadHidden` in `lib/hideOnScroll.ts`);
the reader's own scrolls (anchor jumps, following the recitation) never hide it,
and it stays while search, settings or any sheet is open. Settings start with
"Read by" (surah, juz, hizb, rukuʿ, page; `qv.reader.scope`), which reopens the
current ayah in that division; Home's last-read links use it
(`preferredDivision`). Tajweed colours have no legend in settings: "Tajweed
rules" opens `TajweedRules` (each rule, a line on it, a real example word from
`TAJWEED_EXAMPLES`). Root and
topic links go to `#dashboard?v=root-explorer&root=<bw>` /
`?v=topic-explorer&topic=<key>`; `App` remounts the dashboard so it reads them.
Anchor jumps scroll instantly: during a smooth scroll the virtualizer skips
measuring rows far from the target and never returns to them (rows overlapped).
After `document.fonts.ready` the rendered rows are re-measured from the DOM
(`measure()` alone would drop them back to the estimate).

## Non-obvious data facts (read before touching the ETL or structural charts)

- **`ayahs.hizb_id` in the DB is the rub' (quarter-hizb) index 1–240, NOT the hizb.** It does **not** divide evenly into the 60 hizbs. `build_data.py` maps hizb (1–60) from the `hizbs` table's ayah-id ranges and keeps the raw value as `rub` (1–240). Do not reintroduce `hizb_id / 4`.
- **Word/letter counts do not exist in the DB** — they are computed in the ETL from the Uthmani text (`w` = whitespace-split tokens; `l` = Arabic letters after stripping diacritics). The method is documented in the script header. They are computed *after* the basmala strip below, so they intentionally differ from classical scholarly figures (~77,400 words / ~323,700 letters); switching to the Imlaei (`quran-simple`) script raises the letter count, not lowers it, so the gap is a counting-convention difference, not a text-variant one.
- **The basmala is baked into ayah 1 of every surah except At-Tawbah (9)** in the DB's Arabic. The ETL strips the leading basmala from ayah 1 for surahs 2–114 (not 1, which keeps it as verse 1, and not 9, which has none) *before* counting and storing `ar`, and flags `surahs[].hasBismillah` for the strip set so the app can render the basmala as a separate line above verse 1. Matching is done on the diacritic/tag-stripped prefix (`strip_leading_basmala`), so it also applies to the tajweed edition.
- **`wordbyword.json` and `morphology.json` come from two other `type='quran'` editions.** `wordbyword.json` is `quran-wordbyword` parsed into per-ayah `[arabic, gloss]` pairs (lazy-loaded by `data/useWordByWord.ts` for the Reader's "Word by word" toggle). `morphology.json` is a *global aggregate* of `quran-corpus-qd` (the Quranic Arabic Corpus): top roots (Buckwalter→Arabic via `bw_to_arabic`) + part-of-speech counts (lazy-loaded by `data/useMorphology.ts` for the Dashboard "Morphology" charts). **Gotcha: unlike `ayahs.text`, both of these editions already exclude the basmala from ayah 1** (e.g. 2:1 is just the initials), so the ETL does NOT strip them — do not re-add a basmala strip there or you'll delete real content.
- **`tajweed.json` is the pre-annotated `quran-tajweed` edition** (a `type='quran'` edition, outside `EXPORT_TYPES`), exported ayah-id-indexed with inline rule markup like `بِسْمِ [h:1[ٱ]للَّهِ`. It is lazy-loaded only when the Reader's tajweed toggle is on (`data/useTajweed.ts`); markup is parsed client-side in `data/tajweed.ts`. There is **no** tajweed algorithm — the colouring comes entirely from this edition.
- **`quran-tajweed` and `quran-wordbyword` write the dagger alif as U+0672** (ALEF WITH WAVY HAMZA ABOVE) in 1,561 places, e.g. ذَٲلِكَ for ذَٰلِكَ, which every font draws as an alif with a hamza. Each one aligns with a U+0670 in the plain Uthmani text, so `dagger_alif()` in the ETL maps them back for `tajweed.json` and `wordbyword.json`. It is a source encoding quirk, not a font issue.
- **The Uthmani text (`ar`, and QUL's copy behind `wordbyword-id.json`) gets two display fixes in `fix_uthmani_marks()`.** (1) It writes the staggered idgham/ikhfa tanwin as tanwin + small meem (ۢ U+06E2 / ۭ U+06ED), which only special fonts draw as staggered; every offered font draws a meem, which in the Madinah and Indonesian mushafs means iqlab. So the meem is kept only when the next letter (across pause marks, or into the next ayah of the surah) is ب: 7,252 → 500 (270 nun + 230 tanwin iqlab). (2) A mid-word small yeh ۦ (U+06E6, a spacing character) broke the joining in 38 words (إِبْرَٰهِۦمَ), so after a joining letter it becomes tatweel + small high yeh (ـۧ). Both are marks, so word/letter counts and search keys do not change.
- **`flatten_tajweed()` flattens 34 ayahs of nested or rule-less tajweed markup** (`[o[ُوٓ[s[اْ]‌ۚ]`, 32:3 `[ٮٰ]`) into plain `[r[…]` runs (innermost rule wins), since the client `TAG` regex stops at the first `]` and showed the brackets.
- **Known, left as is:** the tajweed / English word-by-word editions mark silent letters with a sukun (ْ) where the Uthmani text has the sifr (۟), in 3,950 places (أُوْلَـٰٓئِكَ vs أُو۟لَٰٓئِكَ).
- **Arabic text is Uthmani and contains alef-wasla (ٱ, U+0671).** Any prefix/text matching on Arabic (e.g. `fawatih.ts` opening classification) must normalize alef variants first, or it silently misclassifies.
- **`verses.json` uses short keys** (`s`, `a`, `w`, `l`, `ar`, …) to stay small; the `Verse` type in `types/quran.ts` is the source of truth for that shape.
- **Audio editions (`is_audio=1`) are excluded** by the ETL: they are only CDN URLs. Recitation comes from local files instead (see *Recitation audio*).

**Peta Mushaf** (`components/peta/`). `data/mushafMap.ts` lays every ayah out
in mushaf order, one row per juz, each ayah as wide as its letters (fractions
of the longest row; `ayahAt` bisects a position back to an ayah). `MushafMap`
draws it on a canvas (backing store = CSS px × devicePixelRatio × the app zoom,
read from `getBoundingClientRect().width / offsetWidth`; pointer positions are
divided by the same ratio) with colours from `theme/tokens.ts`; surah starts
are paper hairlines; sajdah (rubric dot above), bookmarks (illumination dot
below), last read (ink bar), hover and selection rings. A root's or topic's
ayahs are highlighted by dimming the rest. Mouse click opens the reader; a tap
or arrow key selects (readout + "Baca" button; a second tap opens); Enter
opens. Prefs: `qv.peta.sajda|last|marks|kind|root|topic`. **Opening reveal** (the
app's one orchestrated moment, DESIGN.md): the first time the map shows in a
session (`sessionStorage` `qv.peta.revealed`) ayahs fade in surah by surah in
revelation order (`revealStarts` / `revealAlpha` in `data/mushafMap.ts`, tested)
over 1.4 s, then the map stands in mushaf order with its marks. Skipped under
`prefers-reduced-motion`; any press or key ends it. "Play revelation order"
replays it over 6 s with a caption naming each surah as it appears (the live
readout is hidden meanwhile, so screen readers are not flooded). `MushafMap`
draws through one `paint(progress | null)`; marks and rings only when settled. `QuranStrip` is the
one-row version under the reader's head: scope at full strength and
underlined, the top visible ayah marked, click to jump. The old Structure →
Pages grid (`MushafPageMap`) is gone.

## Recitation audio (local files; downloaded per surah in the app)

`scripts/fetch_audio.py --reciter <id>` downloads per-ayah MP3s from
everyayah.com into `audio/<id>/SSSAAA.mp3` plus `index.json` (name, bitrate,
`origin`, `recorded`, file count, `complete`). Desktop reciters
(`LOCAL_RECITERS`): `shuraym` (Sa'ud ash-Shuraym, 64 kbps, ~530 MB) and
`yasser` (Yasser ad-Dosari, 128 kbps only).
It resumes, validates the MP3 header, rewrites the index every 250 files, and
`--check` reports what is missing. Neither source publishes a recording date
(the ID3 tags only name the publisher: HidayahOnline.org, QuranicAudio.com), so
`recorded` is null; the selector shows it only when set. To add a desktop
reciter, add it to `RECITERS` in the script and to `LOCAL_RECITERS` in
`data/reciters.ts`. That file is the Android app's catalogue (40 reciters
from everyayah.com's `recitations.js`: Hafs only, no translations, one bitrate
each, 64 kbps where published); `bytes` there is exact for the two desktop
sets and otherwise estimated from 40 sampled ayahs. `audio/` is
gitignored and is **never** copied into `dist/`: the `localAudio` plugin in
`vite.config.ts` serves it at `audio/` only from `npm run dev` and `npm run
preview` (with Range support). On a static host the index fetch fails,
`useReciters` returns no reciters, and the reader shows no audio UI.

**Android app** (`data/audioStore.ts`, `isNativeApp()`): the APK ships no audio.
`useReciters` lists every reciter in `RECITER_INFO` (`data/reciters.ts`:
name, source folder, bitrate, total bytes); picking one downloads nothing
until the learner asks, and the selector notes how many surahs of each are on
the device. The learner downloads a surah at a time from everyayah.com into
`<volume>/audio/<reciter>/SSSAAA.mp3` with `@capacitor/file-transfer`
(4 in parallel, each to `.part` then renamed; files under 2 KB count as
failed). `surahs.json` in each reciter folder maps surah → bytes and is
written only when the whole surah is in place. One app-wide queue
(`downloadSurahs`, `cancelDownloads`, `deleteReciterAudio`,
`useAudioDownloads`). `useRecitation` takes `base` (the device folder through
`Capacitor.convertFileSrc`) and `available(id)`; an ayah whose surah isn't
downloaded stops playback and sets `rec.missing`; once that surah is on the
device, playback carries on from that ayah by itself (stopping forgets it).
Meanwhile the `MiniPlayer` is the download offer (what, estimated size by word share, progress,
cancel); the options sheet shows what is on the device, "download all" and
"delete" (with a confirm). This, word timings and the downloadable tafsirs (see the ETL
section) are the app's only network use, and only on the learner's tap.

Settings → Audio storage chooses where audio lives: the two app-private
volumes below, or any folder (`chooseAudioFolder`: the system folder picker,
its tree URI turned into a path by the plugin; needs "All files access",
`MANAGE_EXTERNAL_STORAGE`, granted on a system screen via `requestFolderAccess`).
A chosen folder is a volume with `custom: true` whose reciter folders sit
directly inside it; its path persists in `qv.audio.location`. Moving never
deletes anything but the emptied reciter folders.

The volume is internal storage (`getFilesDir()`, the old `Directory.Data`) or
the app's folder on an SD card, listed by the in-app `AudioStorage` plugin
(`android/app/src/main/java/io/github/ikkops/quranviz/AudioStoragePlugin.java`,
registered in `MainActivity`). Both are app-private: no storage permission,
deleted on uninstall. The choice persists as `qv.audio.location`; all paths
are absolute `file://` URIs (Filesystem and FileTransfer take them without a
`directory`). Changing it moves the downloaded files (copy, then delete, file
by file; refused if the target lacks space). A chosen card that isn't
inserted falls back to internal storage with a note in the sheet.

**Fullscreen.** `MainActivity` hides the status bar, navigation bar and the
Galaxy taskbar (`WindowInsetsControllerCompat`, transient bars on swipe) on
resume and whenever the window regains focus. The Java there is only compiled
by CI (no Android SDK on the dev machine), so check the PR's `apk` job.

- `data/recitation.ts` is the pure loop logic (unit-tested): `advance(cursor,
  range, opts, needsBasmalah)` returns the next file or null. Ranges are global
  verse ids, so they can cross surahs. The range is read each time a file ends,
  so a range that still holds the playing ayah never restarts it. When the
  learner edits the range and leaves the playing ayah outside it, the reader's
  `editRange` calls `rec.moveTo(range.from)` at once (paused stays paused); a
  range changed by navigation instead lets the ayah finish and wraps. `001001.mp3` doubles as the basmalah
  before ayah 1 of surahs with `hasBismillah` (once, not on ayah repeats).
- `data/useRecitation.ts` drives one `<audio>` element and warms the next file;
  `useReciters(RECITERS)` lists the reciters whose index loads. The choice
  persists as `qv.audio.reciter` (falls back to the first present one). Switching
  reciter restarts the current ayah in the new voice.
- `components/reader/Recitation.tsx`: `MiniPlayer` docked under the reader.
  Row one is the seek bar (time into the range, estimated range length)
  between the range's two ends as `− ref +` steppers (start left, end right);
  row two is the transport with play centred: repeat, restart ayah, previous,
  play, next, options. Below `PLAYER_ROOMY_PX` (560) the steppers drop to a
  third row. The repeat button steps `ayahRepeat` through `REPEAT_CHOICES`
  (stored as plays: 1, 2, 3, 4, 6, 12, 0 = ∞; worded as repetitions: none, 1×,
  2×, 3×, 5×, 11×, ∞) and is tinted when on. The seek bar reads
  `rec.clock` with `useSyncExternalStore` (position changes several times a
  second and must not re-render the reader); ayah lengths are
  `estimateAyahSeconds` (set bytes ÷ bitrate, shared by letters) until the
  file has loaded, then the real duration; releasing the thumb calls
  `rec.seek(id, offset)` via `locateInRange`; while paused, seeking moves the
  position and stays paused.
  `RecitationControls`
  in the options sheet starts with Play (start the range now, close) and
  Cancel (put range, options and reciter back as they were when it opened;
  the sheet's own close keeps the changes), then: reciter select (name · origin · bitrate), From/To as surah + ayah dropdowns between −/+ steppers
  (picking a surah jumps to its first ayah for From, its last for To), "set to
  the playing ayah", reset, and
  repeat ayah / repeat range (0 = ∞) / gap / speed, persisted as
  `qv.audio.options`. The player closes itself (X, `qv.reader.audio` off) and its
options button is the sliders icon (reader settings keep the gear). In the
app the reciter list puts reciters with audio on the device first (check mark,
`Select` option `icon`), then a dividing line (`separator`), then the rest;
reciters with word timings carry a highlighter mark (`trailing`). In the app
the timings are `words-<surah>.json` in the reciter folder, downloaded after
the surah's audio or on first play (`deviceTimings`: read and written with
Filesystem, fetched from `REMOTE_DATA`, never through the WebView's file
server; a failed load is retried after 8 s as playback moves on, the `again`
argument of `useWordTimings`); `build:android` leaves
`data/timings` out. Each verse row gets a "play from here" button; outside the
  range it sets the range to that ayah through the end of the scope. The range
  follows the scope until edited and resets on navigation unless a cursor exists.
- `data/mediaControls.ts` wraps `@capgo/capacitor-media-session`: on Android
  its foreground service shows the media notification (previous, play/pause,
  next, position in the range) and keeps recitation playing in the background;
  in a browser it is the Media Session API. `useRecitation` announces each
  ayah (`describe(id)` → title/artist) and binds the buttons while the player
  is enabled. The manifest declares `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and `POST_NOTIFICATIONS`. Untested on a
  device from here.
- The in-app browser pane blocks `/@vite/client`, so the dev server renders
  blank there; check the player with `npm run build` + the `quran-viz-preview`
  launch config instead.

## URL hash / deep links

`#<view>[?<params>][/r/<scope>/<value>[/<anchor>]]` — parsed and written by
`lib/hash.ts` (`parseHash` clamps reader values: surah 999 → 114; an empty or
unknown view is `home`).

Examples: `#dashboard`, `#structure/r/surah/2`, `#dashboard/r/surah/2/262`,
`#dashboard?v=length&m=letterCount&s=revelation&r=juz:28-30&p=Medinan`

Dashboard params (`v` viz, `m` metric, `c` cloud language, `s` sort,
`r` range `surah:a-b`/`juz:a-b`, `p` ayah place, `root` / `topic` for the
explorers) come from
`dashboardToParams`/`paramsToDashboard` in `views/vizDefs.ts`. The dashboard
writes them with `history.replaceState` (no history entry per click); on load,
`seedDashboardFromHash` copies them into storage before the persisted state
initialises, so a shared link wins over the remembered view.

The reader target is mirrored to the hash on open/navigate/close (see
**Reader** above for the history rules). The anchor is a global ayah id
(`/r/surah/2/255` is 2:248). The old `#compare` view opens the dashboard. Last-read
position persists to `localStorage["qv.lastRead"]` for the Resume button.

## Persisted preferences

`lib/usePersistentState(key, initial, sanitize?)` mirrors state to localStorage;
pass a `sanitize` (helpers in `persisted.*`) whenever a stored value can go stale.
Keys: `qv.structure.tab`, `qv.browse.layout`, `qv.peta.*`, `qv.compare.editions` (reader compare layout), `qv.viz`, `qv.metric` (Surah length metric), `qv.cloudLang`, `qv.root`,
`qv.topicKey` (explorer selections; the topic is a node key), `qv.filter`, `qv.horizontal`, `qv.activeKeys`, `qv.dashboard.table`,
`qv.settings`, `qv.browse.*` (Browse kind, query, sort, type filter),
`qv.bookmarks` (owned by `App`; sanitized by `lib/bookmarks.ts`),
`qv.search.translation`,
`qv.lastRead`, `qv.welcome` (first run done), `qv.home.tab`, `qv.home.query`, `qv.activity.period`, `qv.reading.goal`, `qv.reading.log`, `qv.audio.options` (recitation repeats/gap/speed), `qv.audio.reciter`, `qv.colorMode` (owned by `App`, shared by dashboard, reader and
search), `qv.edition` (reader translation), and `qv.reader.*` (gear-menu toggles,
`tafsirEdition`, `glossLang`, `translationScale`, `infoLang`, `audio`, `mode`,
`context`, `contextTab`, `extraEditions`, `extraTafsirs`, `layout`). Theme,
Arabic font and the Arabic text scale live in `quranviz.theme` (`ThemeContext`);
the reader's "Arabic size" slider writes that same `arabicScale`.
localStorage is per origin, so settings only carry over on the same host:port.

## UI language (English / Indonesian)

All UI text lives in `src/i18n/en.ts` (source of truth; `Messages = typeof en`)
and `src/i18n/id.ts` (typed `Messages`, so a missing key fails `tsc`). Components
call `useI18n()` (`i18n/I18nContext.tsx`) for `t` (strings; params are functions),
`n` (locale number format — use it instead of `toLocaleString()`), `place`,
`category` and `meaning` (surah meaning; Indonesian meanings are a static list in
`id.ts`). Surah names: show `surah.name`, which `App` sets to `nameEn`
(quran.com spelling) or `nameId` (Kemenag) by UI language; filters match both.
Data keys stay English (`"Meccan"`, fawatih categories, POS tags): translate at
display time, never in `selectors`/data. The choice persists as `qv.lang`
(default from `navigator.language`); outside the provider (tests) it is English.
Never hard-code UI text in components: add it to both dictionaries. Dataset
content (translations, topic names, root glosses, CSV headers) is not translated.

## First run, About, app icon

- **Welcome** (`components/panels/Welcome.tsx`): shown once when the data has
  loaded, the URL has no deep link and the learner is new (`qv.welcome`; anyone
  with `qv.lastRead` or `qv.settings` counts as having used the app). It sets the
  interface language, the Qur'an font and the reader's translation (opening on the
  UI language's edition via `searchEditionFor`), then opens the reader
  ("Mulai membaca") or the map ("Jelajahi peta"). Settings → "Show the welcome
  screen" brings it back.
- **About** (`components/panels/AboutModal.tsx`): purpose, sources with licences,
  the Makki/Madani caveat and the counting note. Opened from Settings, Welcome and
  the info button beside the rail's totals. Its text lives in `t.about`; keep the
  sources list in step with the ETL.
- **Icon**: `scripts/build_icons.py` sets اِقْرَأْ in Amiri Bold (from
  `node_modules/@fontsource/amiri`, shaped with HarfBuzz) in lapis with the vowel
  marks in rubric on paper, and writes `public/favicon.svg`, `favicon-32.png`,
  `apple-touch-icon.png`, the Android adaptive icon (vector foreground +
  monochrome layer, `@color/ic_launcher_background` = paper), the legacy mipmap
  PNGs and every `splash.png`. Needs `pip install uharfbuzz fonttools brotli` and
  `rsvg-convert`. Never hand-edit the generated files; the rail's brand tile is
  `favicon.svg`.

## Keyboard shortcuts and loading

App-level shortcuts live in `lib/shortcuts.ts` (`shortcutFor` is pure and
tested; `SHORTCUTS` feeds the `?` help sheet): Ctrl/Cmd+K or `/` search, `H` home, `1`–`4`
dashboard, structure, activity, settings (closing the reader), `B` bookmarks
(Activity), `?` settings (where the list is shown). They are ignored while typing or while a window
is open (except Ctrl/Cmd+K). The reader keeps its own ←/→ (not while a sheet is open).

`useLazyJson` returns `retry()`; show it on load errors (`LoadState` in
`DashboardView`). The dashboard's ayah filter (`filter.place`) is ayah-level via
`ayahPlace`; `sanitizeFilter` fills fields missing from older stored filters.
CSV export (`lib/export.ts` `downloadCsv`, UTF-8 with BOM) uses the
per-view rows from `csvRows()` in `DashboardView`.

## Component patterns

- **Popovers and sheets**: the reader's popovers (`Popover` in
  `ReaderToolbar`) and row menus close on outside press and Escape; `Sheet`
  (`components/ui`) is the docked dialog (bottom, top or right) with its own Escape,
  focus handling and `role="dialog"`, so Android back closes it first.
- **Adding a new lazy data source**: create `useFoo(enabled)` wrapping
  `useLazyJson`. Wire it in `DashboardView` (for morph-level) or `ReaderView` /
  `VerseContextPanel` (for verse-level). Surfaced errors go inline in the UI.
- **Search**: use `normalizeArabic(query)` for diacritic-insensitive Arabic
  matching. The `GlobalSearchModal` uses character-walking to map normalized
  indices back to original text for highlighting.

## Tajweed regex — sync both copies

The tajweed markup tag regex lives in two places. If the `quran-tajweed` edition
changes format, update both:

- `scripts/build_data.py` → `TAJWEED_TAG` (ETL validate step)
- `src/data/tajweed.ts` → `TAG` (client-side `parseTajweed`)

Both carry a `# MIRRORS src/data/tajweed.ts:TAG` / `// MIRRORS scripts/build_data.py` comment.
