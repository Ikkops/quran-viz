---
name: Qurani
description: A structure-first Qur'an study instrument — the mushaf as data, wired to a reader.
colors:
  paper: "#F7F8F5"
  surface: "#FFFFFF"
  surface-sunken: "#EDEFEA"
  line: "#D9DDD4"
  ink: "#1B2230"
  ink-muted: "#4B5566"
  ink-subtle: "#5F6878"
  makki: "#985D16"
  madani: "#0E7A5F"
  hijra: "#56658A"
  illumination: "#1F4FA0"
  rubric: "#B23A2A"
  paper-night: "#0E1320"
  surface-night: "#161C2C"
  surface-sunken-night: "#0A0E18"
  line-night: "#283149"
  ink-night: "#E6E9EF"
  ink-muted-night: "#AEB6C5"
  ink-subtle-night: "#8F98AB"
  makki-night: "#D9A05A"
  madani-night: "#46B996"
  hijra-night: "#93A2C4"
  illumination-night: "#86A9EE"
  rubric-night: "#E87A68"
  tajweed-a: "#9A38A9"
  tajweed-a-night: "#D79BE0"
  tajweed-u: "#6C6C6C"
  tajweed-u-night: "#A8A8A8"
  tajweed-i: "#3264C5"
  tajweed-i-night: "#8AB0F5"
  tajweed-f: "#B70100"
  tajweed-f-night: "#FF7A70"
  tajweed-c: "#B70100"
  tajweed-c-night: "#FF7A70"
  tajweed-w: "#9A38A9"
  tajweed-w-night: "#D79BE0"
  tajweed-g: "#A35200"
  tajweed-g-night: "#F0A04B"
  tajweed-q: "#267500"
  tajweed-q-night: "#7ED957"
  tajweed-l: "#5E554C"
  tajweed-l-night: "#DCD5CD"
  tajweed-h: "#77685C"
  tajweed-h-night: "#B8ADA2"
  tajweed-s: "#82664E"
  tajweed-s-night: "#CDB197"
  tajweed-n: "#007A6D"
  tajweed-n-night: "#4FD1C5"
  tajweed-p: "#0C7594"
  tajweed-p-night: "#67C8E8"
  tajweed-o: "#CC236C"
  tajweed-o-night: "#F58AB4"
  tajweed-m: "#A0156F"
  tajweed-m-night: "#F26BC4"
  tajweed-d: "#5E6672"
  tajweed-d-night: "#B4BCC8"
  tajweed-b: "#4C5563"
  tajweed-b-night: "#C8CFDA"
typography:
  quran:
    fontFamily: "Amiri Quran, Amiri, serif"
    fontSize: "1.6rem"
    lineHeight: 2.2
  reading:
    fontFamily: "Literata Variable, Literata, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  display:
    fontFamily: "Source Sans 3 Variable, Source Sans 3, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Source Sans 3 Variable, Source Sans 3, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Source Sans 3 Variable, Source Sans 3, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Source Sans 3 Variable, Source Sans 3, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Source Sans 3 Variable, Source Sans 3, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
    fontFeature: "tnum"
  eyebrow:
    fontFamily: "Source Sans 3 Variable, Source Sans 3, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.01em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.illumination}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "36px"
  button-quiet:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  segmented-track:
    backgroundColor: "{colors.surface-sunken}"
    rounded: "{rounded.md}"
    padding: "2px"
  segmented-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  list-row:
    rounded: "{rounded.sm}"
  badge-makki:
    textColor: "{colors.makki}"
    rounded: "{rounded.xs}"
  badge-madani:
    textColor: "{colors.madani}"
    rounded: "{rounded.xs}"
---

# Design System: Qurani

> Status: Phase 6 of the redesign, plus the 2026-11 interface pass (type steps,
> `shadow-soft`, radius roles, `Button`). Tokens live in code (`src/index.css`,
> `tailwind.config.js`, `src/theme/tokens.ts`), fonts ship with the app, the
> shell (top bar / tab bar) is built on them, and every screen, chart tooltip and
> primitive uses the token names (`text-ink`, `bg-surface`, `border-line`). No
> `slate-*` class is left, and Tailwind's slate ramp is no longer overridden.

## Overview

**Creative North Star: "Mushaf sebagai instrumen"** (the mushaf as an instrument)

The visual language comes from the mushaf itself, not from analytics software: ink on a cool
paper, the lapis of illumination for what can be touched, the mushaf's red ink for markers, and
two earth colours that always and only mean where an ayah was revealed. The app is a study
instrument: precise, quiet, legible at a glance on a phone. Boldness is spent in one place, the
Peta Mushaf (the whole Qur'an as 6,236 cells); everything around it is disciplined.

The interface language follows Notion's calm, content-first conventions (weighted headings over
regular body text, white cards on paper defined by a hairline and a whisper of shadow, airy 8px
rhythm, quiet rows) with Linear's precision for data and controls (compact exact buttons,
segmented tabs, a surface ladder instead of shadows on dark themes). Both are direction, not
copies.

Rejected on purpose: the parchment-cream-and-gold look and gradient washes. Qur'anic Arabic is
never used as ornament.

**Key Characteristics:**
- Colour carries meaning (place of revelation, interaction, markers), never decoration.
- The Qur'anic text is the largest, calmest thing on any screen it appears on.
- Dense but breathable data; numbers in tabular figures.
- Light and dark are equal citizens (night reading is common).

## Colors

Cool paper and blue-black ink, with two earth tones for revelation and one lapis accent.

### Primary
- **Lapis Illumination** (#1F4FA0 / night #86A9EE): links, focus rings, selected states, primary
  buttons, text selection. The user's palette choice swaps only this colour.

### Secondary
- **Makkah Ochre** (#985D16 / night #D9A05A): Makkiyah, everywhere: chart marks, badges, map cells.
- **Madinah Malachite** (#0E7A5F / night #46B996): Madaniyah, everywhere.
- **Hijra Slate** (#56658A / night #93A2C4): ayahs revealed on the journey.

### Tertiary
- **Rubric Red** (#B23A2A / night #E87A68): the mushaf's red ink: sajdah, waqf and division
  markers, the current-ayah highlight. Never for errors-as-decoration or emphasis in prose.

### Neutral
- **Stone Paper** (#F7F8F5 / night #0E1320): app background.
- **Leaf** (#FFFFFF / night #161C2C): raised surfaces (panels, sheets).
- **Gutter** (#EDEFEA / night #0A0E18): sunken wells, tracks, inactive segments.
- **Rule** (#D9DDD4 / night #283149): dividers and outlines.
- **Ink** (#1B2230 / night #E6E9EF): primary text (≥14:1).
- **Ink Muted** (#4B5566 / night #AEB6C5): secondary text (≥7:1).
- **Ink Subtle** (#5F6878 / night #8F98AB): captions and axis labels (≥5:1). Nothing lighter is
  used for text.

### Tajweed
Shown only when the reader's Tajweed switch is on, and only on Qur'anic letters. The six
families follow common printed Indonesian tajweed charts: ghunnah brown-orange, ikhfāʾ red
(`f` and `c` share it), idghām with ghunnah purple (`a` and `w` share it), idghām without
ghunnah grey (`d`, `b` cooler greys of the same family), iqlāb blue, qalqalah green. Madd takes
the hues those leave free: teal / cyan for the two-count madds, rose / magenta for the long
ones. Unpronounced letters are warm greys. Each colour has a day and a night value and keeps
at least 4.5:1 on Stone Paper, Leaf and Gutter of its base theme, 3:1 on the others
(`tajweed.test.ts`). Source of truth: `RULE_COLORS` in `src/data/tajweed.ts`.

| Code | Rule | Day | Night |
|---|---|---|---|
| a | Idghām with ghunnah | #9A38A9 | #D79BE0 |
| u | Idghām without ghunnah | #6C6C6C | #A8A8A8 |
| i | Iqlāb (conversion) | #3264C5 | #8AB0F5 |
| f | Ikhfāʾ Ḥaqīqī (hiding) | #B70100 | #FF7A70 |
| c | Ikhfāʾ Shafawī (mīm before bāʾ) | #B70100 | #FF7A70 |
| w | Idghām Shafawī (mīm into mīm) | #9A38A9 | #D79BE0 |
| g | Ghunnah (nasalization) | #A35200 | #F0A04B |
| q | Qalqalah (echo) | #267500 | #7ED957 |
| l | Lām Shamsiyyah (assimilated lām) | #5E554C | #DCD5CD |
| h | Hamzat al-Waṣl (silent connecting hamza) | #77685C | #B8ADA2 |
| s | Silent (not pronounced) | #82664E | #CDB197 |
| n | Natural prolongation (Madd Ṭabīʿī) | #007A6D | #4FD1C5 |
| p | Prolongation at a stop (Madd ʿĀriḍ li-s-Sukūn) | #0C7594 | #67C8E8 |
| o | Prolongation before hamza (Madd Wājib / Munfaṣil) | #CC236C | #F58AB4 |
| m | Necessary prolongation (Madd Lāzim) | #A0156F | #F26BC4 |
| d | Idghām Mutajānisayn | #5E6672 | #B4BCC8 |
| b | Idghām Mutaqāribayn | #4C5563 | #C8CFDA |

What each code marks was read off the `quran-tajweed` edition itself: `c` is always mīm sākinah
before bāʾ, `w` mīm into mīm, `d` د→ت / ت→ط / ذ→ظ, `b` ل→ر / ق→ك. (Until 2026-11 the app had
`c` as madd muttaṣil and `w`/`d`/`b` shifted by one.) The reader's "Tajweed rules" sheet opens
with the stop signs (`WAQF_SIGNS`, discs tinted rubric for the firm ones and illumination for
the rest, the sign in ink), then the rules in `TAJWEED_GROUPS` order, each with its trigger
letters in the rule's colour and a real example word (`TAJWEED_EXAMPLES`).

### Named Rules
**The Revelation Rule.** Ochre, malachite and slate mean Makkiyah, Madaniyah and Hijra, in every
chart, badge and cell, in every palette. They are never reused for anything else.

**The Red Ink Rule.** Rubric appears only where the mushaf itself would use red ink.

**The Mushaf Ornament Rule.** Islamic geometric ornament is allowed for the mushaf's own
structural marks (surah banners, division marks, section dividers), drawn with theme tokens: no
gold or parchment palette, no gradients, no image files. It never sits where it reduces the
legibility of the Qur'anic text and never masquerades as text. Reference:
`components/reader/SurahBanner.tsx`.

## Typography

**Qur'an Font:** Amiri Quran (user-selectable: Amiri, Scheherazade New, Noto Naskh Arabic, Lateef)
**Reading Font:** Literata (translations, tafsir, transliteration)
**UI Font:** Source Sans 3 (interface, labels, data)

**Character:** a calm naskh for the revelation, a bookish serif with full transliteration
coverage (ā ī ū ḥ ṣ ʿ) for what explains it, and a clear humanist sans for the instrument.

### Hierarchy
- **Qur'an** (400, 1.6rem × user scale, line-height 2.2): ayah text, always `lang="ar" dir="rtl"`.
- **Reading** (400, 1.0625rem × translation scale, 1.6): translations, tafsir and
  transliteration, measure ≤ 68ch.
- **Display** (`text-display`: 700, 1.625rem, 1.2, −0.02em): page-level numbers and hero lines.
- **Title** (`text-title`: 600, 1.25rem, 1.3, −0.01em): view, sheet, dialog and card titles;
  the top bar's page name.
- **Heading** (`text-heading`: 600, 1rem, 1.4, −0.005em): sections (`SectionTitle`).
- **Body** (400, 1rem / `text-sm` 0.875rem, 1.5): interface text, never bold by default.
- **Label** (500, 0.8125rem–0.875rem, tabular figures): controls, axes, counts. Sentence case.
- **Eyebrow** (`text-eyebrow`: 600, 0.75rem, 1.33, +0.01em, usually `text-ink-subtle`): small
  labels above a control or group. Sentence case, never upper case.

The steps are Tailwind `fontSize` entries in rem (size, line height, tracking and weight in one
class), so the Interface scale resizes them.

### Named Rules
**The No Tiny Text Rule.** Nothing below 0.75rem; no `text-[10px]`/`text-[11px]`.
**The Sentence Case Rule.** No tracked-out ALL-CAPS labels.

## Layout

A slim top bar (brand, the page's name, search), the content, and a bottom tab bar, at every
width, with safe-area insets; the reader replaces all three with its own head. Content is left-aligned; Arabic blocks align right inside their own `dir="rtl"`
container. Spacing follows an 8px rhythm: 4 / 8 / 12 / 16 / 24 / 32px; whitespace separates
sections more than rules do. Sizes are in rem so the Interface scale setting resizes everything
together.

## Elevation & Depth

Tonal layering (paper → leaf → gutter) plus hairlines. On light themes cards add a barely
visible layered shadow; on dark themes depth comes only from the surface ladder and hairlines.
Heavier shadows are kept for things that float above content.

### Shadow Vocabulary
- **Soft** (`shadow-soft` = `var(--shadow-soft)`): cards and the selected segment. Light themes:
  `0 0.175px 1.04px rgb(0 0 0/.01), 0 0.8px 2.93px rgb(0 0 0/.02), 0 2.03px 7.85px
  rgb(0 0 0/.027), 0 4px 18px rgb(0 0 0/.04)`. Dark themes (`.dark`): only a top-edge
  highlight, `inset 0 1px 0 rgb(255 255 255/.04)`. One variable, so no `dark:shadow-none`.
- **Float** (`shadow-float`: `0 8px 24px -8px rgb(27 34 48 / 0.18)`): popovers, select lists,
  sheets, dialogs, the mini-player.

## Shapes

Radii by role, on Tailwind's own names:

| Radius | Class | Role |
|---|---|---|
| 4px | `rounded` | badges, chips, form fields, map cells |
| 6px | `rounded-md` | list rows, menu and select options, the selected segment |
| 8px | `rounded-lg` | buttons, the segmented track, small cards, popover rows |
| 12px | `rounded-xl` | cards, popovers, select lists |
| 16px | `rounded-2xl` | sheets (free corners), dialogs, large containers |

`rounded-full` only for switches, dots, avatars and the tab bar's current-tab pill. No nested
rounded cards.

## Components

### Buttons
`Button` (`components/ui`): 8px radius, 14px/500 label, 36px high (`md`, 14px side padding) or
32px (`sm`), 44px on touch screens, optional leading icon.
- **Primary:** lapis fill, white text (paper on dark themes); one per view or sheet.
- **Secondary:** leaf with a hairline border, ink text, gutter fill on hover. The default.
- **Quiet:** no fill, ink-muted text, gutter fill on hover. Icon-only quiet buttons are
  `QuietIconButton` (40px, 44px on touch).
- **Focus:** one ring for the whole app in the base layer: 2px lapis at 65% with a 2px offset,
  `:focus-visible` only (Linear's ~50%, raised to keep 3:1 on paper).

### Segmented control and tabs
A gutter track (8px radius, 2px inset, faint hairline); the selected option is lifted onto leaf
(6px radius, `shadow-soft`, a hairline on dark themes) in ink; the others ink-subtle.
`fullWidth` shares the width; a long strip scrolls sideways.

### Cards and rows
- **Card:** leaf, 12px radius, hairline, `shadow-soft`. Padding 16px (`p-4`).
- **Rows:** quiet list rows, 6px radius, a gutter tint on hover; hairlines between rows only in
  dense tables.

### Sheets and dialogs
- **Sheet:** leaf, float shadow, 16px radius on the free corners; bottom sheets have a small
  grab handle and can be dragged down to close. Header in the Title step over a hairline. The
  body has no padding of its own: content pads itself `px-4` (usually `py-3`), matching the
  header's inset.
- **Dialog (`Modal`):** the same surface (16px, hairline, float); `ModalHeader` in the Title
  step over a hairline.

### Motion
Motion only says where things go; the Peta Mushaf reveal stays the one orchestrated moment.
- What is under the finger follows it 1:1 (a sheet dragged toward its edge; the reader's
  window, a Dashboard chart, a Structure or Activity tab swiped sideways). Mid-swipe the
  neighbour is already in view beside the current pane. Let go early, it springs back; where
  there is no neighbour it only gives a little. A finger inside a Dashboard chart belongs to
  the chart: it moves the readout, not the page or the pager.
- A tap answers at once: the tapped surah takes the accent tint (no fade) and keeps it until
  the reader is on screen.
- A sheet leaves toward the edge it came from. A swiped pane leaves in the direction of
  travel with its neighbour following it in; a window reached by ←/→ or a button arrives
  from the side it lies on.
- In the Android app a light haptic tick marks the point where letting go commits.
- Arrivals decelerate, `cubic-bezier(0.16, 1, 0.3, 1)`, 240–280 ms. Exits are shorter,
  150–200 ms, ease-in. No bounce. Only `transform` and `opacity`.
- Reduced motion: what the finger drives still follows it; only what plays by itself
  shortens (80 ms after release, a 120 ms fade for a sheet or window that opens or closes
  on its own).

### Tab bar
Five tabs, labels always visible, ≥56px targets. The current tab has a lapis-tinted pill behind
its icon and a 600-weight ink label; the others are ink-subtle.

### Dropdowns
- **Select:** a secondary button with a chevron; open, the border turns lapis.
  The list is a raised surface card (12px radius, float shadow) under the
  button, or above it near the bottom edge; options are 6px-radius rows inset
  4px, the chosen one lapis with a check, the active one a gutter tint; group
  headings in the Eyebrow step. Never the platform's native picker.

### Badges
- **Revelation badges:** text in the revelation colour on a 13% tint of it, 4px radius.

### Reader
- **Ayah row:** revelation-coloured reference badge, quiet 40px actions (play,
  bookmark, context, more), the Arabic closed by the ayah-end medallion (U+06DD
  with Arabic-Indic digits), translation in Literata. Rows are divided by a
  hairline, not boxed. Selected ayah: a gutter tint; the ayah being recited: a
  3px rubric rule on the leading edge. A crossed division boundary (juz, hizb…)
  is a rounded strip of lapis at 10% with centred lapis labels.
- **Mushaf page:** a leaf with a hairline frame, continuous justified text, juz
  and hizb in the head margin, page number at the foot; ۞ and ۩ in rubric. A
  surah opens with `SurahBanner`, the printed mushaf's banner drawn in tokens:
  a double-ruled frame, eight-pointed-star bands and a lobed cartouche with the
  calligraphic name (sized in em, `role="img"`). A tap opens the ayah's meaning
  (`AyahPopover`); in the printed layout press-and-hold opens the word's.
- **Hafalan mode:** hidden words are empty slots of the word's own width (Hairline tint, the
  word highlights' small radius), so the page keeps its shape; ayah-end medallions stay. A bar under the head holds
  the level (first word, first letters, hidden), cover again and leave. A word the learner
  stumbled on carries a dotted rubric underline while it is visible.
- **Similar ayahs:** each look-alike sits above the open ayah; the words they do not share
  carry a lapis tint at 15%, or become empty slots when the learner hides them.
- **Konteks ayat:** a bottom sheet at every width.
- **Head:** floats over the text and slides up out of the way while reading
  down; a scroll up brings it back. "Go to" drops from the top edge; About this
  surah, Tajweed rules and the player options rise from the bottom.
- **Mini-player:** one slim bar under the text; everything else in a sheet.

### Peta Mushaf (signature)
All 6,236 ayahs in mushaf order, one row per juz, each ayah a sliver as wide as its text, in
its place colour; surah starts as paper hairlines. Overlays: sajdah (rubric dot), last read (ink
bar), bookmarks (lapis dot); a root's or a topic's ayahs highlighted by dimming the rest to 16%.
The "Memorisation" highlight does the same for what the learner has memorised,
with a rubric dot under ayahs that need review. The same strip, one row high, sits under the reader's head as "where am I in the Qur'an".

### Memorisation progress
One encoding across the card: memorised in lapis, needs review in rubric (as
the Peta's review dots), being memorised in lapis at 30%, the rest gutter. A
share bar for the whole Qur'an with counts, a map of equal cells (one per surah
or juz, filled from the bottom; for the eye and the finger, while the rows
below carry the names for keyboards and screen readers), and quiet rows with
the surah's name and calligraphic name (or a juz's ayah range), counts and a
thin bar. Rows fit as many 18rem columns as the card holds.

### Index list
Surahs, juz and manzils as a dense table (hairline rows, tabular figures, sortable headers), a
length bar per surah coloured by place with exception ayahs in their own colour. Cards remain
as an alternative layout.

### Analysis (dashboard)
Each chart is a question ("Which surahs are the longest?") with a one-line answer computed
from the range beneath it, in reading type, then a quiet scope line. The questions form the
menu: beside the chart when the dashboard is wide enough (≥ 900px); narrower, a switcher row sits
above the question: "All charts" opens them in a sheet and a `‹ n / total ›` stepper walks the
charts in order. The question heading is plain text. Filters are chips above the chart (range, which ayahs,
sort, colour, bars); a chip that differs from its default is tinted lapis and has its own
clear button. A mouse click on a mark opens the reader; a tap pins a readout first (title,
detail, "Open in reader"), and a second tap opens it. "Show data" swaps the chart for its
table (the CSV rows), whose first column opens the surah or ayah.

## Do's and Don'ts

### Do:
- **Do** take colours from the tokens (`bg-paper`, `text-ink`, `text-makki`, `ring-illumination`…).
- **Do** mark every Arabic node `lang="ar" dir="rtl"`.
- **Do** use tabular figures for counts and axes.
- **Do** use the type steps (`text-display`/`title`/`heading`/`eyebrow`), `Button`, `Card`,
  `shadow-soft` and the radius roles instead of hand-rolled class strings.
- **Do** separate sections with space first, hairlines second.

### Don't:
- **Don't** use anything lighter than Ink Subtle for text, and no `slate-*`/`gray-*` classes.
- **Don't** use colour for decoration, gradients, or glass.
- **Don't** put the Qur'anic text in a truncated line or a modal-sized box.
- **Don't** use emoji or Unicode glyphs as icons; use lucide-react.
- **Don't** give cards heavy drop shadows, or any shadow on dark themes beyond `shadow-soft`.
- **Don't** add a second accent colour, or bold body text for emphasis where a heading belongs.
