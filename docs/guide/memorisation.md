# Memorisation

The app keeps a status for every ayah and a review schedule for every page of the Madinah mushaf. From these it plans each day: the new pages you are memorising, the pages reviewed recently, and the older ones most likely to be slipping.

## Marking what you know

Tap an ayah, or open its row's menu, and choose **Memorisation**. Apply a status to the ayah, its page, its surah or its juz. There are four statuses:

- **Not started**
- **Memorising**: new material, the *ziyadah*.
- **Memorised**
- **Memorised, needs review**

Choosing one saves it and closes the sheet.

## Hafalan mode

Switch on **Hafalan mode** in the reader's settings to test yourself on the page. A bar under the top bar sets how much stays visible:

- **First word** of each ayah.
- **First letters** of each word.
- **Hidden:** only empty slots, the width of each word, so a printed page keeps its shape.

Tap a covered ayah to uncover it. On a printed page, press and hold a hidden word to peek at that word alone. The app counts each peek as a stumble, and a word you stumbled on gets a dotted red underline while you are in Hafalan mode. **Cover again** hides everything again.

## Rating a review

After reciting from memory, press the clipboard button in the Hafalan bar. It rates every memorised page in the current window with one of three answers:

- **Forgot:** the page comes back soon, and its ayahs are marked as needing review.
- **Hard:** the page comes back sooner than after a smooth review.
- **Smooth:** the next review moves further away, and "needs review" is cleared.

The app uses FSRS, the scheduler Anki uses, to decide each page's next day. [Memorisation scheduling](/how-it-works/scheduling) explains how.

## Activity → Memorisation

Memorisation is the first tab in Activity.

**Today** lists three groups. A tap opens a page in the reader with Hafalan mode on.

- **New (ziyadah):** pages with ayahs you are memorising.
- **Recent review:** due pages last reviewed a week or less apart.
- **Older review:** the other due pages, the ones you are least likely to remember first.

Two settings sit under the list. **Older pages a day** caps the older reviews offered each day. **Recall target** is how sure you want to be that you still know a page on the day it comes due: 85, 90 (the default), 95 or 97%. A higher target means more reviews and fewer slips.

**Progress** shows how much of the Qur'an you have memorised, by surah or by juz:

- A bar and counts for memorised, needing review and memorising.
- The last 30 days' reviews and how many you recalled.
- A map with one cell per surah or juz, filled from the bottom.
- Rows for the ones you have started, with their names or, for a juz, its ayah range, such as "Al-Fatihah 1 – Al-Baqarah 141". **Show all** adds the rest.

Blue is memorised, red needs review, and pale blue is being memorised.

<img src="/shots/memorisation.webp" alt="The progress card: share memorised, the counts, the map of 114 surah cells and the started surahs as rows" width="300">

**Continue the ayah** shows an ayah you have memorised and asks for the one after it. **Words you stumbled on** lists your peeks, the most repeated first.

On Home, a **Memorisation today** line appears once anything is marked. On Android, a daily reminder can tell you how many pages are due (Settings → Reminders).

## On the mushaf map

The dashboard's mushaf map has a **Memorisation** highlight. It keeps what you have memorised at full strength, dims the rest, and puts a red dot under ayahs that need review.
