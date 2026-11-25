# Memorisation scheduling

## A page is a card

The unit of review is a page of the Madinah mushaf. Each page you have memorised has a review record in `qv.hifdh`:

- `s`, its **stability**: the number of days until the chance of still knowing it falls to 90%.
- `d`, its **difficulty**, from 1 to 10.
- `last`, the day it was last reviewed.
- `due`, when it is next due.

The three answers map onto FSRS grades: Forgot is *Again* (1), Hard is *Hard* (2), and Smooth is *Good* (3). There is no *Easy*.

## FSRS

The scheduler is FSRS-6, the one Anki uses. `src/lib/hifdh.ts` ports the formulas from fsrs-rs 6.6.2 (`model.rs`) with its 21 default parameters. `hifdh.test.ts` replays fsrs-rs's own memory-state test to show the port gives the same numbers.

The chance of recalling a page `t` days after its last review is

```text
R(t) = (1 + F · t / S) ^ −w₂₀        where F = 0.9 ^ (1 / −w₂₀) − 1
```

so R is exactly 90% when `t = S`. A review updates S and D:

- **First review:** S and D start from the grade.
- **Smooth or hard:** stability grows, by more when the page was nearly forgotten (a low R), when it is easy (a low D), and when S is still small. Hard grows it less.
- **Forgot:** stability drops to a fraction of what it was.
- **The same day:** a second review on one day uses FSRS's short-term formula.
- **Difficulty** moves with the grade and drifts back toward a default.

The next interval is where R falls to your recall target:

```text
interval = S / F · (target ^ (1 / −w₂₀) − 1)
```

It is at least one day, and at most 180, so every page comes back at least twice a year.

## Spreading the reviews

If you rate a whole juz in one sitting, all its pages would fall due on one day. Two things from Anki prevent that:

- **Fuzz** (`fuzzRange`, from Anki's `fuzz.rs`) widens each interval into a range: none under 2.5 days, then a day plus 15%, 10% and 5% of the days in each band.
- **The load balancer** puts each page on the day in that range with the fewest reviews already due. Anki picks among good days at random; this one is deterministic, so the same history always gives the same plan.

## The daily plan

`todaysPlan` gives three lists:

- **New:** pages with ayahs you are memorising.
- **Recent:** due pages whose last two reviews were a week or less apart.
- **Older:** the other due pages. They are sorted by the lowest chance of recall first, as Anki orders FSRS reviews, and cut to "Older pages a day".

## The review history

Every rating is also stored as `[page, grade, time]` in `qv.hifdh.log` (`src/lib/reviewLog.ts`). It is kept apart from the main memorisation data so that stays small: a few bytes a review, under a megabyte after years. The progress card's "last 30 days" line comes from it. It also merges cleanly when two devices sync, since a union of ratings loses nothing.

## How accurate it is

The maths matches Anki's. How well it fits Qur'an memorisation is a different question:

- The default parameters were fitted to the reviews of many Anki users, and reciting a page isn't a flashcard.
- In hifdh, "remembered" means near flawless. That is why the recall target goes up to 97%, at the cost of more reviews.

The review history is what will let the parameters be fitted to your own memory once there are months of it. fsrs-rs's optimiser could run on it, compiled to WebAssembly. That isn't built yet, and neither are Anki's leech tagging and easy days.
