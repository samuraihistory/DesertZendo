#!/usr/bin/env python3
"""Build readings.js: one early-Buddhist reading per day of November.

Passages come from SuttaCentral's bilara-data (Bhikkhu Sujato's English
translations, dedicated to the public domain under CC0). The output is a
static JS file, so the app needs no network access at runtime.

Usage:
    python3 tools/build_readings.py            # from desert-zendo-november/

Each entry in DAYS is (uid, file path under translation/en/sujato/sutta,
list of ranges[, (citation, title)]). The optional pair overrides the
headings read from the file, for texts filed inside a larger chapter. A range is (first_segment, last_segment, is_verse); the
segment ids are the ones SuttaCentral uses, and both ends are inclusive.
Separate ranges are joined with an ellipsis.
"""

import json
import os
import re
import sys
import urllib.request

BASE = "https://raw.githubusercontent.com/suttacentral/bilara-data/published/translation/en/sujato/sutta/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "readings.js")

PROSE, VERSE = False, True

DAYS = [
    # 1 Arriving in the breath
    ("mn118", "mn/mn118", [("mn118:17.2", "mn118:18.2", PROSE)]),
    # 2 Walking without a destination
    ("an5.29", "an/an5/an5.29", [("an5.29:1.1", "an5.29:1.4", PROSE)]),
    # 3 Dishes for their own sake
    ("mn10", "mn/mn10", [("mn10:8.1", "mn10:8.1", PROSE)]),
    # 4 One piece of fruit
    ("sn3.13", "sn/sn3/sn3.13", [("sn3.13:1.2", "sn3.13:2.1", PROSE), ("sn3.13:3.1", "sn3.13:3.4", VERSE)]),
    # 5 A cup of tea
    ("dhp197-208", "kn/dhp/dhp197-208", [("dhp200:1", "dhp200:4", VERSE), ("dhp204:1", "dhp204:4", VERSE)],
     ("Sayings of the Dhamma 200, 204", "Happiness")),
    # 6 A small smile
    ("sn1.10", "sn/sn1/sn1.10", [("sn1.10:2.1", "sn1.10:3.4", VERSE)]),
    # 7 The phone as a bell
    ("sn47.20", "sn/sn47/sn47.20", [("sn47.20:2.1", "sn47.20:2.10", PROSE), ("sn47.20:3.3", "sn47.20:3.3", PROSE)]),
    # 8 Total relaxation
    ("mn39", "mn/mn39", [("mn39:15.3", "mn39:15.5", PROSE)]),
    # 9 Holding a hard feeling
    ("sn36.6", "sn/sn36/sn36.6", [("sn36.6:1.5", "sn36.6:1.10", PROSE), ("sn36.6:2.1", "sn36.6:3.3", PROSE)]),
    # 10 Listening all the way
    ("mn128", "mn/mn128", [("mn128:11.1", "mn128:11.1", PROSE), ("mn128:12.1", "mn128:12.10", PROSE)]),
    # 11 Kind, true speech
    ("an5.198", "an/an5/an5.198", [("an5.198:1.1", "an5.198:1.4", PROSE)]),
    # 12 What is your breakfast made of?
    ("sn12.21", "sn/sn12/sn12.21", [("sn12.21:1.8", "sn12.21:1.9", PROSE)]),
    # 13 Everything changes
    ("an5.57", "an/an5/an5.57", [("an5.57:1.1", "an5.57:1.9", PROSE)]),
    # 14 Only this moment
    ("mn131", "mn/mn131", [("mn131:3.1", "mn131:3.10", VERSE)]),
    # 15 An unscheduled day
    ("thag1.1", "kn/thag/thag1.1", [("thag1.1:4.1", "thag1.1:4.4", VERSE)]),
    # 16 Ancestors in your hands
    ("an2.32-41", "an/an2/an2.32-41", [("an2.33:1.1", "an2.33:1.3", PROSE), ("an2.33:1.8", "an2.33:1.8", PROSE)],
     ("Numbered Discourses 2.33", "Mother and Father")),
    # 17 A tree for a teacher
    ("thag1.13", "kn/thag/thag1.13", [("thag1.13:1.1", "thag1.13:1.4", VERSE)]),
    # 18 Red lights as reminders
    ("sn47.19", "sn/sn47/sn47.19", [("sn47.19:2.2", "sn47.19:3.5", PROSE)]),
    # 19 A full-hearted hug
    ("sn3.8", "sn/sn3/sn3.8", [("sn3.8:1.4", "sn3.8:1.7", PROSE), ("sn3.8:4.1", "sn3.8:4.4", VERSE)]),
    # 20 What grows from difficulty
    ("thig5.10", "kn/thig/thig5.10", [("thig5.10:3.1", "thig5.10:5.4", VERSE)]),
    # 21 Careful consumption
    ("sn12.11", "sn/sn12/sn12.11", [("sn12.11:1.3", "sn12.11:1.6", PROSE)]),
    # 22 Wishing others well
    ("snp1.8", "kn/snp/vagga1/snp1.8", [("snp1.8:3.3", "snp1.8:8.4", VERSE)]),
    # 23 Starting over
    ("mn61", "mn/mn61", [("mn61:8.1", "mn61:9.9", PROSE)]),
    # 24 One thing at a time
    ("ud1.10", "kn/ud/vagga1/ud1.10", [("ud1.10:8.1", "ud1.10:8.3", PROSE), ("ud1.10:8.10", "ud1.10:8.10", PROSE)]),
    # 25 Sitting just to sit
    ("mn118", "mn/mn118", [("mn118:17.1", "mn118:17.2", PROSE)]),
    # 26 Work as practice
    ("an8.54", "an/an8/an8.54", [("an8.54:2.4", "an8.54:2.8", PROSE)]),
    # 27 A gratitude meal
    ("an2.32-41", "an/an2/an2.32-41", [("an2.32:2.5", "an2.32:2.7", PROSE)],
     ("Numbered Discourses 2.32", "Gratitude")),
    # 28 Joy is a practice too
    ("mn118", "mn/mn118", [("mn118:19.1", "mn118:19.2", PROSE), ("mn118:20.2", "mn118:20.2", PROSE)]),
    # 29 An island of yourself
    ("sn22.43", "sn/sn22/sn22.43", [("sn22.43:1.2", "sn22.43:1.2", PROSE)]),
    # 30 Continuation
    ("dn16", "dn/dn16", [("dn16:6.7.1", "dn16:6.7.4", PROSE)]),
]


def fetch(path, cache):
    if path not in cache:
        url = f"{BASE}{path}_translation-en-sujato.json"
        with urllib.request.urlopen(url) as resp:
            cache[path] = json.load(resp)
    return cache[path]


def clean(text):
    # "<j>" marks a verse line join in bilara; it carries no meaning here.
    return re.sub(r"\s+", " ", text.replace("<j>", "")).strip()


def paragraph_key(seg_id):
    # "mn118:18.2" -> "mn118:18", "dhp200:3" -> "dhp200"
    uid, num = seg_id.split(":")
    return f"{uid}:{num.rsplit('.', 1)[0]}" if "." in num else uid


def extract(segments, first, last, verse):
    ids = list(segments)
    if first not in segments or last not in segments:
        sys.exit(f"segment range {first}–{last} not found")
    chosen = ids[ids.index(first): ids.index(last) + 1]
    paragraphs = []
    current_key = None
    for seg_id in chosen:
        text = clean(segments[seg_id])
        if seg_id == last:
            # Drop a trailing lead-in ("That is:") to text we didn't take.
            text = re.sub(r"(?<=[.!?’”])\s+[^.!?]*:$", "", text)
        if not text:
            continue
        key = paragraph_key(seg_id)
        if key != current_key:
            paragraphs.append([])
            current_key = key
        paragraphs[-1].append(text)
    joiner = "\n" if verse else " "
    blocks = [{"verse": verse, "text": joiner.join(lines)} for lines in paragraphs]
    balance_quotes(blocks)
    return blocks


def balance_quotes(blocks):
    # An excerpt that starts or ends mid-speech leaves a quote unopened or
    # unclosed; add the missing mark at the start or end.
    depth = 0
    unopened = 0
    for ch in "".join(b["text"] for b in blocks):
        if ch == "“":
            depth += 1
        elif ch == "”":
            if depth:
                depth -= 1
            else:
                unopened += 1
    if unopened:
        blocks[0]["text"] = "“" + blocks[0]["text"]
    if depth:
        blocks[-1]["text"] += "”"


def title_of(segments, uid):
    # The last ":0.x" heading is the discourse's own title; the first names
    # the collection, e.g. "Middle Discourses 118".
    headings = [clean(v) for k, v in segments.items() if k.startswith(uid.split("-")[0] + ":0.") and clean(v)]
    return headings[-1], headings[0]


def main():
    cache = {}
    readings = []
    for uid, path, ranges, *override in DAYS:
        segments = fetch(path, cache)
        title, collection = title_of(segments, uid)
        if override:
            collection, title = override[0]
        blocks = []
        for i, (first, last, verse) in enumerate(ranges):
            if i:
                blocks.append({"verse": False, "text": "…"})
            blocks.extend(extract(segments, first, last, verse))
        readings.append({
            "title": title,
            "collection": collection,
            "url": f"https://suttacentral.net/{uid}/en/sujato",
            "blocks": blocks,
        })

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// Generated by tools/build_readings.py — do not edit by hand.\n")
        f.write("// Translations by Bhikkhu Sujato, from SuttaCentral bilara-data,\n")
        f.write("// dedicated to the public domain (CC0 1.0).\n")
        f.write("window.NHN_READINGS = ")
        json.dump(readings, f, ensure_ascii=False, indent=1)
        f.write(";\n")
    print(f"wrote {len(readings)} readings to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
