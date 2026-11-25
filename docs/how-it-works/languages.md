# Languages

The interface is in English and Indonesian. Indonesian is the default for an Indonesian browser. Arabic appears only as Qur'anic text and names.

## Strings

Every interface string is in `src/i18n/en.ts`, and the same key is in `src/i18n/id.ts`. The `Messages` type comes from the English file, so a string missing from the Indonesian one is a type error. Strings that take values are functions:

```ts
progressCount: (done: string, total: string) => `${done} of ${total} ayahs`,
```

In a component, `const { t, n } = useI18n()` gives the strings and `n()`, which formats a number for the current language. Pass numbers through `n()` before they go into a string.

To add a string, add it to both files next to its neighbours, in the product's plain language. Name things the way a learner knows them, not the way the code does.

## What follows the language

- Surah names: `nameEn` uses quran.com's spelling ("Al-Fatihah"), `nameId` equran.id's ("Al-Insyirah"). `App` sets `name` to the right one.
- Transliteration.
- Section themes and the surah information.
- Word meanings default to the interface language until you choose one in the reader.

## Arabic

Every Arabic node carries `lang="ar"` and `dir="rtl"`, so screen readers use an Arabic voice and the text lays out right to left inside a left-to-right interface. The Qur'anic text is never cut mid-ayah, decorated, or used as ornament.

These docs are in English for now.
