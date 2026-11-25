# Install and update

## On Android

Each push to the `main` branch builds a signed APK and publishes it as a GitHub release named `v1.0.<number>`, with the file `qurani-1.0.<number>.apk`.

The easiest way to stay up to date is [Obtainium](https://github.com/ImranR98/Obtainium):

1. Install Obtainium.
2. Add an app with the URL `https://github.com/Ikkops/quran-viz`.
3. Obtainium installs the latest release and offers each new one as an update.

You can also download the APK from the [releases page](https://github.com/Ikkops/quran-viz/releases) and open it on the device. Android asks once to allow installs from that app.

The APK carries all the text data, so reading, translations, the charts and memorisation work offline. Three things are downloaded only when you ask for them:

- **Recitation audio**, one surah at a time, when you press Play (see [Listening](/guide/listening)).
- **Word timings**, for reciters that light up each word as it is recited.
- **Three large Indonesian tafsirs**, each when you first choose it.

Sync between devices also goes online, but only if you set it up (see [Settings](/guide/settings#sync-between-devices)).

## On a computer

The desktop version runs in your browser from a local development server. You need [Node.js](https://nodejs.org/) 22 or newer and Git.

```bash
git clone https://github.com/Ikkops/quran-viz.git
cd quran-viz
npm install
npm run dev -- --open
```

The last command opens the app at `http://localhost:5173` (another port if that one is busy). Keep the terminal open while you use it. To update, run `git pull` and `npm install`, then start it again.

The text data in `public/data/` is part of the repository, so nothing else is needed to read. Rebuilding that data from its sources is a maintainer's task, described in [Data and sources](/how-it-works/data).

### Audio on the desktop

The desktop version plays recitation from files on your disk, in the `audio/` folder of the project, which is not in Git. Download a reciter once:

```bash
python3 scripts/fetch_audio.py --reciter shuraym
```

The script can be stopped and started again. It skips what it already has, and `--check` lists what is missing. The desktop reader offers the reciters whose files are present: Sa'ud ash-Shuraym, his older recording, Yasser ad-Dosari and Badr at-Turki.

## The first time

A short welcome lets you choose the translation shown under each ayah. You can see it again from Settings → Welcome.
