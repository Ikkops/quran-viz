# AGENTS.md

Context for agents working in `quran-viz/`. See `../CLAUDE.md` for the full
workspace layout, ETL data gotchas (basmala strip, hizb vs rub`, word counts,
tajweed markup), and the `reference/`+`quran-database-main/` directories.

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

## Architecture (runtime only; ETL is in CLAUDE.md)

**Data layer** (`src/data/`):

- `useQuranData.ts` — fetches the 4 core JSON files on mount. Returns
  `{ surahs, verses, editions, meta }` or null while loading.
- `useTranslation(editionId)` — lazy-fetches a single translation edition.
  LRU-capped at 24 editions. Returns `{ data, loading, error }`.
- `useLazyJson<T>(key, enabled)` — generic singleton-cache hook. Backs
  `useTajweed`, `useWordByWord`, `useMorphology`, `useRoots`, `useSimilar`, `useThemes`, `useTopics`, `useAsbab`, `useSurahInfo`. Pass `useLazyJson("tajweed", showTajweed)`.
  Module-global cache + inflight-dedupe. Returns `{ data, loading, error }`.
  To add a new lazy-loaded data file, drop a thin wrapper around `useLazyJson`.
- `base.ts` — exports `BASE` and `dataUrl(path)`. Always use `dataUrl()` instead
  of reading `import.meta.env.BASE_URL` directly.
- `arabic.ts` — `normalizeArabic(str)` strips diacritics + unifies alef variants
  (ٱ↔ا↔أ↔إ↔آ). Must normalize before any Arabic text matching.

**Charts** (`src/components/charts/`):

- `common.ts` defines `ChartContext`: `{ palette, primary, colorMode, dark,
activeKeys?, onOpen?, onSelectSurah? }`. Every chart component receives one.
- `HorizontalBarChart<T>` is the shared bar-chart primitive (morphology charts
  use it).
- To add a visualization: create a chart component, then register it in
  `views/DashboardView.tsx` (`VIZ_OPTIONS` + `renderChart()` switch) or
  `views/StructureView.tsx` for structural ones.

**UI primitives** (`src/components/ui/index.tsx`):

- `Modal` — supports `fullHeight` prop. When true, the panel fills its overlay
  (`h-full flex flex-col`), children should use `flex-1` for the scroll area.
  When false, the panel centers in a `max-h-full` box that scrolls. Never size
  with `vh`: the app root has CSS `zoom` (Interface scale), which multiplies
  `vh`. Elsewhere use `calc(N*var(--zvh))` (`--zvh` is set on the app root).
- `cx(...parts)` — className join helper. Import from `../ui`.
- `SegmentedControl`, `Toggle`, `Select`, `Badge`, `Card`, `SectionTitle`,
  `IconButton`, `Slider`, `Skeleton`, `ModalHeader`.

**Views**: `App.tsx` switches Dashboard / Structure / Compare. State is mirrored
to the URL hash via `parseHash`/`serializeHash`.

## URL hash / deep links

`#<view>` or `#<view>/r/<scope>/<value>[/<anchor>]`

Examples: `#dashboard`, `#structure/r/surah/2`, `#dashboard/r/surah/2/255`

The reader target is mirrored to the hash on open/navigate/close. Last-read
position persists to `localStorage["qv.lastRead"]` for the Resume button.

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
