# Storage and sync

## Where your data lives

Everything you make is kept in the browser's `localStorage`, under keys that start with `qv.`. The theme is the one exception, under `quranviz.theme`.

| Key | Holds | Code |
|---|---|---|
| `qv.marks` | pins, collections, their notes | `lib/marks.ts` |
| `qv.hifdh` | every ayah's status, page reviews, stumbles, the recall target | `lib/hifdh.ts` |
| `qv.hifdh.log` | every page rating | `lib/reviewLog.ts` |
| `qv.reading.log` | this device's reading seconds per day | `lib/readingStore.ts` |
| `qv.reading.others` | other devices' reading time, from sync | `lib/readingStore.ts` |
| `qv.lastRead.list` | last-read places | `lib/lastRead.ts` |
| `qv.khatam`, `qv.reading.goal`, `qv.reader.*`, … | settings | the screen that owns each |

`lib/usePersistentState.ts` mirrors a piece of state to a key. Every stored value passes through a sanitizer on the way in, so a value from an older version, another device or a backup can't break a screen. A value that is wrong is repaired or replaced by the default. Two open tabs follow each other's writes.

`localStorage` belongs to one origin. The desktop app at `localhost:5173` and the Android app each have their own. Backup files and sync carry data between them.

## Backups

`lib/backup.ts` writes every `qv.*` key and the theme to one JSON file, except the audio folder's path, the sync token and passphrase, and the device id. Restoring replaces those keys and reloads the page, so each value goes through its sanitizer.

## Sync

```text
 this device                                        secret gist (GitHub)
 1. read the sealed copy  ◄───────────────────────  qurani-sync.json   
 2. open it with the passphrase, merge with what is here
 3. store what changed, tell the screens to read it again
 4. seal the result, write it back  ──────────────►  (only if it changed)
```

The code is in `src/lib/sync/`:

- **`changes.ts`** is the only part loaded at start-up. It holds the list of synced settings and their change times (`qv.sync.stamps`), plus the events between the app and sync. A setting is stamped only when you change it, not when its default is first written or when sync stores a value. Otherwise a new device's defaults would look newer than your real choices.
- **`merge.ts`** holds the merge rules, all pure. The result never depends on which device syncs first, and merging the same copy twice changes nothing; `merge.test.ts` checks both.
  - Pins, collections and collection ayahs merge as separate records, each kept at its newest change. A deletion leaves a marker, kept for 180 days, that beats every change made before it.
  - Each ayah keeps its newest status. Data from before sync has no times, so the further status wins, and marking something on one device is never undone by the other.
  - Each page keeps its newest rating. Stumbles merge by time, and a removal is stored as a count of zero.
  - The review history is a union, and reading time is the larger count per device and day.
- **`crypto.ts`** derives a key from the passphrase with PBKDF2-SHA256 (600,000 rounds) and seals the copy with AES-GCM-256, using the browser's WebCrypto. The key is cached for the session.
- **`gist.ts`** talks to the GitHub API with `fetch`: it finds the gist by its description, reads the file (or its raw copy when large), creates it on the first write, and updates it after that. Errors become one of five problems the settings card can explain.
- **`engine.ts`**:
  - It collects the local data and stores a merged copy, writing only the keys that changed.
  - It runs on launch, on return to the front, 20 seconds after a change, at once when going to the background with a change waiting, and on "Sync now".
  - It loads as its own small chunk after start-up.

Mark ids include the time and random characters, so two devices adding a pin each never produce the same id.

### Limits

- **Who can read it:** a secret gist can be read by anyone who has its link, which is why the copy is encrypted. The token is stored on each device, as any app stores a login.
- **Restoring an old backup** while sync is on merges it with the synced copy. Newer changes from other devices win.
- **Two devices at the same moment:** if they write within the same second, one write replaces the other in the gist. Each device still has its own data, so the next sync brings both together.
