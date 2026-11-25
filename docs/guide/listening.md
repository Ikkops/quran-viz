# Listening

## The player

The speaker icon in the reader's top bar shows or hides the player at the bottom of the reader.

- **First row:** the seek bar, between the two ends of the range. Each end is a `− 36:1 +` stepper: the start on the left, the end on the right.
- **Second row:**
  - repeat
  - restart the range
  - previous ayah
  - play/pause
  - next ayah
  - go to the ayah being recited
  - the options (the sliders icon)

**The range** is what plays. Until you change it, it follows what is on screen: the surah or division you are reading by, or the page in the middle of the screen in the mushaf. Once you edit it, it stays until you move to another window.

**The play button on an ayah** plays that ayah alone, with its repeats, and then stops.

**The repeat button** cycles through repetitions of each ayah: none, 1×, 2×, 3×, 5×, 11× and endless.

When you close the reader while it plays, a **Now playing** bar stays above the tabs. Tap its label to go back to the ayah being recited. Recitation keeps going in the background on Android, with controls in the notification.

## Options

The sliders icon opens the player's options. **Play** starts the range at once. **Cancel** puts everything back as it was when the sheet opened.

- **Reciter.** Reciters with word timings carry a highlighter mark: while they recite, the word being said lights up.
- **From and To:** the range, as a surah and an ayah each. **Set to the playing ayah** and **Reset** are next to them.
- **Repeat each ayah** and **repeat the range** (endless is allowed).
- **Gap** between ayahs. Two settings leave a pause as long as the ayah itself, or one and a half times it, so you can recite it back.
- **Speed.**
- **Build up:** see below.
- **Sleep timer:** stop after 15, 30 or 60 minutes, or at the end of the surah. The ayah being recited always finishes.

## Build up

Build up is a way to memorise a passage by joining each new ayah to the ones before it. With ayahs 1 to 3 and two plays each, it plays:

```text
1 1 · 2 2 · 1 2 · 3 3 · 1 2 3
```

Each new ayah is played with its repeats, then the passage from its start up to that ayah once. Three options sit under the switch, with a preview of what will play:

- **Repeat the set:** play each joined set more than once.
- **Pause after the set:** silence after a set, as long as the set or longer, to recite it yourself.
- **Moving window:** once the set grows past a number of ayahs, it starts over from the last ones and builds them up again. A set that has grown to ayahs 1–6 goes on with 2, 3, 2–3 and so on, up to 2–6.

## Reciters and audio

**On Android** the app lists about 60 reciters. Audio is downloaded one surah at a time from everyayah.com or mp3quran.net, the first time you press Play in that surah. Play starts once every surah of the range is on the device, so a long range never stops halfway for a download.

- **Ask before downloading:** Settings → Audio storage → **Ask before downloading audio** makes the player offer each download with its size instead.
- **Where audio is kept:** internal storage, the app's folder on an SD card, or any folder you choose. Moving it copies first and deletes the old files only when the copy is complete.
- **Deleting:** **Saved audio** lists what is on the device, per reciter and per surah, with a delete button for each.

**On a computer** the reader plays the reciters whose files are in the project's `audio/` folder (see [Install](/guide/install#audio-on-the-desktop)).
