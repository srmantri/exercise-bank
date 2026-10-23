# Exercise Bank

A session reference and guided timer for a return-to-training block. Static site, no build
step, no dependencies. Opens on a phone, works offline, counts the sets.

**Live:** https://srmantri.github.io/exercise-bank/

## Why it exists

The training sessions used to live as plain text in a calendar event. That works only if you
already know every movement, and nothing counts you through the sets. This shows the movement
and runs the clock.

## How it's put together

Two data files, deliberately separated:

| File | What it holds | How often it changes |
|---|---|---|
| `data/movements.json` | **the bank** — each movement, its cue, its photos, its full instructions | rarely |
| `data/sessions.json` | **the prescription** — sets, reps, load, rest for *this* week | weekly |

A weekly update touches `sessions.json` only. The bank stays stable. This mirrors the
one-data-entry-point rule the rest of the system runs on.

### Movement demonstration

Each movement shows its start and end photo crossfading in a loop, which reads as the
movement itself. There is no video — see [ATTRIBUTION.md](ATTRIBUTION.md) for the source and
licensing of the photographs, and for the four movements whose photo shows a variation of what
you actually do.

### Guided mode

Full-screen: movement, set counter, target reps, the cue. "Set done" starts a rest countdown
with a progress ring and a beep at 3-2-1-0, then auto-advances. Rest length comes from
`restSec` in the prescription, so the timer always matches the plan.

The countdown is computed from a wall-clock deadline (`Date.now()`), never by accumulating
interval ticks — a timer that drifts is worse than no timer.

### Working weights

Tap the kg field during a set and it's remembered per movement in `localStorage`, shown as
"Last: 12 kg · 26 Oct" next time. Every read and write is guarded, so the app renders
correctly in a private window or with site data blocked.

## Regenerating the data

```bash
python tools/fetch_images.py    # pull metadata + photos into img/  (writes tools/resolved.json)
python tools/build_data.py      # merge with the hand-written cues -> data/*.json
```

`build_data.py` fails loudly if a session references an unknown movement or a photo is
missing from disk, which is what stops a broken card reaching you on a Monday morning.

## Running it locally

```bash
python -m http.server 8080
# then http://localhost:8080  (or http://<your-lan-ip>:8080 from the phone)
```

A service worker only registers over https or on localhost, so offline behaviour has to be
tested on one of those, not over a LAN IP.

## Deployment

GitHub Pages, from `main`, `/` root. `.nojekyll` is present so paths beginning with an
underscore would still be served.

## Contents

This repository holds exercise names, coaching cues, public-domain photographs and the app
code. Nothing else — no personal, financial or health data of any kind.
