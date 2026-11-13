---
name: quran-viz
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
  tajweed-n: "#9A5200"
  tajweed-n-night: "#FBBF24"
  tajweed-p: "#B93A08"
  tajweed-p-night: "#FB923C"
  tajweed-o: "#BE185D"
  tajweed-o-night: "#FDA4AF"
  tajweed-c: "#1D4ED8"
  tajweed-c-night: "#93C5FD"
  tajweed-m: "#7F1D1D"
  tajweed-m-night: "#F26060"
  tajweed-g: "#137A39"
  tajweed-g-night: "#4ADE80"
  tajweed-a: "#47750C"
  tajweed-a-night: "#A3E635"
  tajweed-u: "#5F6878"
  tajweed-u-night: "#9CA3AF"
  tajweed-d: "#374151"
  tajweed-d-night: "#D1D5DB"
  tajweed-b: "#334155"
  tajweed-b-night: "#CBD5E1"
  tajweed-f: "#0369A1"
  tajweed-f-night: "#38BDF8"
  tajweed-w: "#4B5563"
  tajweed-w-night: "#B8BEC9"
  tajweed-i: "#7C3AED"
  tajweed-i-night: "#A78BFA"
  tajweed-q: "#0F766E"
  tajweed-q-night: "#2DD4BF"
  tajweed-h: "#6E6660"
  tajweed-h-night: "#A8A29E"
  tajweed-s: "#80644F"
  tajweed-s-night: "#C4A88E"
  tajweed-l: "#57534E"
  tajweed-l-night: "#D6D3D1"
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
  title:
    fontFamily: "Source Sans 3 Variable, Source Sans 3, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
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
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.illumination}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  badge-makki:
    textColor: "{colors.makki}"
    rounded: "{rounded.sm}"
  badge-madani:
    textColor: "{colors.madani}"
    rounded: "{rounded.sm}"
---

# Design System: quran-viz

> Status: Phase 6 of the redesign (all phases in). Tokens live in code (`src/index.css`,
> `tailwind.config.js`, `src/theme/tokens.ts`), fonts ship with the app, the
> shell (rail / tab bar) is built on them, and every screen, chart tooltip and
> primitive uses the token names (`text-ink`, `bg-surface`, `border-line`). No
> `slate-*` class is left, and Tailwind's slate ramp is no longer overridden.

## Overview

**Creative North Star: "Mushaf sebagai instrumen"** (the mushaf as an instrument)

The visual language comes from the mushaf itself, not from analytics software: ink on a cool
paper, the lapis of illumination for what can be touched, the mushaf's red ink for markers, and
two earth colours that always and only mean where an ayah was revealed. The app is a study
instrument: precise, quiet, legible at a glance on a phone. Boldness is spent in one place, the
Peta Mushaf (the whole Qur'an as 6,236 cells); everything around it is disciplined.

Rejected on purpose: the parchment-cream-and-gold look, gradient washes, and decorative Islamic
geometry. Qur'anic Arabic is never used as ornament.

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
Shown only when the reader's Tajweed switch is on, and only on Qur'anic letters. Hue carries
the rule family (madd amber to deep red, ghunnah green, idghām cool grey, ikhfāʾ blue, iqlāb
violet, qalqalah teal, unpronounced letters warm grey). Each colour has a day and a night value
and keeps at least 4.5:1 on Stone Paper, Leaf and Gutter of its theme (`tajweed.test.ts`).
Source of truth: `RULE_COLORS` in `src/data/tajweed.ts`.

| Code | Rule | Day | Night |
|---|---|---|---|
| n | Natural prolongation (Madd Ṭabīʿī) | #9A5200 | #FBBF24 |
| p | Prolongation at a stop (Madd ʿĀriḍ li-s-Sukūn) | #B93A08 | #FB923C |
| o | Prolongation before hamza (Madd Wājib / Munfaṣil) | #BE185D | #FDA4AF |
| m | Necessary prolongation (Madd Lāzim) | #7F1D1D | #F26060 |
| g | Ghunnah (nasalization) | #137A39 | #4ADE80 |
| a | Idghām with ghunnah | #47750C | #A3E635 |
| u | Idghām without ghunnah | #5F6878 | #9CA3AF |
| w | Idghām Shafawī (mīm into mīm) | #4B5563 | #B8BEC9 |
| d | Idghām Mutajānisayn | #374151 | #D1D5DB |
| b | Idghām Mutaqāribayn | #334155 | #CBD5E1 |
| f | Ikhfāʾ (hiding) | #0369A1 | #38BDF8 |
| c | Ikhfāʾ Shafawī (mīm before bāʾ) | #1D4ED8 | #93C5FD |
| i | Iqlāb (conversion) | #7C3AED | #A78BFA |
| q | Qalqalah (echo) | #0F766E | #2DD4BF |
| h | Hamzat al-Waṣl (silent connecting hamza) | #6E6660 | #A8A29E |
| s | Silent (not pronounced) | #80644F | #C4A88E |
| l | Lām Shamsiyyah (assimilated lām) | #57534E | #D6D3D1 |

What each code marks was read off the `quran-tajweed` edition itself: `c` is always mīm sākinah
before bāʾ, `w` mīm into mīm, `d` د→ت / ت→ط / ذ→ظ, `b` ل→ر / ق→ك. (Until 2026-11 the app had
`c` as madd muttaṣil and `w`/`d`/`b` shifted by one.) The reader's "Tajweed rules" sheet shows
each rule with a real example word (`TAJWEED_EXAMPLES`).

### Named Rules
**The Revelation Rule.** Ochre, malachite and slate mean Makkiyah, Madaniyah and Hijra, in every
chart, badge and cell, in every palette. They are never reused for anything else.

**The Red Ink Rule.** Rubric appears only where the mushaf itself would use red ink.

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
- **Title** (600, 1.25rem, 1.3): view and panel titles.
- **Body** (400, 1rem, 1.5): interface text.
- **Label** (500, 0.8125rem, 1.35, tabular figures): controls, axes, counts. Sentence case.

### Named Rules
**The No Tiny Text Rule.** Nothing below 0.75rem; no `text-[10px]`/`text-[11px]`.
**The Sentence Case Rule.** No tracked-out ALL-CAPS labels.

## Layout

Rail + content + optional context panel on desktop; content + bottom tab bar on phones, with
safe-area insets. Content is left-aligned; Arabic blocks align right inside their own `dir="rtl"`
container. Spacing steps: 4 / 8 / 16 / 24 / 40px. Sizes are in rem so the Interface scale setting
resizes everything together.

## Elevation & Depth

Flat by default with tonal layering (paper → leaf → gutter). Shadows only for things that float
above content: sheets, popovers, the mini-player.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px -8px rgb(27 34 48 / 0.18)`): popovers, sheets, mini-player.

## Shapes

Small, quiet radii: 4px for badges and cells, 8px for controls, 12px for panels and sheets. No
pill-shaped everything; no nested rounded cards.

## Components

### Buttons
- **Primary:** lapis fill, leaf text, 8px radius, 10px × 16px.
- **Quiet:** no fill, ink-muted text, gutter fill on hover.
- **Focus:** 2px lapis ring with 2px offset, `:focus-visible` only.

### Dropdowns
- **Select:** a surface button with a hairline border and a chevron; open, the
  border turns lapis. The list is a raised surface card (12px radius, float
  shadow) under the button, or above it near the bottom edge; the chosen option
  is lapis with a check, the active one a gutter tint; group headings in small
  ink-subtle type. Never the platform's native picker.

### Badges
- **Revelation badges:** text in the revelation colour on a 12% tint of it, 4px radius.

### Reader
- **Ayah row:** revelation-coloured reference badge, quiet 40px actions (play,
  bookmark, context, more), the Arabic closed by the ayah-end medallion (U+06DD
  with Arabic-Indic digits), translation in Literata. Rows are divided by a
  hairline, not boxed. Selected ayah: a gutter tint; the ayah being recited: a
  3px rubric rule on the leading edge.
- **Mushaf page:** a leaf with a hairline frame, continuous justified text, juz
  and hizb in the head margin, page number at the foot; ۞ and ۩ in rubric.
- **Konteks ayat:** docked beside the text from 960px of reader width, else a
  sheet (bottom on phones, right edge otherwise).
- **Head:** floats over the text and slides up out of the way while reading
  down; a scroll up brings it back. "Go to" drops from the top edge; About this
  surah, Tajweed rules and the player options rise from the bottom.
- **Mini-player:** one slim bar under the text; everything else in a sheet.

### Peta Mushaf (signature)
All 6,236 ayahs in mushaf order, one row per juz, each ayah a sliver as wide as its text, in
its place colour; surah starts as paper hairlines. Overlays: sajdah (rubric dot), last read (ink
bar), bookmarks (lapis dot); a root's or a topic's ayahs highlighted by dimming the rest to 16%.
The same strip, one row high, sits under the reader's head as "where am I in the Qur'an".

### Index list
Surahs, juz and manzils as a dense table (hairline rows, tabular figures, sortable headers), a
length bar per surah coloured by place with exception ayahs in their own colour. Cards remain
as an alternative layout.

### Analysis (dashboard)
Each chart is a question ("Which surahs are the longest?") with a one-line answer computed
from the range beneath it, in reading type, then a quiet scope line. The questions form the
menu: beside the chart when the dashboard is wide enough, otherwise the question itself is the
button that opens them in a sheet. Filters are chips above the chart (range, which ayahs,
sort, colour, bars); a chip that differs from its default is tinted lapis and has its own
clear button. A mouse click on a mark opens the reader; a tap pins a readout first (title,
detail, "Open in reader"), and a second tap opens it. "Show data" swaps the chart for its
table (the CSV rows), whose first column opens the surah or ayah.

## Do's and Don'ts

### Do:
- **Do** take colours from the tokens (`bg-paper`, `text-ink`, `text-makki`, `ring-illumination`…).
- **Do** mark every Arabic node `lang="ar" dir="rtl"`.
- **Do** use tabular figures for counts and axes.

### Don't:
- **Don't** use anything lighter than Ink Subtle for text, and no `slate-*`/`gray-*` classes.
- **Don't** use colour for decoration, gradients, or glass.
- **Don't** put the Qur'anic text in a truncated line or a modal-sized box.
- **Don't** use emoji or Unicode glyphs as icons; use lucide-react.
