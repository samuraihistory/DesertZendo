# Desert Zendo — Ango Tracker

A single-page app for tracking a 90-day home ango (Zen practice period): daily
zazen minutes, a practice checklist (kinhin, study, samu, liturgy, precepts
reflection), and a journal entry per day. Includes a day counter, streaks,
an end-of-ango summary, and journal export.

No build step or dependencies — it's plain HTML/CSS/JS.

## Running it

Data is stored in the browser via `localStorage`, scoped to how the page is
served, so open it the same way each time.

**Option A — open directly:**

```
open index.html
```

(or double-click `index.html` in a file browser)

**Option B — local server (recommended, avoids `file://` quirks in some browsers):**

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Usage

1. **Settings** — set your ango start date and length (defaults to 90 days).
2. **Today** — log zazen minutes/sessions, check off practices, write a
   reflection. Pick a different date to log or edit a past day.
3. **History** — browse and click into any logged day.
4. **Summary** — totals, current/longest streak, per-practice completion
   rates, and a journal export (`.md`).
5. **Settings → Backup** — export all data to a JSON file for safekeeping,
   or import a previous export. Data lives only in this browser, so back it
   up if you clear site data or switch devices/browsers.
