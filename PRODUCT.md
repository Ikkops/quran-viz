# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The same static React build ships to the browser and, wrapped with Capacitor 8, as an Android
APK. The phone and the desktop browser are equally first-class.

## Users

Indonesian Qur'an learners: students, study circles (halaqah) and self-learners who want to
understand how the Qur'an is put together and then read the ayah itself with its context. They
read the interface in Indonesian first (English is also supported) and meet Arabic only as
Qur'anic text.

## Product Purpose

quran-viz lets a learner see the Qur'an's structure through data (length, place of revelation,
revelation order, juz/hizb/page divisions, vocabulary, roots, topics, similar ayahs) and then land
on the exact ayah with its translation, tafsir, asbab al-nuzul and recitation. Success: from any
chart, card or search, a learner reaches the ayah in one step, and from any ayah reaches its
context.

## Positioning

A structure-first Qur'an app: the whole mushaf as data the learner can explore, wired to a
reader. Built offline from a verified corpus (QUL tafsir, translations, morphology, similar
ayahs, topics; hadith-sourced asbab) with ayah-level Makkiyah/Madaniyah corrections that are
shown honestly, including where scholars differ.

## Operating Context

- Phone in hand (Android APK, often offline) and desktop browser for longer study sessions.
- Indonesian UI by default for Indonesian browsers; English available.
- Reading is in the mushaf's own order and divisions (surah, juz, hizb, rub', ruku', page 1–604).
- Learners copy ayah text and links, bookmark ayahs with notes, and export charts (PNG) and data
  (CSV) for study notes.

## Capabilities and Constraints

- Static app, no backend: a Python ETL builds compact JSON into `public/data/`; data files are
  never hand-edited.
- Views today: Dashboard (11 charts), Browse (surah/juz/manzil, timeline), Structure (8 division
  views incl. similar ayahs), Compare (translations side by side), plus a reader, global search,
  bookmarks and settings.
- Reader: 7 scopes, translations (100+ editions), Indonesian and Arabic tafsir, tajweed colouring,
  word-by-word (EN/ID), themes, asbab, local per-ayah audio (Shuraym first).
- All UI strings exist in both `src/i18n/id.ts` and `en.ts`; numbers go through `n()`.
- Must work offline on Android: fonts and assets ship with the app.
- Undecided: whether the standard Madinah mushaf font (KFGQPC Uthmanic Hafs) can be bundled
  (source and licence to confirm).

## Brand Commitments

- Name: "Al-Qur'an — Visualisasi Data" (ID) / quran-viz.
- Qur'anic Arabic is shown faithfully and never decorated, cropped mid-ayah or used as ornament.
- Differences of scholarly opinion (e.g. Makkiyah/Madaniyah of specific ayahs) are stated, not
  hidden.

## Evidence on Hand

- Real corpus data in `public/data/` (114 surahs, 6,236 ayahs, 82,008 words) and the build
  sources in `../reference/`.
- No testimonials, user counts or endorsements exist; do not invent any.

## Product Principles

1. Every view leads to the ayah, and every ayah leads to its context.
2. Structure is information: divisions, markers and colours always mean something in the mushaf.
3. The Qur'anic text is the most important thing on any screen it appears on.
4. Indonesian learners first; plain language over jargon, with Arabic terms explained.
5. Works the same offline on a phone as on a desktop.

## Accessibility & Inclusion

WCAG 2.2 AA as the floor. Arabic is marked `lang="ar"` so screen readers (TalkBack) use an Arabic
voice; charts need a non-visual alternative; touch targets suit phone use; reduced motion is
respected.
