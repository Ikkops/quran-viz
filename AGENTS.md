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
DB is touched. Outputs: `surahs.json`, `verses.json` (also read by the
workspace's research scripts and cited in the juz notes: keep its shape),
`verses-cols.json` (the same verses by column, `verse_columns`, which the app
loads: half the parse time; `useQuranData.test.ts` checks the two decode
alike; `build:android` drops `verses.json` from the APK), `editions.json`,
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
(`data/tafsirStore.ts`) from `raw.githubusercontent.com/Ikkops/quran-viz/<ref>/
public/data/` (`REMOTE_DATA`: `<ref>` is `VITE_DATA_REF`, which the workflow
sets to the release's own commit on `main` so an app that hasn't updated never
meets a newer file format; `main` for a pull request's APK and local builds) into `<Data>/data/<same path>`, with `downloads.json` written
only when every file is in. The loaders (`useTranslation`, `useGroupedTafsir`)
resolve URLs through `dataFileUrl`, so the device copy is read instead; until
then the reader settings and the context sheet show `TafsirDownloadOffer`
(size, progress, cancel) and the tafsir select adds the size. So new files for
those editions reach the app with the release built from the commit that has
them. Surah names:
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
(quran-align, CC BY 4.0, 12 reciters, plus `yasser` from QUL's ayah-by-ayah
#103, which states no licence: per ayah flat `[wordFrom, wordTo, startMs,
endMs, …]`; the other bitrates of those everyayah sets are the same
recordings). QUL downloads need a login, so `fetch_reader_data.py qul --qul
<reciter>=<file.json>` imports a hand-downloaded file and first checks the last
word's end against `audio/<reciter>/` MP3s (Yasser: median 27 ms short of the
file's end). A QUL surah-by-surah file (its `segments.json`, ayah and word
times on the surah's clock) also writes `clips/<reciter>.json` (flat
`[fromMs, toMs]` per ayah id, cut mid-pause between ayahs, 300 ms before
ayah 1 and 1.5 s after the last; word times are then from the clip's start;
bounds come from the words since QUL's own slip, e.g. 36:3), which `clips/`
keeps in the APK; after the 6,236 ayah pairs come 114 basmalah pairs, the
basmalah's own words (`"s:0"`) when timed, else the file before ayah 1.
`shuraym-old` (QUL #402, the older Shuraym, which QUL
has no timings for) gets that file from `scripts/align_recitation.py`:
torchaudio MMS_FA forced alignment of the app's text (uroman; the opening
letters by name, alif lam mim) in ~2-minute blocks with a minute of
look-ahead (12 s let a repeated phrase pull 8:31 minutes late), run in its
own uv environment (see its docstring). Its files can open with an
announcement and the isti'adha, and 002.mp3 has al-Fatiha between the
basmalah and 2:1, so stars around the basmalah absorb them. Checked on QUL
#317 (the same recording as everyayah's Shuraym): ayah starts ~200 ms and
word starts ~100 ms off (median). Words are `split_words` / `splitWords` (pause marks join the
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
attributions that commentators dispute; the UI always shows `t.placeCaveat`
(`i18n/`). Use `ayahPlace(v, surahMap)` from
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

- `data/useQuranData.ts` — the 4 core JSON files, fetched once
  (`loadQuranData`, a shared promise; a failure clears it so a remount
  retries; verses from `verses-cols.json` via `versesFromColumns`). Returns
  `{ surahs, verses, editions, meta }` or null while loading.
- **Start-up path** (measured with a headless Chrome at 4× CPU slowdown; the
  main thread, not the network, is the limit): `index.html` preloads the 4
  core files (`<link rel="preload" as="fetch" crossorigin>`, matching
  `fetch()`'s mode, so each downloads once); `App.tsx` at module load starts
  `loadQuranData` and the first screen's lazy chunk (`viewChunk[view]`; a
  reader link also `readerChunk` and, in ayah view, its translation and
  footnotes; not tajweed, which may arrive after the text). After the first
  screen: `warmReader` at 1.5 s (reader code, translation, footnotes, tajweed
  when on), `warmViews` from 2.5 s (the other views' chunks, one per idle
  callback, so a tab such as the dashboard opens without loading Recharts).
  Home's surah rows and cards are `content-visibility: auto` with an
  intrinsic size: the 100-odd rows off screen skip style, layout and paint;
  the session's first Home draws 24 of them before the first paint and the
  rest in a transition (`useAllRows`; later visits draw all at once, so
  scroll restoring finds the full height); juz/manzil cards are computed only
  for the division shown. `HomeView` is imported eagerly (the app opens on
  it: no lazy suspend and skeleton commit first); the other views stay lazy.
  On a reader link the view under the reader is not drawn until the reader is
  up (`viewUnderReader`, then an idle transition; closing the reader draws it
  at once). Chart series have `isAnimationActive={false}`
  (DESIGN.md Motion; Recharts' 1.5 s entrance re-rendered the chart every
  frame). Benchmark these with a headless Chrome over CDP at 4× CPU, the
  original build beside the new one, runs alternating (single runs vary).
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
(`selectors.ts` filter/aggregate, `stats.ts`, `fawatih.ts`,
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
add its case to `renderChart(id, verses, rows, live)` in
`views/DashboardView.tsx` (use those arguments, not `viz`/`filteredVerses`,
and write no state when `live` is false: the swipe pager draws the neighbour
chart with it), its question to `t.viz.labels`, and its answer: a pure fact
function in `data/answers.ts` (tested) worded by `t.answers.*` in the `answer`
memo of `DashboardView`. `ChartContext.still` turns a chart's entrance
animation off (neighbour panes).
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
- `Button` — `variant` `primary` (lapis fill, one per view or sheet) |
  `secondary` (default: surface + hairline) | `quiet` (no fill, sunken tint on
  hover); `size` `md` (36px) | `sm` (32px), both `touch:min-h-11`; optional
  leading `icon`; native button props pass through (`type` defaults to
  `button`); full width via `className="w-full"`. Use it instead of hand-rolled
  `bg-illumination … text-white dark:text-paper` strings. `IconButton` is a
  secondary `Button` kept for its callers; icon-only quiet buttons are
  `QuietIconButton`.
- `Card` — surface, `rounded-xl`, hairline, `shadow-soft`; callers set the
  padding (`p-4`). No translucent `dark:bg-surface/60`, no `dark:shadow-none`.
- `SegmentedControl`, `Toggle` (`role="switch"` + `aria-checked`, 44px row),
  `Select`, `Badge`, `Card`, `SectionTitle` (an `h2`; the app title is the `h1`),
  `IconButton`, `Slider`, `Skeleton`, `ModalHeader` (its heading names the dialog
  through `aria-labelledby` unless the `Modal` has `ariaLabel`; its close button
  is labelled). Open `Modal`s form a stack: only the topmost handles Escape and
  the focus trap, so About opened over Welcome closes on its own. `SegmentedControl` never
  grows wider than its container; a long strip scrolls sideways on phones;
  `fullWidth` makes the strip fill its container with the options sharing the
  width (Activity's tabs).
- `Select` (`ui/Select.tsx`) — the app's dropdown; there are no native
  `<select>`s (their Android/browser pickers did not fit the app). Props:
  `options: { value, label, group?, keywords? }[]` (the filter matches label,
  group and `keywords`; group headings are semi-bold in the accent colour;
  `EditionSelect` passes each language's names via `langKeywords`, so "indo"
  lists every Indonesian translation), `onChange(value)`, `label` or
  `ariaLabel`, `size="sm"`, `searchable` (filter field; folds case, accents,
  apostrophes and hyphens; focused on open only with a fine pointer, so on
  touch screens the keyboard waits for a tap on it). A `role="combobox"` button opens a `role="listbox"`
  popup portalled into `#app-root` (so zoom, theme and fonts apply) and
  positioned `fixed` in the root's zoomed px (rect ÷ zoom), flipping above
  when there is no room below. Focus stays on the trigger
  (`aria-activedescendant`), so opening it blurs nothing. Escape closes only the
  list (capture-phase listener), so the sheet or popover around it stays open;
  `useDismiss`, the reader's ←/→, app shortcuts and Android back all treat
  `[data-select-popup]` / a focused combobox accordingly.
- `Sheet` — `side` is `bottom`, `top` or `right`; 16px radius on the free
  corners, a decorative grab handle on bottom sheets, the title in `text-title`
  over a hairline. The body has no padding: callers pad their content
  (`px-4`, usually `py-3`) to match the header. Its effect depends on `open`
  only (`onClose` through a ref): callers pass inline `onClose`s, and re-running
  the effect on every parent render used to pull focus out of a focused input,
  so Android's keyboard closed the moment it opened (bookmark name field).
  Closing is animated: the X, the backdrop and Escape (so Android back too) go
  through `requestClose`, which plays the exit with the Web Animations API
  (panel to its own edge, backdrop to 0, 180 ms) and then calls `onClose` in
  `flushSync`, so the panel is unmounted before the exit's `fill: forwards` is
  released (releasing it in a rAF first flashed the sheet back on a slow
  re-render); a close the caller makes itself (`open` set to false) unmounts
  at once. A
  bottom sheet can be dragged down, a top sheet (the reader's Go-to) up:
  native touch listeners on the panel (`touchmove` non-passive), starting from
  the handle or header, or from the content while every scroller between the
  touch and the panel is at its top (bottom sheet) or bottom (top sheet); it
  closes past 30% of its height or on a flick, else springs back. The drag
  maths is `lib/drag.ts` (pure, tested: `axisLock`, `velocity`, `commits`,
  `rubberBand`, `animateTo`), shared with the reader's swipe. Translations are
  divided by `rootZoom`. jsdom has no `Element.animate`, so `animateTo`
  resolves at once and `onClose` runs synchronously in tests. Reduced-motion
  rule (sheets, the reader swipe, `useSwipePager`): what the finger drives
  always follows it; only what plays by itself shortens. So under
  `prefers-reduced-motion` a drag still follows, its spring-back and exit run
  80 ms, and a close from the X, backdrop or Escape fades (120 ms).
- `useSwipePager` (`lib/useSwipePager.ts`) — the held-swipe pager for the
  reader windows, Dashboard charts, Structure and Activity tabs: mid-drag the
  current pane and its neighbour both show. Options `current` (changes when
  the pane does), `canGo(dir)` (wrap-around callers return true),
  `onCommit(dir)`, `enabled`, `onThreshold(past)` (the hook itself gives a
  haptic `tick()` from `lib/haptics.ts` there, as `Sheet` does at its 30%;
  Android app only); returns React touch
  `handlers` for a `touch-pan-y` container (it may reach past the pane; an
  inner element clips while `sides` is not empty), `sides` (the
  directions whose neighbour pane to mount) and `trackRef` (`relative`; a
  neighbour is `absolute inset-y-0 w-full`, `left-full` for +1 or `right-full`
  for -1, `aria-hidden inert`). A drag does no React work between touchstart
  and release (no `setState` in `onTouchMove`; `will-change: transform` on the
  track only from lock to settle; the zoom is read once at touchstart): with
  `ahead` the neighbours mount when idle (`requestIdleCallback`, in a
  transition), otherwise both sides mount once at the first lock and are
  dropped after a spring-back. Swipe left = +1. Commits past 30% of the
  width or on a flick, else springs back; rubber band where `canGo` is false.
  After a commit the track stays at ∓100% until `current` changes, then a
  layout effect clears it before paint. Never starts from inputs, sliders,
  `[data-no-swipe]`, `[data-select-popup]` or a sideways scroller. Pure
  helpers (`swipeDir`, `swipeOffset`, `pastThreshold`, `releaseCommits`) are
  tested; jsdom commits synchronously.

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
revelation only. **Design direction** (DESIGN.md): Notion's calm, content-first
base with Linear's precision for data, controls and dark themes. Use the type
steps `text-display` / `text-title` / `text-heading` / `text-eyebrow` (rem
`fontSize` entries carrying line height, tracking and weight; body stays
`text-base`/`text-sm`), `shadow-soft` for cards (a CSS variable: a faint
layered shadow on light themes, a top-edge highlight under `.dark`) and
`shadow-float` only for what floats, the radius roles (`rounded` 4 chips and
fields, `rounded-md` 6 rows and options, `rounded-lg` 8 buttons, `rounded-xl`
12 cards and popovers, `rounded-2xl` 16 sheets and dialogs), and `Button` /
`Card` / `SegmentedControl` rather than ad-hoc class strings. The focus ring
is global (`:focus-visible` in `index.css`, 2px lapis at 65%, offset 2px):
don't add per-component rings. Fonts are self-hosted through Fontsource in `src/fonts.ts`
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
(measured with `useElementWidth`). Narrower, a switcher row sits above the
question: an "All charts" button opens `QuestionList` in a `Sheet`, and a
`‹ n / total ›` stepper moves through `VIZ_DEFS` in order, wrapping, via
`pickViz`. The question heading itself is plain text. `FilterBar` shows the filters a chart `uses` as chips with popovers
(range, which ayahs, sort, colour, bars); a non-default chip has its own clear
button, and Reset appears once anything differs. `MarkReadout` is the pinned
readout for a tapped mark or a histogram bucket (count plus the first ayahs).
"Show data" (`qv.dashboard.table`) swaps the chart for `DataTable`, built from
the same `csvRows()` as the CSV (first 500 rows; the first cell opens the surah
or ayah); its column names come from `t.table.cols`. Recharts charts set
`accessibilityLayer` (arrow keys move the tooltip); `index.css` hides the
browser's click-focus ring on `.recharts-surface`.

**Code splitting.** (The recitation data modules and `readerShared` are in the
main chunk since `RecitationProvider` lives in `App`; no reader component is.)
`App.tsx` lazy-loads the three views, `ReaderView`,
`SettingsModal` and `GlobalSearchModal` (`React.lazy` + `Suspense`; the two
dialogs mount on first opening and stay mounted). Recharts lands in a shared
chunk loaded with the dashboard or Structure; html2canvas stays a dynamic
import in `lib/export.ts`. Keep heavy imports out of `App.tsx` and the shell.

**Home** (`views/HomeView.tsx`, view id `home`, where the app opens). "Last
read" (below), a today/streak line that opens Activity, then the index
(`components/home/QuranIndex.tsx`, the old Map index): surahs, juz or manzils
(`qv.browse.kind`), a surah filter (`qv.browse.query`), and sort / Makki-Madani
/ list-or-cards behind one "Sort and filter" button (`qv.browse.sort|type|layout`);
that options panel ends with a Reset (FilterBar's look, `t.controls.reset`),
shown while sort/place/layout differ from `mushaf`/`all`/`list`; it leaves the
search and the surah/juz/manzil choice alone.
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
set in Settings) as one sideways-scrolling row, newest first in the accent
style: `w-44 shrink-0 snap-start` cards in a `scrollbar-none` snap row that
bleeds past `main`'s `px-4` with `-mx-4 px-4`. The old `qv.lastRead` target seeds the list once.
A card adds one cut-off line for its surah's marks: up to two placed pins (pin
icon in the pin's colour + ayah number, then `+n`) and a bookmark icon with the
count of its ayahs saved in collections; an `sr-only` span words it
(`t.home.pinsAt`, `savedCount`).
A tapped surah row or card in the index shows `data-pressed` (accent tint, and
an accent border on cards; the same look as `active:`), cleared after 800 ms.
It is seen because `App.showReader` opens the reader in `startTransition`: the
view under it stays up until the reader is ready to paint.

**Khatam target** (`lib/khatam.ts`, pure, tested; `qv.khatam` =
`{ start, end, from }`). `khatamPlan(target, currentPage, today)` measures
progress by the mushaf page of the newest last read (not pages actually read):
pages left, average per day, `today` (pages still to read to stand on the
straight line from `from` to page 604 tonight; 0 once read), and a status
(done, on track, behind by n, overdue). `components/home/Khatam.tsx`:
`KhatamCard` in Activity → Statistics sets, changes (re-baselining from today)
or removes it with a native date field; `KhatamRow` on Home, under the
today/streak line, shows today's pages and the progress and opens the reader.

**Activity** (`views/ActivityView.tsx`, view id `activity`, `qv.activity.tab`;
second in the tab bar, after Home), tabs in this order: Memorisation (the
default, below), Statistics (`components/home/ActivityPanel.tsx`: today, current and longest
streak, total time, bars per week, month, year or all time
(`qv.activity.period`), daily goal `qv.reading.goal`; maths in
`data/readingLog.ts`, store in `lib/readingStore.ts`, `useReadingTimer(reading)`
in `App`) and Bookmarks (`components/marks/MarksPanel.tsx`). The tabs are one `TABS` array in
`ActivityView.tsx` (`id`, `label(t)`, `render(props)`); `ActivityTab` and the
stored-value check derive from it, so a new tab is one entry plus its label in
both i18n files.

**Pins and collections** (`lib/marks.ts`, pure, tested; `qv.marks`, owned by
`App`). A pin has a name, a colour and at most one ayah, and moves when set on
another ayah; a collection has a name, a colour and any number of ayahs with
notes. Colours come from `MARK_COLORS`. First run makes one pin and one
collection named in the UI language and takes over the old `qv.bookmarks`. In
the reader each ayah has a pin button and a bookmark button that open
`components/marks/MarkSheet.tsx`. Activity → Bookmarks ends with Backup: the
marks saved as a JSON file (`downloadText` in `lib/export.ts`) and read back
through `sanitizeMarks`, replacing the current ones after a confirm. Stored
state follows other tabs (`usePersistentState` and the reading log listen for
`storage` events), so two open tabs don't overwrite each other.

**Hifdh (memorisation)** (`lib/hifdh.ts`, pure, tested; `qv.hifdh`, owned by
`App`). `status` is a 6,236-character string, one digit per ayah in mushaf
order (0 not started, 1 memorising, 2 memorised, 3 memorised but weak), so it
holds whichever printed layout is chosen; `stumbles` maps `"<ayah id>:<word
index from 0>"` to a count and date. Marking: "Memorisation" in the ayah
popover and in a row's "more" menu opens `components/reader/HifdhSheet.tsx`
(apply to this ayah, its page, surah or juz; choosing a status saves and
closes). Hafalan mode (`qv.reader.hifdh` on/off, `qv.reader.hifdhLevel`:
`first-word` | `first-letter` | `hidden`) is switched on in the reader's
settings; while on, a bar under the toolbar holds the level, "cover again" and
"leave". `data/hifdh.ts` (`maskWord`, `maskedParts`, the `WordMask` the reader
builds) decides what each word shows; `Masked.tsx` draws the hidden part
transparent over a slot, `aria-hidden`, so words keep their width and printed
pages their shape. It reaches all three text renderers: `MushafLinesPage`,
`AyahWords` (ayah rows) and `AyahText` (flow pages). A tap on a covered ayah
uncovers it (in rows, a tap on any of its words); a tap on an uncovered ayah
opens the usual popup. In the printed layout a press-and-hold on a hidden word
is a peek: only that word shows and `addStumble` records it; a word with
stumbles gets a dotted rubric underline while visible in Hafalan mode.
Uncovered ayahs and peeks reset on navigation, a level change and leaving the
mode. Peta Mushaf: the highlight kind "Memorisation" (`qv.peta.kind` =
`hifdh`) keeps status 2 and 3 at full strength, dims the rest, dots status 3
in rubric (`MapMarks.weak`), and shows the share memorised overall and for the
juz under the pointer.

Review (`lib/hifdh.ts`): the unit is the Madinah mushaf page (`verses.page`),
scheduled by FSRS-6, the scheduler Anki uses (`nextMemory`, ported from
fsrs-rs 6.6.2 `model.rs` with its 21 default parameters; `hifdh.test.ts`
replays fsrs-rs's own memory-state test). A page is one card: `reviews` holds
`{ due, last, s, d }` (stability in days, difficulty 1–10); forgot / hard /
smooth are Again / Hard / Good. `rateReview(h, pages, rating, today)` moves
each page's memory, then schedules it where `retrievability` falls to the
desired retention (`h.retention`, `RETENTION_CHOICES` 85–97%, default 90%,
the panel's "Recall target"), at most `MAX_INTERVAL` (180) days; pages rated
together are spread over Anki's fuzz range (`fuzzRange`, from `fuzz.rs`),
each on the day with the fewest reviews already due (Anki's load balancer,
made deterministic), so a juz rated at once does not fall due in one day.
Smooth turns status 3 back to 2, forgot turns 2 into 3. Stored ladder reviews
(`{ due, step }`, the old 1-3-7-14-30-90 days) are read by `sanitizeHifdh` as
stability = that interval, difficulty 5. In the reader the Hafalan bar's
clipboard button rates the memorised pages of the current window
(`pagesWith(hifdh, scopeVerses, [2, 3])`). `todaysPlan(h, verses, today,
quota)` gives `learning` (pages with status 1), `recent` (due, last two
reviews ≤ 7 days apart) and `old` (the other due pages and the never
reviewed, the lowest chance of recall first, as Anki orders FSRS reviews,
cut to `quota`, `qv.hifdh.quota`). Every rating is also logged as
`[page, grade, at]` in `qv.hifdh.log` (`lib/reviewLog.ts`, apart from
`qv.hifdh` so that stays small); the progress card shows the last 30 days'
recall from it. Not taken from Anki (yet): optimising the parameters from that
log (it needs months of reviews), leech tagging, easy days.
Activity → Memorisation (`components/hifdh/HifdhPanel.tsx`, a `TABS` entry)
shows that plan (a page opens in the reader with Hafalan mode switched on,
`openForReview`), the progress card (`HifdhProgress.tsx`, Surah | Juz: the
share of the Qur'an memorised with one bar and counts; a map of one cell per
surah or juz, filled from the bottom; rows for the started ones with the
surah's name and calligraphic name, or the juz's ayah range, and "Show all".
Bars and cells use one encoding: memorised lapis, needs review rubric,
memorising lapis at 30%. `progressBy` gives `done`, `weak`, `learning` and
each group's first and last ayah id. The map is `aria-hidden` with
`tabIndex={-1}` cells: the rows are the keyboard and screen-reader path; a tap
on either opens the reader), "Continue
the ayah" (`sambungStarts`: a memorised ayah whose next ayah in the surah is
memorised too; a miss marks the next ayah status 3, a hit clears it) and the
stumbled words (`listStumbles`, `removeStumble`). Home shows a "Memorisation
today" line once anything is marked. The context sheet's "Similar ayahs" tab
compares each look-alike with the open ayah word by word
(`data/similarDiff.ts` `diffWords`, an LCS over the words with pause marks
ignored and vowel marks kept): differing words are tinted, or left as empty
slots with "Hide the words that differ". Settings → Backup
(`lib/backup.ts`, tested) saves every `qv.*` key and `quranviz.theme` except
`qv.audio.location` to one JSON file; restoring replaces those keys after a
confirm and reloads the page, so each value passes through its sanitizer.

**Settings** (`views/SettingsView.tsx`, view id `settings`): language, theme,
interface scale, accent, Qur'an font and size, last-read count, audio storage
(Android app only, `components/settings/AudioStorageSettings.tsx`; its "Saved
audio" button opens `SavedAudio.tsx` in a `Sheet`: every reciter with audio on
the device, its surah count and size, a delete for the whole reciter and, once
the row is opened, one per surah; this is the only place audio is deleted),
reminders (Android app only, below), chart settings, theme sharing, keyboard shortcuts, About, Welcome.

**Reminders** (Android app only; `qv.reminders`, `components/settings/
ReminderSettings.tsx`). Two daily local notifications, each a switch and a
time: the reading goal (skipped on a day whose goal is met) and hifdh review
(only on days with pages due, with the count). `lib/reminders.ts`
(`nextReminders`, pure, tested) lists the next 7 days; `lib/remindersNative.ts`
(`syncReminders`, `useReminders` called once in `App`) cancels the reserved
ids (7100–7106 reading, 7110–7116 hifdh) and schedules them through
`@capacitor/local-notifications`, imported dynamically. There is no
background code: it resyncs on app start, resume, and when the settings, the
reading log or the hifdh state change the list. Alarms are inexact
(`isExactNotification: false`, `allowWhileIdle`); the manifest removes the
plugin's `SCHEDULE_EXACT_ALARM`. The small icon is `ic_launcher_monochrome`.
Permission is asked only when a reminder is switched on, never at start.

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
Settings. The dashboard is `DashboardView` alone: the Peta Mushaf
(`components/peta/`) is its twelfth view (`map`, last in `VIZ_DEFS`), drawn
inside the dashboard card without a title of its own; "Show data" and CSV are
hidden for it. The old Charts | Map tabs and `qv.dashboard.tab` are gone:
`migrateStoredViz` folds a stored `map` tab into `qv.viz`, and `#browse` /
`tab=map` links open `v=map`. Dashboard, Structure (7 tabs) and Activity
(3 tabs) page sideways with `useSwipePager`; the dashboard wraps like its
stepper, the tabs do not. The swipe handlers sit on the view's outer wrapper
(`*-swipe` test ids), which runs to the tab bar: `App` makes the content
column and `<main>` flex columns that fill the screen for these three views
only (`SWIPE_VIEWS`; a centred grid such as Settings' would size to its
content as a flex item), the
wrapper is `flex-1` plus `SWIPE_TO_TAB_BAR` (it reaches through `<main>`'s
bottom padding, `TAB_BAR_ROOM`, both in `components/shell/Navigation.tsx`), so
the empty space under a short pane pages too. Inside, the pager (`*-pager`)
takes `overflow-hidden` only while `sides` is not empty (popovers and shadows
are clipped otherwise); the dashboard's side menu is `data-no-swipe` and its
"All charts" sheet sits outside the wrapper. All are
`touch-pan-y touch-pinch-zoom`. On the dashboard the whole chart box is
`data-no-swipe` (views change from the title, answer, filters or the stepper),
and a fixed-height chart that does not scroll itself is also `touch-pinch-zoom`
(`data-touch-lock`, `chartLocksPan`): a finger in it moves the tooltip, not the
page. `autoHeight` views and the ones with their own scrolling (extremes,
cloud, boxplots; add a new one to that list) keep vertical panning. A
neighbour chart whose data is not in memory (and always the word cloud and the
map) is a `Skeleton`. State is mirrored to the URL hash via
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
line's words spread to the width, the font fitted to the widest line,
short lines centred) or `flow` (the old `MushafPage`,
grouped by `verses.page`). Both mushaf layouts open a surah with `SurahBanner`
(the printed banner in tokens only, sized in em, `role="img"`, shapes
`aria-hidden`). Printed bands: every word except a line's last grows into the
space after it (`grow`, same layout as `justify-between`; `pe-[0.25em]` on
centred lines), so an ayah's highlight (selected or popover open, recited,
edited range) is one band over the outer spans, rounded at the run's ends;
the run's last word draws it on its own text. With word meanings shown the
band is inline colours, a gradient sized to the Arabic line (`ARABIC_LINE`),
so it never covers the meanings. Each page (both mushaf layouts) has
`PageSpine`, a thin line on the fold's side of an open mushaf: the right
edge of odd pages, the left of even ones. The recited word and the picked
word sit on the inner `data-ayah` span. The fit needs no layout:
`lineWidths` (`data/mushafLayout.ts`, tested) sums each line's drawn text
(tajweed text when coloured, plus the medallion) from canvas `measureText`
at 40 px, so a page mounts at its fitted size in one pass (measuring the
drawn spans made each new page lay out, re-render and lay out again, the
scroll's worst frames). The width comes from a `ResizeObserver` callback
(layout already done) and new pages start at the last page's (`lastWidth`);
only a session's first page reads `clientWidth` at once. A face nothing has
drawn yet is loaded with `document.fonts.load` and the page measured again.
Mushaf rows use `overscan` 2 (ayah rows 4). A page mounted off screen
(`deferred`: outside `rowVirtualizer.range`) draws its lines `LINE_STEP` (5)
at a time, each step a transition, with placeholders of the lines' heights
below (the page's height never changes), so a page mount is a few short
commits instead of one long scroll frame; on screen it draws at once.
`deferred` counts at mount only: the page's memo ignores later changes
(re-checking a drawn page as it came on screen cost a long frame). The
words' pointer, click, context-menu and key handlers sit once on the page's
lines box and find the word by `data-word="id:w"`, and tajweed segments are
drawn inline with one `useTheme` per page (not a component per word). Popovers: in both mushaf layouts a tap opens `AyahPopover`
(reference, the main edition's translation, play, context, and in the printed
layout a "press and hold" hint); a 450 ms hold within 10 px on a printed word
opens `WordPopover` (scroll/swipe cancels, the click after it is swallowed,
words are `select-none` with the touch callout and `contextmenu` suppressed);
Enter/Space = ayah, Shift+Enter = word. Both share `PopoverCard` (portal,
zoom-corrected placement, `useDismiss`). The ayah-by-ayah layout still opens a
word on tap (`AyahWords`). The main translation loads in mushaf mode only while
an ayah popover is open. `WordPopover` (`WordDetail.tsx`: the word,
transliteration, meaning, root, play, ayah context): its bold meaning follows
the word-by-word language (`glossLang`, which defaults to the UI language
until chosen), not the UI language; its "Click for more" opens
`WordDetailPage` in a bottom sheet (padded `px-4` like other sheet bodies,
centred at `max-w-2xl`, shared heading / definition-list / 44px row styles;
meanings, grammar worded by
`describeTags` from `t.word`, lemma, root and the lemmas from it, every
occurrence of the lemma, linking to the ayah). Word data (`data/words.ts`,
`useSurahWords`) loads per surah only for word by word or once a word is
tapped. Word by word in ayah rows uses the same data (so the recited word
lights there too); on printed mushaf pages it puts each word's meaning under
it (a `w-0 min-w-full` gloss that never widens the word, so the line fitting
holds). The mushaf highlights the ayah whose context is open only while the
sheet is open, and tints the player's edited range faintly. In ayah-by-ayah
view a crossed division boundary is a rounded `bg-illumination/10` strip with
centred `text-illumination` labels. Following the recitation goes by the
ayah's own boxes (`[data-ayah]` on the row, the flow-mushaf span, or each
printed word's inner span): `ayahInView` / `shouldFollow` in
`lib/ayahInView.ts` (pure, tested) count a row by its top or by covering the
band, a word/line by its middle, inside the scroller below the head. On a new
ayah the list does not move while that ayah is in view; it scrolls only if the
previous ayah was in view (or nothing was playing), so a learner who scrolled
away is left there. In the mushaf, `scrollToAyah` gets the page with
`scrollToIndex`, then sets `scrollTop` so the ayah's first line sits 15% down
the band, correcting for `rootZoom`. Search is find-in-text (`data/textSearch.ts`): every
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
division is the bold subtitle. A sideways swipe on the list goes to the next
(swipe right) or previous (swipe left) window, as pages turn in an Arabic
mushaf, through `useSwipePager` (`ahead`; the reader maps the pager's +1,
the pane on the right, to a step back): the
`overflow-clip` div around the scroller carries the handlers, the track wraps
the scroller, and a `ReaderPeek` on each side shows the start of that
neighbour window (static, `inert`, a full-height pane with the list's padding
and stable scrollbar gutter: at most 8 ayah rows, 2 flow pages or 1 printed
page, drawn by the same `renderRow` over `windowRows` from `readerShared.ts`
as the list, without highlights). The neighbours' per-surah data (grouped
tafsir, word meanings when shown) is prefetched as the panes mount, so the
peek and the arrival draw the final rows at once; the panes are memoised and
skip redraws while the list scrolls (`frozen`). A swiped-to window opens at its top with no arrival animation
(`swipedTo`); `go` from ←/→ and the end-of-list buttons records the direction
in `arriveFrom` and the new window slides in from 48 px on that side (240 ms).
Other jumps (Go to, the strip) do not animate.
Rows are memoised (`VerseRow` compares `ctx` field by field;
`MushafLinesPage`, `MushafPage` by props): the virtualizer re-renders the
reader at every row boundary and scroll start/end, so every `RowContext`
field and page prop must keep its identity while unchanged (`useMemo`,
`useCallback`, handlers through `lib/useStableFn`; `useSurahWords` and
`useFootnotes` return the same value until data arrives). A new inline
closure there makes every row redraw on scroll again. The swipe is off during search
and while any sheet, popover or row menu is open. The scroller is
`touch-pan-y overflow-x-hidden`.
Every ayah has a play button whenever a reciter exists; with the
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
(`preferredDivision`). Tajweed colours have no legend in settings
(`TAJWEED_LEGEND` is gone): "Tajweed rules" opens `TajweedRules`, which starts
with the stop signs (`data/waqf.ts` `WAQF_SIGNS`: the mark, a rubric or
illumination disc, its count in `verses.json`; `waqf.test.ts` recounts:
muʿānaqah counts pairs, U+06DC counts as saktah only when it stands alone
after a space, not over ص inside a word), then the rules in `TAJWEED_GROUPS`
order (nun sukun/tanwin, mim sukun, ghunnah, qalqalah, alif lam and letters
not read, mad, idgham of two letters), each with trigger letters in the rule's
colour, `t.tajweedTrigger` / `t.tajweedHelp` wording and its
`TAJWEED_EXAMPLES` word; `tajweed.test.ts` checks all 17 codes appear exactly
once. Colours follow the common Indonesian chart (ghunnah brown-orange, ikhfa
red, idgham-with-ghunnah purple, idgham-without grey, iqlab blue, qalqalah
green), madd in teal/cyan and rose/magenta, silent letters warm greys; `c`
shares `f`'s colour and `w` shares `a`'s on purpose (`SHARED_COLORS`). Root and
topic links go to `#dashboard?v=root-explorer&root=<bw>` /
`?v=topic-explorer&topic=<key>`; `App` remounts the dashboard so it reads them.
Anchor jumps scroll instantly: during a smooth scroll the virtualizer skips
measuring rows far from the target and never returns to them (rows overlapped).
After `document.fonts.ready` the rendered rows are re-measured from the DOM
with `resizeItem` (`measure()` clears the size cache and drops unchanged rows
back to the estimate). So that a window is drawn once and does not change:
KFGQPC is `font-display: block`, the chosen Arabic font and Literata (normal
and italic) are preloaded at start, `App` warms the reader's translation
and footnotes (see Start-up path), the translation counts as loading until
its footnotes are in, and `useGroupedTafsirs` returns cached surahs in the
same render.

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
(`LOCAL_RECITERS`): `shuraym` (Sa'ud ash-Shuraym, 64 kbps, ~530 MB),
`shuraym-old` (his older recording, QuranicAudio.com, 32 kbps, ~260 MB, one
`SSS.mp3` per surah: `surahFiles` in `RECITERS`/`RECITER_INFO`), `yasser`
(Yasser ad-Dosari, 128 kbps only) and `badr-turki` (Badr at-Turki,
mp3quran.net, 192 kbps, 2.2 GB, one file per surah). A whole-surah reciter plays each ayah as
a `Clip` of the surah's file (`clipOf` in `data/recitation.ts`, from
`clips/<id>.json`): `useRecitation` seeks to its start, ends it when
`timeupdate` passes its end (up to ~250 ms late, inside the pause), and does
not seek when the next clip starts where the audio is, so a surah plays
through without breaks; the basmalah is its own clip, none when under 1 s. In the app such a reciter downloads one
file per surah.
It resumes, validates the MP3 header, rewrites the index every 250 files, and
`--check` reports what is missing. Neither source publishes a recording date
(the ID3 tags only name the publisher: HidayahOnline.org, QuranicAudio.com), so
`recorded` is null; the selector shows it only when set. To add a desktop
reciter, add it to `RECITERS` in the script and to `LOCAL_RECITERS` in
`data/reciters.ts`. That file is the Android app's catalogue (40 reciters
from everyayah.com's `recitations.js`: Hafs only, no translations, one bitrate
each, 64 kbps where published; plus whole-surah sets from mp3quran.net, see
below); `bytes` there is exact for the three desktop sets and the mp3quran
ones, otherwise estimated from 40 sampled ayahs. mp3quran.net publishes ayah
timings for 115 of its recordings (`/api/v3/ayat_timing/reads`);
`fetch_reader_data.py mp3quran --mp3quran <id>=<read>` fetches one's 114
surahs (`mp3quran_rows` checks every ayah is there, in order), turns them into
`clips/<id>.json` with `surah_clips` (its ayah bounds are starts, so a clip
ends where the next ayah begins; no word timings) and prints the
`RECITER_INFO` entry (`surahFiles`, `origin: "mp3quran.net"`). Checked on
Bandar Balilah's 114: the marks sit within ~0.3 s of the quietest point
between ayahs. Badr at-Turki's recording there has no timings, in QUL or
elsewhere, so `align_recitation.py` timed it (ayahs and words) as it did the
older Shuraym, on an RTX 3060 (CUDA torch wheels, about half an hour for
25 hours of audio), imported with `fetch_reader_data.py qul --qul
badr-turki=<out.json>`; in `TIMED_RECITERS`. `audio/` is
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
failed; `fetchFile` and `runPool` in `data/download.ts`, shared with
`tafsirStore`: a download ends only when every transfer in flight has, so a
retry never meets one still writing; tests in `audioStore.test.ts` run the
store against fake plugins). `surahs.json` in each reciter folder maps surah → bytes and is
written only when the whole surah is in place. One app-wide queue
(`downloadSurahs`, `cancelDownloads`, `deleteReciterAudio`,
`useAudioDownloads`). `useRecitation` takes `base` (the device folder through
`Capacitor.convertFileSrc`) and `available(id)`; an ayah whose surah isn't
downloaded stops playback and sets `rec.missing`; once that surah is on the
device, playback carries on from that ayah by itself (stopping forgets it).
By default Play needs no confirmation: `start()` calls `useRecitation`'s
`onMissing(id)` for an ayah not on the device (never for a paused move), and
`RecitationProvider` queues that surah first, then the other missing surahs of
the playing range (`downloadSurahs`); `available(id)` stays false for an ayah
inside the range until every surah of the range is on the device, so Play
starts only once all are in and never stops halfway for a download (the
confirm-mode offer lists the same surahs); `toggle` with no cursor plays from
`rec.missing`. The `MiniPlayer` then shows progress and cancel only while Play
waits for the played surah, and Play retries after a failure
(`AudioDownloadPrompt.auto`). With `qv.audio.confirmDownload` on (Settings →
Audio storage → "Ask before downloading audio", default off) the `MiniPlayer`
is the download offer as before (what, estimated size by word share, progress,
cancel); the options sheet shows what is on the device and "download all".
Deleting lives in Settings → Audio storage → Saved audio: `deleteReciterAudio`
for a whole reciter, `deleteSurahAudio(reciter, job)` for one surah (manifest
saved first, then the surah's files and `words-<surah>.json`; the shared
basmalah `001001.mp3` stays until the reciter's last surah goes). This, word timings and the downloadable tafsirs (see the ETL
section) are the app's only network use, and only on the learner's tap.

Settings → Audio storage chooses where audio lives: the two app-private
volumes below, or any folder (`chooseAudioFolder`: the system folder picker,
its tree URI turned into a path by the plugin; needs "All files access",
`MANAGE_EXTERNAL_STORAGE`, granted on a system screen via `requestFolderAccess`).
A chosen folder is a volume with `custom: true` whose reciter folders sit
directly inside it; its path persists in `qv.audio.location`. Moving
(`moveAudioTo`) copies every file first and deletes the originals only once the
app reads from the new place, so a move that fails halfway leaves the audio
whole where it was; trying again skips the ayah files already copied. It never
deletes anything else that sits beside the audio.

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
- `data/RecitationContext.tsx`: `RecitationProvider` in `App` owns the
  recitation (`useRecitation`, `useReciters`, the reciter fallback, the edited
  loop range, and the prefs `qv.reader.audio`, `qv.audio.options`,
  `qv.audio.reciter`, which left `useReaderPrefs`), so it outlives the reader:
  closing the reader no longer stops playback. `ReaderView` reads it through
  `useRecitationContext()` and pushes its scope's range (`setScopeRange`); the
  last one stays in use after it closes. With the reader closed, listening
  still counts as reading time and the recited ayah updates last read.
  `components/shell/NowPlayingBar.tsx` sits above `BottomTabs` on every view
  while a cursor exists and the reader is closed: the label ("Now playing ·
reciter", from the context's `reciterName`) opens the reader
  at the playing ayah (in `preferredDivision`), play/pause, and a stop that
  leaves `qv.reader.audio` alone. Reader tests render through
  `withRecitation` (`src/test/recitation.tsx`).
- `data/useRecitation.ts` drives one `<audio>` element and warms the next file;
  `useReciters(RECITERS)` lists the reciters whose index loads. The choice
  persists as `qv.audio.reciter` (falls back to the first present one). Switching
  reciter restarts the current ayah in the new voice.
- `components/reader/Recitation.tsx`: `MiniPlayer` docked under the reader.
  Row one is the seek bar (time into the range, estimated range length)
  between the range's two ends as `− ref +` steppers (start left, end right);
  row two is the transport with play centred: repeat, restart, previous, play,
  next, go to the playing ayah (`LocateFixed`, disabled with no cursor; scrolls
  to it, or `onNavigate`s when it is outside the scope), options. On phones the
  side columns are `minmax(min-content,1fr)`. Below `PLAYER_ROOMY_PX` (560) the steppers drop to a
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
  the sheet's own close keeps the changes), then: reciter select (name · bitrate; `origin` stays in the data only), From/To as surah + ayah dropdowns between −/+ steppers
  (picking a surah jumps to its first ayah for From, its last for To), "set to
  the playing ayah", reset, and
  repeat ayah / repeat range (0 = ∞) / gap / speed and the "Build up" switch,
  persisted as `qv.audio.options`. After them, "Sleep timer" (`rec.sleep`,
  `rec.setSleep`; `SLEEP_CHOICES` off / 15 / 30 / 60 minutes / end of surah;
  session state inside `useRecitation`, not persisted, untouched by Cancel):
  `sleepDue` is checked at each ayah boundary (`onEnded`), so the ayah in
  progress finishes and the shared `pause()` runs; "end of surah" stops after
  the last ayah of that surah the range plays, and a loop or repeat does not
  defeat it. The bar shows the time left on a moon badge. A negative gap is a multiple of the ayah's
  own length (`GAP_CHOICES` −1 and −1.5, `gapSeconds(gap, duration, rate)`),
  the pause for reciting the ayah back. "Build up" (`chain`) makes `advance`
  go through `advanceChain`: each new ayah with its repeats, then the range
  from its start up to that ayah once (`Cursor.joinTo`), so ayahs 1–3 with two
  plays each run 1 1 2 2 1 2 3 3 1 2 3; range repeats then replay the whole
  range, and a cursor without `joinTo` (a fresh start, a seek) is on a new
  ayah. Its options (shown under the switch, modelled on another app's
  "Intellij mode"): `setRepeat` (plays of the set, `Cursor.setPass`),
  `window` (a set grown past it starts over from its last `window` ayahs,
  built up again: 1–6, then 2, 3, 2–3 … 2–6; `Cursor.base`) and `setPause`
  (after a set's last play, silence of that many times the set's length,
  `setFinished` + `lengthOf`, on top of the gap). `chainPreview` draws what
  ayahs 1–n would play in the sheet; the tests replay that app's demo. The
  seek bar's length estimate ignores the extra passes. The player closes itself (X, `qv.reader.audio` off) and its
options button is the sliders icon (reader settings keep the gear). In the
app the reciter list puts reciters with audio on the device first (check mark,
`Select` option `icon`), then a dividing line (`separator`), then the rest;
reciters with word timings carry a highlighter mark (`trailing`). In the app
the timings are `words-<surah>.json` in the reciter folder, downloaded after
the surah's audio or on first play (`deviceTimings`: read and written with
Filesystem, fetched from `REMOTE_DATA`, never through the WebView's file
server; a failed load is retried after 8 s as playback moves on, the `again`
argument of `useWordTimings`); `build:android` leaves
`data/timings` out. Each verse row gets a "play this ayah" button (so do the
  mushaf's ayah and word popovers): it sets the range to that ayah alone, so
  it plays with its repeats and stops. The range follows the view until edited: the "read by"
  scope in ayah view, the page across the middle of the list in the mushaf
  (`viewIndex`, `pageRangeAt` → `pageAyahs`, clipped to the scope). The
  reader pushes it as the context's `viewRange`; while the playing ayah is
  inside the pushed page it stays (scrolling on does not move the recitation),
  a new window or stopping hands it back to the view. An edited range resets
  on a new window or page unless a cursor exists.
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
`qv.topicKey` (explorer selections; the topic is a node key), `qv.filter`, `qv.horizontal`, `qv.activeKeys`, `qv.dashboard.table`, `qv.khatam`, `qv.reminders`,
`qv.settings`, `qv.browse.*` (Browse kind, query, sort, type filter),
`qv.bookmarks` (owned by `App`; sanitized by `lib/bookmarks.ts`),
`qv.search.translation`,
`qv.lastRead`, `qv.welcome` (first run done), `qv.home.tab`, `qv.home.query`, `qv.activity.period`, `qv.reading.goal`, `qv.reading.log`, `qv.audio.options` (recitation repeats/gap/speed), `qv.audio.confirmDownload`, `qv.audio.reciter`, `qv.colorMode` (owned by `App`, shared by dashboard, reader and
search), `qv.edition` (reader translation), and `qv.reader.*` (gear-menu toggles,
`tafsirEdition`, `glossLang`, `translationScale`, `infoLang`, `audio`, `mode`,
`context`, `contextTab`, `extraEditions`, `extraTafsirs`, `layout`). Theme,
Arabic font and the Arabic text scale live in `quranviz.theme` (`ThemeContext`);
the reader's "Arabic size" slider writes that same `arabicScale`.
localStorage is per origin, so settings only carry over on the same host:port.

## Sync between devices

Settings → Sync (`components/settings/SyncSettings.tsx`) keeps one encrypted
copy in a secret gist in the learner's GitHub account (description "quran-viz
sync", file `quran-viz-sync.json`); a fine-grained token with Gists read and
write, and a passphrase, are stored in `qv.sync.config` on each device. Code in
`lib/sync/`:
- `changes.ts`, the only part the app imports at start-up: `SYNCED_PREFS`
  (language, edition, reading goal, khatam, hifdh quota, last-read count,
  tajweed and the reader's info and gloss languages; display settings,
  `qv.settings` with its interface scale, the reciter and reminders stay per
  device), their change times in `qv.sync.stamps`, `noteLocalChange(key)` and
  `onSyncApplied`. `usePersistentState` stamps a key only when the learner
  changes it (not the first default, not a value sync stored) and re-reads a
  key sync wrote; `readingStore` and `reviewLog` listen too.
- `merge.ts`, pure: a `SyncDoc` holds marks, hifdh, the review log, reading
  time per device id, last-read places and the synced settings. Pins,
  collections and collection ayahs merge as records by newest `t` (or `at`),
  with deletion markers in `marks.gone` (kept 180 days); each ayah's status by
  `hifdh.statusAt` (unstamped: the further status wins), each page's review by
  `Review.at`, stumbles by `at` (a removal is `n: 0`), `retention` by
  `retentionAt`; logs as unions; reading time per device and day by max. Order
  of merging never changes the result, and merging twice changes nothing
  (`merge.test.ts`).
- `crypto.ts`: PBKDF2-SHA256 (600,000 rounds) into AES-GCM-256 via WebCrypto;
  the derived key is cached, and a rewrite keeps the copy's salt.
- `gist.ts`: `fetch` against api.github.com; `SyncError.problem` is `token`,
  `offline`, `github`, `passphrase` or `format` for the card's message.
- `engine.ts`: `collectLocal`, `applyLocal` (writes only changed keys, then
  `announceSyncApplied`), `syncOnce(transport, passphrase, device)`,
  `syncNow`, `startSyncTriggers` (launch, back to the front, 20 s after a
  change in marks, hifdh, the review log or a synced setting, at once when the
  app goes to the background with a change waiting, coming online). `App`
  imports it lazily (its own ~10 kB chunk). Device id: `qv.device`. Backups
  leave out `qv.sync.*` and `qv.device`.

Mark ids are made unique across devices (`p` or `c`, base-36 time, four random
characters); the starting pin `p1` and collection `c1` are the same on every
device on purpose. Reading time: `qv.reading.log` is this device's own,
`qv.reading.others` holds the other devices' logs from sync, and
`useReadingLog`/`readingLog()` give the sum.

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
- **Icon**: `scripts/build_icons.py` draws the rub el hizb star (۞: two squares
  turned against each other, an open centre, filled even-odd) in lapis with a
  rubric dot on paper, as path data on a 100-unit square (`MAIN`, `ACCENT`; no
  font, drawn on a Claude Design canvas beside three other marks), and writes
  `public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, the Android
  adaptive icon (vector foreground + monochrome layer,
  `@color/ic_launcher_background` = paper), the legacy mipmap PNGs and every
  `splash.png`. Needs `rsvg-convert` and ImageMagick (`identify`). Never
  hand-edit the generated files; the rail's brand tile is `favicon.svg`.

## Keyboard shortcuts and loading

App-level shortcuts live in `lib/shortcuts.ts` (`shortcutFor` is pure and
tested; `SHORTCUTS` feeds the `?` help sheet): Ctrl/Cmd+K or `/` search, `H` home, `1`–`4`
activity, dashboard, structure, settings (closing the reader), `B` bookmarks
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
