# Datasets and sources

Research notes for Desert Zendo November: what open data the app can build on,
and what to keep out so the app stays independent of Plum Village's
intellectual property. This is practical guidance, not legal advice.

## Content guidelines

**Fine to use**

- **Ideas and practices.** Copyright covers expression, not ideas. You can
  build features around mindful breathing, walking meditation, eating
  meditation, a bell that invites you to pause, deep relaxation, and similar
  practices, as long as you describe them in your own words. Most of them are
  older than Thich Nhat Hanh anyway; they come from the early Buddhist
  discourses below.
- **Facts about his life** (dates, places, books published). Facts can't be
  copyrighted.
- **Early Buddhist texts in public-domain or CC0 translations** (see below).
- **Short title-and-author references** to his books in a reading list, e.g.
  *Peace Is Every Step* (1991), *Present Moment Wonderful Moment* (1990),
  *Touching Peace* (1992), *Living Buddha, Living Christ* (1995), *The Heart of
  the Buddha's Teaching* (1998), *Anger* (2001), *No Death, No Fear* (2002).
  These are all from the 1990s–2000s period you're focusing on.

**Keep out**

- **Text from his books, talks, or dharma-talk transcripts**, including the
  short verses (gathas) for waking up, washing, eating and inviting the bell.
  These are under copyright, held by Plum Village / the Unified Buddhist
  Church and his publishers (Parallax Press and others). Don't paste them in,
  even as "daily quotes."
- **Plum Village's wording of the Five Mindfulness Trainings** and the
  Fourteen Trainings of the Order of Interbeing. Their phrasing is
  copyrighted. The five precepts as found in the Pali canon are public
  domain, so use those (via a CC0 translation) if you want precepts in the
  app.
- **Plum Village app assets**: their bell recordings, guided meditations,
  artwork, calligraphy, and the names "Plum Village" or "Bell of
  Mindfulness" as feature names. This app synthesizes its own bell sound in
  the browser and calls the feature "Bell."
- **His calligraphy, photographs, and the Plum Village logo.** You'd need a
  license for each photo; for calligraphy, licensing goes through Plum
  Village.
- **Signature coinages as branding.** Words like "interbeing," "lazy day,"
  "beginning anew," and "no mud, no lotus" are idea-level and mostly not
  protected, but they read as Plum Village vocabulary. The app uses plain
  descriptions instead ("an unscheduled day," "starting over," "what grows
  from difficulty").
- **His name.** The app was first called "Nhat Hanh November"; it is now
  "Desert Zendo November", so his name appears only as a credited
  inspiration in the About text. Keep it that way, and keep the "not
  affiliated" disclaimer (it's on the Month tab).

## Datasets

### Texts: early Buddhist discourses

| Source | What | License | Use in app |
|---|---|---|---|
| [SuttaCentral bilara-data](https://github.com/suttacentral/bilara-data) | Pali canon, segmented JSON, with Bhikkhu Sujato's English translations | **CC0**: the repo's LICENSE.md says all Bilara translations are dedicated to the public domain | **In use.** `tools/build_readings.py` pulls one passage per day into `readings.js`, so readings work offline. Edit the `DAYS` list and re-run it to change a passage |
| Access to Insight (Thanissaro Bhikkhu translations) | Widely used English suttas | **CC BY-NC 4.0**: non-commercial only | Avoid if you might ever charge for the app |

These are the discourses TNH wrote his own commentaries on in this period.
His commentaries are copyrighted, but the sutta texts aren't, so the app can
go back to the same sources.

### Zen sayings

The daily "Zen word" (`zen.js`) draws on classical Chinese, Japanese and
Vietnamese Zen: Linji, Zhaozhou, Yunmen, the *Gateless Barrier* and *Blue
Cliff Record*, Huineng, Dōgen, Hakuin, Ryōkan, Bashō, and Trần Nhân Tông,
founder of the Vietnamese Trúc Lâm school. Thich Nhat Hanh was ordained in
the Vietnamese Lâm Tế (Linji) line, so these are his roots.

| Source | License | Notes |
|---|---|---|
| Original texts (Chinese, Japanese, literary Chinese read in Vietnamese) | Public domain: all are centuries old | Shown in the original with a reading for Japanese and Vietnamese |
| English renderings | Written for this app | Published English translations (Cleary, Sekida, Aitken, Watson, etc.) are under copyright, so none are used |
| [CBETA](https://cbeta.org) | Free for non-commercial use; check terms before commercial use | Digital Chinese Buddhist canon, useful for checking the originals or finding more |
| Wikisource (zh / ja / vi) | Originals are public domain | Plain texts of the *Gateless Barrier*, *Faith in Mind*, Hakuin's *Song in Praise of Zazen*, and *Cư trần lạc đạo phú* |

### Meals

| Source | What | License | Use in app |
|---|---|---|---|
| [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets) | Nutrients for whole foods (Foundation Foods, SR Legacy), CSV/JSON + free API | **CC0 / US public domain** (credit requested) | Autocomplete for the meal tracker; optional nutrient view |
| [Open Food Facts](https://world.openfoodfacts.org/data) | Packaged products, ingredients, vegan/vegetarian flags | ODbL (database) — share-alike if you redistribute the data | Barcode lookup; "is this plant-based?" |
| Seasonal produce lists (USDA SNAP-Ed Seasonal Produce Guide) | What's in season in November | US government work, public domain | "Eat with the season" suggestions |

The 1990s–2000s practice centered on vegetarian, simple, silent, grateful
eating. The tracker's "plant-based" and "paused before eating" flags cover
that without prescribing a diet.

### Calendar and time

| Source | What | License | Use in app |
|---|---|---|---|
| Computed in-app | New/full moon days (mean synodic month), US Thanksgiving | — | Already in the calendar. Many Buddhist communities hold extra practice on new and full moon days |
| [US Naval Observatory API](https://aa.usno.navy.mil/data/api) | Exact moon phase times, sunrise/sunset | US government work, public domain | Upgrade from approximate moon days; sunrise/sunset bell times |
| Wikidata | Dates for his life and books (born 11 Oct 1926, died 22 Jan 2022) | CC0 | An optional "this day in his life" note |

### Sound

| Source | What | License | Use in app |
|---|---|---|---|
| Web Audio synthesis (in app) | Singing-bowl tone built from inharmonic partials | Original code | Current bell. No licensing questions |
| [Freesound](https://freesound.org) filtered to CC0 | Real recorded bowls and temple bells | Check each file. Filter for CC0 to avoid attribution and non-commercial terms | Optional "recorded bell" choice |

### Wellbeing measures (optional, for the Month view)

| Source | What | License |
|---|---|---|
| WHO-5 Well-Being Index | 5-question wellbeing check | Free to use with attribution (WHO / Psychiatric Research Unit) |
| PHQ-4 | Brief anxiety/depression screen | Free to use. If you include it, add a note pointing to professional help |

A WHO-5 check on Nov 1 and Nov 30 would give a simple before/after
for the "happier, healthier November" goal.
