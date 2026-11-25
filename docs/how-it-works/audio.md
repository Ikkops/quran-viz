# Audio and word timings

## Two kinds of recording

- **One file per ayah** (everyayah.com): `SSSAAA.mp3`, for example `002255.mp3`. `001001.mp3` also serves as the basmala before ayah 1.
- **One file per surah** (mp3quran.net, QuranicAudio.com): each ayah plays as a clip of the surah's file. `clips/<reciter>.json` holds a `[from, to]` pair in milliseconds for each of the 6,236 ayahs, then one for each surah's basmala. The player seeks to a clip's start and ends it when playback passes its end. When the next clip starts where the audio already is, it doesn't seek, so a surah plays through without gaps.

The reciter catalogue is `src/data/reciters.ts`. The desktop reciters are in `LOCAL_RECITERS`, and their files sit in `audio/<reciter>/`, which is never copied into a build. The development server serves it.

## The play loop

`data/recitation.ts` is the pure loop, with tests. `advance(cursor, range, options)` returns the next file. Ranges are global ayah ids, so they can cross surahs. The range is read again each time a file ends, which is why you can change it while it plays without restarting. Build up goes through `advanceChain`: each new ayah with its repeats, then the passage up to it. Its set repeats, pauses and moving window are covered by tests that replay a reference demo.

`data/RecitationContext.tsx` owns the recitation in `App`, so it outlives the reader. `data/useRecitation.ts` drives one `<audio>` element and loads the next file ahead. On Android, `data/mediaControls.ts` keeps playing in the background with a media notification.

## On Android

The APK has no audio. `data/audioStore.ts` downloads a surah at a time into app storage: four files in parallel, each to a `.part` file that is renamed when complete. A surah's manifest is written only once all its files are in. Play waits until every surah of the range is on the device. Word timings for that surah (`words-<surah>.json`) come down with it.

## Where word timings come from

| Reciters | Timings |
|---|---|
| 12 everyayah sets | quran-align (CC BY 4.0), per word |
| Yasser ad-Dosari | QUL's ayah-by-ayah timings |
| Older Shuraym, Badr at-Turki | our own forced alignment, per word |
| 19 mp3quran sets | mp3quran's ayah timings (per ayah, no words) |

For recordings nobody has timed, `scripts/align_recitation.py` runs forced alignment: torchaudio's MMS model lines up the app's own Arabic text with the audio.

- **Blocks:** it works through each surah in blocks of about two minutes, with a minute of look-ahead.
- **Opening letters:** letters such as *alif lam mim* are aligned as their names.
- **GPU:** it uses a CUDA GPU when there is one. Badr at-Turki's 25 hours took about an hour on an RTX 3060.

The result is checked in two ways. Ayah starts should fall on pauses in the audio. Reciting speed should be plausible everywhere, so a misaligned ayah would show up as impossibly fast or slow. Then `fetch_reader_data.py qul` imports it like a QUL file and writes the clips and the word timings.
