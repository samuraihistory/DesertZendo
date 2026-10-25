# Nhat Hanh November

A 30-day practice companion for a happier, healthier November, inspired by
the everyday mindfulness Thich Nhat Hanh taught in the 1990s and 2000s:
breathing, walking, eating, listening, and resting with full attention.

Independent and unaffiliated: all practice text is original, the bell is
synthesized in the browser, and sutta links go to public-domain (CC0)
translations. See [DATASETS.md](DATASETS.md) for sources and licensing notes.

No build step or dependencies — plain HTML/CSS/JS, like the ango tracker in
the repo root.

## Running it

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/nhat-hanh-november/`. Opening `index.html`
directly also works.

## Features

- **Today**: a theme for each of the 30 days (practice plus evening diary
  prompt), a practice checklist, meditation minutes, mood, diary, gratitude,
  and an intention for tomorrow. Saves as you type.
- **Meals**: log each meal with hunger and fullness, plus plant-based,
  paused-before-eating, no-screens, and ate-slowly flags.
- **Sit**: meditation timer with opening, interval and closing bells, an
  optional breathing guide, and a walking-session mode. Finished sessions
  are logged automatically.
- **Bell**: a bell you can sound on demand, or set to ring at varied
  intervals during your chosen hours while the page is open.
- **Calendar**: the month at a glance, showing which days have diary, meals
  and meditation, new and full moon days, and US Thanksgiving.
- **Month**: totals, streaks, practice completion, diary export (`.md`),
  JSON backup and restore, and the year setting.

Data lives only in this browser's `localStorage`. Use **Month → Export data**
to back it up.
