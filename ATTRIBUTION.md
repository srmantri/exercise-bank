# Attribution

## Exercise photographs and instructions

All exercise photographs in `img/` and the step-by-step text in the `instructions`
field of `data/movements.json` come from:

**[free-exercise-db](https://github.com/yuhonas/free-exercise-db)** — an open public-domain
exercise dataset, released under **[The Unlicense](https://unlicense.org/)**.

The Unlicense is a public-domain dedication, which permits redistribution and
modification for any purpose. The files are vendored into this repository rather than
hot-linked, because `raw.githubusercontent.com` is not a production CDN and offline
caching requires same-origin assets.

`tools/fetch_images.py` records exactly which dataset ids were pulled and can reproduce
the download.

### Where a photo shows a variation

Four movements in this bank are performed differently from the photo available in the
dataset. Each carries a visible `note` badge in the app rather than being silently
mismatched:

| Movement | Photo shows | What you actually do |
|---|---|---|
| Goblet squat | a kettlebell | hold a dumbbell vertically against the chest |
| DB hip thrust | a barbell | rest a single dumbbell across the hips |
| Band lat pulldown | a cable machine | anchor a band high on a door or beam |
| Suitcase carry | a two-handed farmer's walk | carry one dumbbell, one side at a time |

### Movements with no photo

The four mobility drills (90/90 hip switches, thoracic rotations, ankle rocks,
hamstring stretch) have no match in the dataset and are shown as text-only cards.
No imagery was invented for them.

## Everything else

The application code (`index.html`, `styles.css`, `app.js`, `sw.js`), the session
prescriptions in `data/sessions.json`, and the coaching cues in `data/movements.json`
are original to this repository.
