# Settings, backup and sync

## Settings

- **Language:** English or Indonesian. The interface, transliteration and surah names follow it.
- **Theme:** light, cream, sepia, dark, warm dark, black, or the system's choice. Also the **accent** colour.
- **Interface scale:** makes everything larger or smaller (capped on narrow screens).
- **Qur'an font and size.**
- **Reading:** how many last-read places Home shows.
- **Audio storage** and **Reminders**, in the Android app (see [Listening](/guide/listening) and [Activity](/guide/activity)).
- **Charts:** the histogram bucket size and how many extremes the charts list.
- **Share theme:** a code that carries your theme, accent and fonts to another device.
- **Keyboard shortcuts**, **About** and **Welcome**.

## Keyboard shortcuts

| Keys | Does |
|---|---|
| Ctrl K or / | Search the Qur'an: Arabic, a reference like 2:255, or translation |
| H · 1 · 2 · 3 · 4 | Home · Activity · Dashboard · Structure · Settings |
| B | Bookmarks |
| ? | Settings, with this list |
| ← / → | In the reader: previous / next surah, juz, page… |

## Backup

**Settings → Backup** saves your bookmarks, memorisation, reading activity and settings to one file. Downloaded audio and the sync token are not included.

**Restore from a backup** replaces everything on the device with the file's contents, after asking.

## Sync between devices

Sync keeps your phone and computer in step. The data is stored in a private gist in your own GitHub account, encrypted with a passphrase before it leaves the device, so the gist holds nothing readable.

<img src="/shots/sync.webp" alt="The Sync between devices card in Settings, with the token link, the token and passphrase fields and Start syncing" width="300">

### What syncs

- Bookmarks, pins and their notes.
- Memorisation: every ayah's status, each page's review schedule, the review history and stumbled words.
- Reading time, kept per device and added together.
- Last-read places.
- Settings that mean the same everywhere: language, translation, reading goal, khatam target, older pages a day, the recall target, the number of last-read places, tajweed colours, and the reader's info and word-meaning languages.

The theme, fonts, sizes, interface scale, reciter and reminders stay per device. A phone and a computer usually want different ones.

### Setting it up

1. On GitHub, open **[New fine-grained token](https://github.com/settings/personal-access-tokens/new)**. Name it, for example "quran-viz sync", and pick an expiry.
2. Under **Account permissions**, set **Gists** to **Read and write**. Nothing else is needed.
3. Generate the token and copy it.
4. In the app, open **Settings → Sync between devices**. Paste the token, choose a passphrase, and press **Start syncing**.
5. On your other device, do the same with **the same passphrase**. A token of its own works, or the same one.

The first device creates the gist. The others find it by its name and merge what they had.

::: warning Keep the passphrase
The passphrase can't be recovered. Without it the synced copy can't be opened, though each device keeps its own data. If you lose it, stop syncing on every device, delete the gist named "quran-viz sync" on GitHub, and start again with a new passphrase.
:::

### When it runs

- When the app starts, and when it comes back to the front.
- About 20 seconds after you change a bookmark, a status, a rating or a synced setting.
- Straight away when the app goes to the background with a change waiting.
- When the connection comes back.
- Whenever you press **Sync now**.

If two devices changed the same thing, the newer change wins. A deletion also counts as a change, so something you removed on one device doesn't come back from the other. GitHub keeps every version of the gist, so an earlier copy can always be recovered there.

### If something goes wrong

The card says what happened:

| Message | What to do |
|---|---|
| GitHub didn't accept the token | It expired, or Gists isn't set to Read and write. Make a new token. |
| This passphrase doesn't open the synced copy | Use the passphrase you chose on your first device. |
| No connection | Nothing. It syncs when you're back online. |
| The synced copy couldn't be read | Another device runs a newer version of the app. Update this one. |

**Stop syncing on this device** removes the token and passphrase from this device. Your data stays on it.
