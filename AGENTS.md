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
U+06D6–U+06ED and be added there and to `ARABIC_FONTS`. `<meta theme-color>`
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

**Shell** (`components/shell/Navigation.tsx`). Wide layouts get `NavRail`
(brand + totals, primary Read button, search, the three views, then bookmarks,
shortcuts, settings); narrow ones get `TopBar` (search, bookmarks, settings) and
`BottomTabs` (Read + three views, ≥56px targets). While the reader is open, Read
is the current destination and the phone `TopBar` is replaced by the reader's
own head. Read opens the reader at
`qv.lastRead` or Al-Fatihah. Language and dark mode live only in Settings. Each
view's scroll position is recorded when the view changes (`changeView` in
`App.tsx`, not from scroll events) and restored on return. Android's back
gesture (`lib/androidBack.ts`, `@capacitor/app`) closes an open dialog with a
synthetic Escape (so popovers close first), else goes back in history, else
exits. Search: a Latin-script query always searches a translation, in the UI
language (`searchEditionFor` in `data/searchEdition.ts`: the reader's edition if
it matches, else `id.kemenag-qul` / `en.sahih`); the "also search translation"
toggle adds the translation to Arabic queries.

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

**Views.** `App.tsx` switches Dashboard / Peta (view id `browse`) / Structure.
Peta (`views/BrowseView.tsx`) is the Peta Mushaf (`components/peta/`) above an
index of surahs, juz and manzils as a dense sortable list (`SurahList`,
`DivisionList`; header clicks set the same `qv.browse.sort`) or cards
(`qv.browse.layout`); the timeline sort always uses cards; juz/manzil stats come
from `divisionCards()` in `data/sections.ts`, and `components/cards/SurahCard`
is shared with the Opening-categories drill-down. State is mirrored
to the URL hash via `parseHash`/`serializeHash`. Clicking most chart elements
calls `onOpen`/`onSelectSurah`, opening the reader (scopes: surah, manzil,
juz, hizb, rub', ruku', page). Theme (palette, dark mode, custom primary) is
global via `theme/ThemeContext.tsx`.

**Reader** (`components/reader/`). A page, not a modal: when the hash has a
reader target, `App` renders `ReaderView` in the content column and keeps the
current view mounted but `hidden` (its state survives; its window scroll is
saved on open and restored on close). Opening pushes a history entry, moving
inside the reader (`replaceState`) does not, and closing steps back when the
reader was opened in this session — so Android back leaves the reader in one
step. Parts: `ReaderToolbar` (back, title, search/about/context/bookmarks/
settings; scope select + prev/jump/next; layout switch), `VerseRow` (one ayah:
revelation-coloured reference that opens the context, play, bookmark, context,
and a "more" menu with copy text/link, quran.com, note), `MushafPage`
(the scope grouped by mushaf page, continuous text, juz/hizb head margin),
`VerseContextPanel` ("Konteks ayat": Tafsir · Kata per kata · Asbab · Ayat
mirip · Akar & topik; each tab lazy-loads its file; per-ayah reverse indexes in
`data/ayahContext.ts`), `Recitation` (`MiniPlayer` docked at the bottom,
`RecitationControls` in a sheet), `AyahText` (Arabic with red-ink ۞/۩ and the
U+06DD ayah-end medallion), `readerShared` (prefs hook, scope helpers). Layouts
(`qv.reader.mode`): ayah by ayah, mushaf pages, compare translations (the old
Compare view; editions in `qv.compare.editions`). The reader measures its own
width (`clientWidth`, so zoom-safe): below 560px the tools go icon-only, from
960px the context panel docks beside the text (`qv.reader.context`), otherwise
it opens in a `Sheet` (bottom on phones, right edge on wider layouts). Root and
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

## Recitation audio (local only)

`scripts/fetch_audio.py --reciter <id>` downloads per-ayah MP3s from
everyayah.com into `audio/<id>/SSSAAA.mp3` plus `index.json` (name, bitrate,
`origin`, `recorded`, file count, `complete`). Reciters: `shuraym` (Sa'ud
ash-Shuraym, 64 kbps, ~530 MB) and `yasser` (Yasser ad-Dosari, 128 kbps only).
It resumes, validates the MP3 header, rewrites the index every 250 files, and
`--check` reports what is missing. Neither source publishes a recording date
(the ID3 tags only name the publisher: HidayahOnline.org, QuranicAudio.com), so
`recorded` is null; the selector shows it only when set. To add a reciter, add
it to `RECITERS` in both the script and `data/recitation.ts`. `audio/` is
gitignored and is **never** copied into `dist/`: the `localAudio` plugin in
`vite.config.ts` serves it at `audio/` only from `npm run dev` and `npm run
preview` (with Range support). On Android or any static host the index fetch
fails, `useRecitation` reports `index: false`, and the reader shows no audio UI.

- `data/recitation.ts` is the pure loop logic (unit-tested): `advance(cursor,
  range, opts, needsBasmalah)` returns the next file or null. Ranges are global
  verse ids, so they can cross surahs. The range is read each time a file ends,
  so editing it while audio plays never restarts the current ayah; an ayah left
  outside the new range wraps to its start. `001001.mp3` doubles as the basmalah
  before ayah 1 of surahs with `hasBismillah` (once, not on ayah repeats).
- `data/useRecitation.ts` drives one `<audio>` element and warms the next file;
  `useReciters(RECITERS)` lists the reciters whose index loads. The choice
  persists as `qv.audio.reciter` (falls back to the first present one). Switching
  reciter restarts the current ayah in the new voice.
- `components/reader/Recitation.tsx`: `MiniPlayer` (prev/play/next, what is
  playing, options button) docked under the reader, and `RecitationControls`
  in the options sheet: reciter select (name · origin · bitrate), prev/play/next, From/To as surah + ayah dropdowns between −/+ steppers
  (picking a surah jumps to its first ayah for From, its last for To), "set to
  the playing ayah", reset, and
  repeat ayah / repeat range (0 = ∞) / gap / speed, persisted as
  `qv.audio.options`. Each verse row gets a "play from here" button; outside the
  range it sets the range to that ayah through the end of the scope. The range
  follows the scope until edited and resets on navigation unless a cursor exists.
- The in-app browser pane blocks `/@vite/client`, so the dev server renders
  blank there; check the player with `npm run build` + the `quran-viz-preview`
  launch config instead.

## URL hash / deep links

`#<view>[?<params>][/r/<scope>/<value>[/<anchor>]]` — parsed and written by
`lib/hash.ts` (`parseHash` clamps reader values: surah 999 → 114).

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
`qv.lastRead`, `qv.welcome` (first run done), `qv.audio.options` (recitation repeats/gap/speed), `qv.audio.reciter`, `qv.colorMode` (owned by `App`, shared by dashboard, reader and
search), `qv.edition` (reader translation), and `qv.reader.*` (gear-menu toggles,
`tafsirEdition`, `glossLang`, `translationScale`, `infoLang`, `audio`, `mode`,
`context`, `contextTab`). Theme,
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
tested; `SHORTCUTS` feeds the `?` help sheet): Ctrl/Cmd+K or `/` search, `1`–`3`
views (closing the reader), `B` bookmarks, `?` help. They are ignored while typing or while a window
is open (except Ctrl/Cmd+K). The reader keeps its own ←/→ (not while a sheet is open).

`useLazyJson` returns `retry()`; show it on load errors (`LoadState` in
`DashboardView`). The dashboard's ayah filter (`filter.place`) is ayah-level via
`ayahPlace`; `sanitizeFilter` fills fields missing from older stored filters.
CSV export (`lib/export.ts` `downloadCsv`, UTF-8 with BOM) uses the
per-view rows from `csvRows()` in `DashboardView`.

## Component patterns

- **Popovers and sheets**: the reader's popovers (`Popover` in
  `ReaderToolbar`) and row menus close on outside press and Escape; `Sheet`
  (`components/ui`) is the docked dialog (bottom or right) with its own Escape,
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
