# The reader

The reader (`src/components/reader/`) is a page, not a pop-up. When the address has a reader target, `App` shows `ReaderView` and keeps the current view mounted but hidden, so its state and scroll survive. Opening adds a history entry and moving inside the reader doesn't, so Android's back button leaves the reader in one step.

## Windows and scopes

The reader shows one window at a time: a surah, juz, hizb, rukuʿ or page (the "read by" setting), within a scope also used for links (`#home/r/<scope>/<value>/<ayah>`). The list is virtualised with `@tanstack/react-virtual`, so a long surah draws only the rows on screen.

## Printed pages

A printed layout (`data/mushafLayout.ts`) gives every page's lines as words. Each line's words are spread to the width, and the font is fitted to the widest line. The widths are measured on a canvas (`lineWidths`), so a page mounts at its final size in one pass, without measuring its own spans and laying out again. A page that mounts off screen draws its lines a few at a time, so scrolling stays smooth.

## Turning pages

`lib/useSwipePager.ts` is the swipe used by the reader and by the Dashboard, Structure and Activity tabs. Between the touch and the release it does no React work: the finger moves one `translateX` on a track that already holds the neighbouring panes. Let go past 30% of the width, or with a flick, and it commits. In the reader the pane on the right is the previous window and the one on the left the next, as in an Arabic mushaf. A `ReaderPeek` on each side draws the start of the neighbouring window.

## Following the recitation

When a new ayah starts, the list scrolls to it only if the previous ayah was in view (`lib/ayahInView.ts`). If you scrolled away to read something else, it leaves you there. For reciters with word timings, the word being recited lights up from the player's clock.

## Hafalan mode

`data/hifdh.ts` decides what each word shows at each level, and `Masked.tsx` draws the hidden part as a transparent slot over the word's own width. All three ways of drawing text use it: printed pages, ayah rows and flowing pages. A long press on a hidden printed word records a stumble.

## Search

Search in the reader (`data/textSearch.ts`) finds every match in the Arabic, tolerating spelling differences, and in every translation shown, ignoring case and accents. `2:255` or `255` is read as an ayah reference. Nothing is filtered out: you step through the matches in place.
