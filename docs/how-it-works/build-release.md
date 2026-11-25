# Build, test, release

## Commands

Run these from the project folder:

```bash
npm install
npm run dev              # the app at http://localhost:5173
npm test                 # vitest: logic, stores and components (jsdom)
npm run lint             # eslint
npm run format           # prettier
npm run build            # type check and production build into dist/
npm run build:android    # the same, without the three downloadable tafsirs
npm run build:data       # the Python ETL into public/data/
npm run docs:dev         # these docs, with live reload
npm run docs:build       # the docs as a static site
```

Python tests: `uv run --with pytest python -m pytest scripts/`.

## Checks before a pull request

All of these should pass: `npx vitest run`, the Python tests, `npx eslint .` (no errors), `npx prettier --check src`, `npx tsc -b`, `npm run build` and `npm run build:android`. Format before committing.

## The Android build

`.github/workflows/android.yml` builds the APK on GitHub, since the development machine has no Android SDK:

- **On a pull request:** it runs the tests and builds a signed APK, attached to the run so it can be tried before merging.
- **On a push to `main`:** it does the same and publishes a release `v1.0.<run number>` with the APK. Obtainium picks that up as an update.

A push builds `main` as it is when the run starts, not the commit that queued the run. When several pull requests merge in quick succession, GitHub can start their runs out of order, and the newest run cancels the others; building the tip makes sure the release carries all of them.

The release build sets `VITE_DATA_REF` to its own commit. The app then downloads tafsirs and word timings from exactly that commit's `public/data/`, so an installed app never meets a newer file format. The signing key lives outside the repository. `scripts/android-set-secrets.sh` copies it into the repository's Actions secrets once. Keep a backup of it: a lost key means uninstalling the app to update it.

Native Java code (fullscreen, the storage plugin) is compiled only by CI. Check the pull request's `apk` job after changing it.

## The docs

These pages are Markdown in `docs/`, built with VitePress. `.github/workflows/docs.yml` publishes them to GitHub Pages on every push to `main` that touches `docs/`. To refresh the screenshots after a UI change, start the dev server and run

```bash
uv run --with playwright python scripts/docs_screenshots.py http://localhost:5173
```

It drives the installed Chrome with example data, then the images are converted to WebP.
