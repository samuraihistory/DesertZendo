# Desert Zendo November

*日日是好日 — Every day is a good day.*

A 30-day practice companion for a happier, healthier November. It draws on
the everyday mindfulness Thich Nhat Hanh taught in the 1990s and 2000s
(breathing, walking, eating, listening, and resting with full attention),
and on the Chan, Zen, Pure Land and Tibetan traditions. The motto is
Yunmen's.

Independent and unaffiliated: all practice text is original, the bell is
synthesized in the browser, daily readings are public-domain (CC0)
translations, and the Zen sayings are public-domain classics with English
renderings written for this app. See [DATASETS.md](DATASETS.md) for
sources and licensing notes.

No build step or dependencies — plain HTML/CSS/JS, like the ango tracker in
the repo root.

## Running it

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/desert-zendo-november/`. Opening `index.html`
directly also works.

## Features

- **Today**: a theme for each of the 30 days (practice plus evening diary
  prompt), a short early-Buddhist reading, a Zen word in the original
  language with an English rendering, a practice checklist, meditation
  minutes, mood, diary, gratitude, and an intention for tomorrow. Saves as you type.
- **Meals**: log each meal with hunger and fullness, plus plant-based,
  paused-before-eating, no-screens, and ate-slowly flags.
- **Sit**: meditation timer with zendo-style bells (three to begin, one to
  end) or a simpler one-and-two pattern. Sit several periods with kinhin
  between them: two bells start kinhin and one calls you back to sitting.
  Optional interval bells, a breathing guide, and a walking-session mode.
  Zazen and kinhin are logged separately.
- **Recite**: a nembutsu and mantra counter (Namu Amida Butsu, Namo
  Amituofo, Om Mani Padme Hum, or your own). Tap once per recitation; the
  ensō fills around once per mala round of 108 and a bell marks each round.
  A wooden-fish knock is optional, and the count can be hidden.
- **Bell**: a bell you can sound on demand, or set to ring at varied
  intervals during your chosen hours while the page is open.
- **Calendar**: the month at a glance, showing which days have diary, meals
  and meditation, new and full moon days, Hōonkō (November 21–28, the
  Ōtani-ha dates) and US Thanksgiving. On Hōonkō days the Today view
  explains the observance.
- **Month**: totals, streaks, practice completion, diary export (`.md`),
  JSON backup and restore, and the year setting.

## Your data

Everything is saved in the browser's `localStorage` as you go. When the app
is opened as a claude.ai Artifact, it is also saved to your claude.ai
account (a private per-person store on the page), so it follows you between
devices. Use **Month → Export data** for a backup file either way.

## Updating the readings

The daily readings are bundled in `readings.js`, so the app works offline.
The file is generated from SuttaCentral's
[bilara-data](https://github.com/suttacentral/bilara-data). To change a
passage, edit the `DAYS` list in `tools/build_readings.py` and run:

```
python3 tools/build_readings.py
```
