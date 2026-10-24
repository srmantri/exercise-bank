# -*- coding: utf-8 -*-
"""Builds data/movements.json (the bank) and data/sessions.json (this week's prescription).

The bank is stable. Weekly changes should touch SESSIONS only.
Run from the repo root:  python tools/build_data.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, "tools", "resolved.json"), encoding="utf-8") as f:
    RESOLVED = json.load(f)

# ── THE BANK ────────────────────────────────────────────────────────────────
# cue = the one thing that matters, in my words. The dataset's own step-by-step
# instructions are merged in verbatim as `instructions` for the expandable detail.
# note = shown as a visible badge wherever the photo differs from what you'll do.
BANK = [
    ("goblet-squat", "Goblet squat", "squat", "Goblet_Squat",
     "Heels down, knees tracking over the toes, chest up.",
     "Photo shows a kettlebell — hold a dumbbell vertically against your chest instead."),

    ("db-floor-press", "DB floor press", "push", "Dumbbell_Floor_Press",
     "Elbows at 45°, not flared. The floor limits the range — that's a feature right now.",
     None),

    ("db-romanian-deadlift", "DB Romanian deadlift", "hinge", "Stiff-Legged_Dumbbell_Deadlift",
     "Push the hips back, flat back. Felt in the hamstrings, never the lower back.",
     None),

    ("one-arm-db-row", "One-arm DB row", "pull", "One-Arm_Dumbbell_Row",
     "Brace on a bench or your knee. Pull to the hip, not the chest.",
     None),

    ("db-overhead-press", "DB overhead press", "push", "Dumbbell_Shoulder_Press",
     "Ribs down, don't arch. Use a band press if the DBs are too heavy to control.",
     None),

    ("plank", "Plank", "core", "Plank",
     "Squeeze the glutes. When the hips sag the set is over — that's the real rep count.",
     None),

    ("db-split-squat", "DB split squat", "squat", "Split_Squat_with_Dumbbells",
     "Back knee toward the floor, front shin vertical. Hold a wall if balance is the limiter.",
     None),

    ("pushup", "Push-up", "push", "Pushups",
     "Elevate your hands if ten clean reps aren't there yet. Clean reps only.",
     None),

    ("db-incline-press", "DB incline press", "push", "Incline_Dumbbell_Press",
     "The alternative to the push-up — same job, different angle. Pick one, not both.",
     None),

    ("db-hip-thrust", "DB hip thrust", "hinge", "Barbell_Hip_Thrust",
     "One-second pause at the top, ribs down. Don't hyperextend.",
     "Photo shows a barbell — rest a single dumbbell across your hips instead."),

    ("band-lat-pulldown", "Band lat pulldown", "pull", "One_Arm_Lat_Pulldown",
     "Pull the elbows down to the ribs, not the hands to the chest.",
     "Photo shows a cable machine — anchor a band high on a door or beam instead."),

    ("db-lateral-raise", "DB lateral raise", "push", "Side_Lateral_Raise",
     "Genuinely light. This is not a strength lift, it's shoulder health.",
     None),

    ("dead-bug", "Dead bug", "core", "Dead_Bug",
     "Lower back stays flat on the floor. That is the entire exercise.",
     None),

    ("suitcase-carry", "Suitcase carry", "carry", "Farmers_Walk",
     "Don't lean away from the weight. Walk tall and slow.",
     "Photo shows a two-handed farmer's walk — carry one dumbbell, one side at a time."),

    # Mobility drills — deliberately no photos. Nothing in the dataset matches these,
    # and inventing imagery would be worse than having none.
    ("hip-90-90", "90/90 hip switches", "mobility", None,
     "Sit tall and switch slowly. Go hands-free once you can.", None),
    ("thoracic-rotations", "Thoracic rotations", "mobility", None,
     "Rotate from the ribs, not the lower back.", None),
    ("ankle-rocks", "Ankle rocks", "mobility", None,
     "Heel glued to the floor, drive the knee forward over the toes.", None),
    ("hamstring-stretch", "Hamstring stretch", "mobility", None,
     "Breathe out into it. Don't bounce.", None),
]

movements = []
for mid, name, pattern, ds, cue, note in BANK:
    entry = {
        "id": mid, "name": name, "pattern": pattern, "cue": cue,
        "datasetId": ds, "note": note, "images": [], "instructions": [],
        "primaryMuscles": [], "equipment": None,
    }
    if ds:
        r = RESOLVED[ds]
        entry["images"] = r["images"]
        entry["instructions"] = r["instructions"]
        entry["primaryMuscles"] = r["primaryMuscles"]
        entry["equipment"] = r["equipment"]
    movements.append(entry)

# ── THIS WEEK'S PRESCRIPTION ────────────────────────────────────────────────
WARMUP = {"label": "Warm-up", "duration": "5 min",
          "detail": "Goblet squat x10 light · band pull-apart x15 · hip hinge x10 · "
                    "arm circles x20 each way."}

SESSIONS = [
    {"id": "strength-a", "day": "Mon 26 Oct", "name": "Strength A — full body",
     "kind": "strength", "duration": "40 min", "icon": "strength",
     "summary": "Session 1 of 4. Squat, hinge, push and pull in one go.",
     "items": [
         WARMUP,
         {"movement": "goblet-squat", "sets": 3, "reps": "10",
          "load": "A weight you could do 13 with", "restSec": 75},
         {"movement": "db-floor-press", "sets": 3, "reps": "10",
          "load": "Moderate", "restSec": 75},
         {"movement": "db-romanian-deadlift", "sets": 3, "reps": "10",
          "load": "Lighter than the squat", "restSec": 75},
         {"movement": "one-arm-db-row", "sets": 3, "reps": "10 each side",
          "load": "Your heaviest DB", "restSec": 60},
         {"movement": "db-overhead-press", "sets": 3, "reps": "10",
          "load": "Your lightest DB", "restSec": 60},
         {"movement": "plank", "sets": 3, "reps": "30 s", "holdSec": 30,
          "load": "Bodyweight", "restSec": 45},
         {"label": "Cool-down", "duration": "5 min",
          "detail": "Quad, hamstring and chest stretch, 30 s each."},
     ]},

    {"id": "run", "day": "Tue 27 Oct", "name": "Easy run — 3 km",
     "kind": "steps", "duration": "25 min", "icon": "run",
     "summary": "Session 2 of 4. The only run this week — and that's deliberate.",
     "items": [
         {"label": "Brisk walk", "duration": "5 min",
          "detail": "An actual warm-up, not a formality."},
         {"label": "Easy run", "duration": "3 km · ~18-20 min",
          "detail": "Conversational pace. If you can't talk, walk for 60 seconds. "
                    "Finish feeling you could comfortably do another kilometre."},
         {"label": "Walk + stretch", "duration": "5 min",
          "detail": "Calves, hip flexors, hamstrings."},
         {"label": "Why only one run", "duration": "",
          "detail": "Your aerobic base can handle more, but after three months off your "
                    "tendons can't. Cycling carries the cardio volume instead. Running "
                    "goes to 2x in week 3."},
     ]},

    {"id": "mobility", "day": "Wed 28 Oct", "name": "Mobility + walk",
     "kind": "mobility", "duration": "15-30 min", "icon": "mobility",
     "summary": "The session people skip. Don't — it's what makes Thursday possible.",
     "items": [
         {"label": "Walk", "duration": "20-30 min",
          "detail": "Easy, outdoors if you can. Counts toward the 8,000 steps."},
         {"movement": "hip-90-90", "prescription": "x10 each side"},
         {"movement": "thoracic-rotations", "prescription": "x10 each side"},
         {"movement": "ankle-rocks", "prescription": "x15 each side"},
         {"movement": "hamstring-stretch", "prescription": "45 s each side",
          "holdSec": 45, "sides": 2},
     ]},

    {"id": "strength-b", "day": "Thu 29 Oct", "name": "Strength B — full body",
     "kind": "strength", "duration": "40 min", "icon": "strength",
     "summary": "Session 3 of 4. Different exercises, same four patterns.",
     "items": [
         WARMUP,
         {"movement": "db-split-squat", "sets": 3, "reps": "8 each leg",
          "load": "Moderate", "restSec": 75},
         {"movement": "pushup", "sets": 3, "reps": "10",
          "load": "Bodyweight", "restSec": 75, "alt": "db-incline-press"},
         {"movement": "db-hip-thrust", "sets": 3, "reps": "12",
          "load": "Moderate-heavy", "restSec": 60},
         {"movement": "band-lat-pulldown", "sets": 3, "reps": "12",
          "load": "Moderate", "restSec": 60},
         {"movement": "db-lateral-raise", "sets": 3, "reps": "12",
          "load": "Light", "restSec": 45},
         {"movement": "dead-bug", "sets": 3, "reps": "8 each side",
          "load": "Bodyweight", "restSec": 45},
         {"movement": "suitcase-carry", "sets": 2, "reps": "30 m each side",
          "load": "Heaviest DB", "restSec": 60},
         {"label": "Cool-down", "duration": "5 min",
          "detail": "Hip flexors, lats, calves."},
     ]},

    {"id": "cycle", "day": "Fri 30 Oct", "name": "Cycle — Zone 2",
     "kind": "steps", "duration": "35-40 min", "icon": "cycle",
     "summary": "Session 4 of 4. This completes the week.",
     "items": [
         {"label": "Spin easy", "duration": "10 min",
          "detail": "Build in gradually, no hard start."},
         {"label": "Steady Zone 2", "duration": "20-25 min",
          "detail": "Cadence 80-90, nose-breathing pace. You should be able to hold a "
                    "conversation the whole way. If you can't, you're going too hard — "
                    "which defeats the point of the session."},
         {"label": "Spin down", "duration": "5 min",
          "detail": "Legs loose, breathing back to normal."},
     ]},

    {"id": "long-easy", "day": "Sat 31 Oct", "name": "Long easy — cycle or hike",
     "kind": "steps", "duration": "45-60 min", "icon": "cycle",
     "summary": "Optional 5th session. Skipping it still leaves a complete week.",
     "items": [
         {"label": "⚠️ Train to Secunderabad leaves KSR at 20:00", "duration": "",
          "detail": "Do this in the morning or early afternoon, not the evening. A long "
                    "easy session is a good call before an overnight train — it helps you "
                    "sleep in a berth. A hard one would do the opposite."},
         {"label": "Cycle or hike", "duration": "45-60 min",
          "detail": "Easy throughout. Pick whichever you'll actually enjoy — that's the "
                    "selection criterion this week. NOT a second run."},
         {"label": "Log it twice", "duration": "",
          "detail": "Counts for Happiness as well as Health — outdoor hours go in Weekly "
                    "Log column Q."},
     ]},

    {"id": "review", "day": "Sun 1 Nov", "name": "Rest + weekly review",
     "kind": "steps", "duration": "15 min", "icon": "review",
     "summary": "The 15 minutes that make the whole system work.",
     "items": [
         {"label": "You arrive at 07:00", "duration": "",
          "detail": "After a night in a berth, so today is a genuine rest day. Log your "
                    "sleep honestly — a bad night on a train is data, not a failure."},
         {"label": "Fill the Weekly Log", "duration": "5 min",
          "detail": "Row w/c 26-Oct: column D = 4 (or 5 with Saturday), column E = 2. "
                    "That is a COMPLETE week, not a shortfall — the ramp reaches 5 "
                    "sessions in week 3."},
         {"label": "Next week's card", "duration": "5 min",
          "detail": "Three commitments on a fresh A5 card."},
         {"label": "Journal page", "duration": "5 min",
          "detail": "What worked, what didn't, one gratitude."},
         {"label": "Week 2 (w/c 2 Nov)", "duration": "",
          "detail": "Same exercises, but add one set to the first two lifts in each "
                    "strength session, and take the run to 3.5 km."},
     ]},
]

WEEK = {
    "label": "Week 1 of 4",
    "commencing": "w/c 26 Oct 2026",
    "rule": "Every set stops 3 reps short of failure.",
    "ruleWhy": "The cost of going too hard in week 1 isn't soreness — it's the session you "
               "skip in week 2.",
}

os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
with open(os.path.join(ROOT, "data", "movements.json"), "w", encoding="utf-8") as f:
    json.dump({"movements": movements}, f, indent=2, ensure_ascii=False)
with open(os.path.join(ROOT, "data", "sessions.json"), "w", encoding="utf-8") as f:
    json.dump({"week": WEEK, "sessions": SESSIONS}, f, indent=2, ensure_ascii=False)

# ── integrity checks ───────────────────────────────────────────────────────
import re

ids = {m["id"] for m in movements}
problems = []
for s in SESSIONS:
    for it in s["items"]:
        mv = it.get("movement")
        if mv and mv not in ids:
            problems.append("session %s references unknown movement %r" % (s["id"], mv))
        # a work timer must agree with the number the card displays, or the app
        # would count down something different from what you're told to do
        if it.get("holdSec"):
            shown = it.get("reps") or it.get("prescription") or ""
            nums = [int(n) for n in re.findall(r"\d+", shown)]
            if it["holdSec"] not in nums:
                problems.append("%s/%s: holdSec=%s not found in displayed %r"
                                % (s["id"], mv, it["holdSec"], shown))
            if it.get("sides", 1) == 2 and "each side" not in shown:
                problems.append("%s/%s: sides=2 but %r doesn't say 'each side'"
                                % (s["id"], mv, shown))
for m in movements:
    if m["datasetId"] and len(m["images"]) < 2:
        problems.append("%s has %d images" % (m["id"], len(m["images"])))
    for p in m["images"]:
        if not os.path.exists(os.path.join(ROOT, p)):
            problems.append("%s missing on disk: %s" % (m["id"], p))

print("movements: %d (%d with photos, %d text-only)" % (
    len(movements), sum(1 for m in movements if m["images"]),
    sum(1 for m in movements if not m["images"])))
print("sessions:  %d" % len(SESSIONS))
print("substitution notes: %d" % sum(1 for m in movements if m["note"]))
if problems:
    print("\nPROBLEMS:")
    for p in problems:
        print("  -", p)
    raise SystemExit(1)
print("all references resolve, all images present")
