# -*- coding: utf-8 -*-
"""One-off: pull exercise metadata + the two demo photos for each movement in the bank.

Source: https://github.com/yuhonas/free-exercise-db  (Unlicense / public domain)
Run from the repo root:  python tools/fetch_images.py
"""
import json
import os
import sys
import urllib.request

RAW = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "img")

# dataset ids used by the bank — all verified to resolve before writing this list
IDS = [
    "Goblet_Squat", "Dumbbell_Floor_Press", "Stiff-Legged_Dumbbell_Deadlift",
    "One-Arm_Dumbbell_Row", "Dumbbell_Shoulder_Press", "Plank",
    "Split_Squat_with_Dumbbells", "Pushups", "Incline_Dumbbell_Press",
    "Barbell_Hip_Thrust", "One_Arm_Lat_Pulldown", "Side_Lateral_Raise",
    "Dead_Bug", "Farmers_Walk",
]

JPEG_MAGIC = b"\xff\xd8\xff"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "exercise-bank/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    resolved, failures = {}, []

    for eid in IDS:
        try:
            meta = json.loads(get("%s/%s.json" % (RAW, eid)).decode("utf-8"))
        except Exception as e:
            failures.append("%s: metadata (%s)" % (eid, e))
            continue

        os.makedirs(os.path.join(IMG, eid), exist_ok=True)
        saved = []
        # the dataset's images array is authoritative — don't assume 0.jpg/1.jpg
        for rel in meta.get("images", []):
            fname = os.path.basename(rel)
            dest = os.path.join(IMG, eid, fname)
            try:
                blob = get("%s/%s" % (RAW, rel))
            except Exception as e:
                failures.append("%s/%s: download (%s)" % (eid, fname, e))
                continue
            if not blob.startswith(JPEG_MAGIC):
                failures.append("%s/%s: not a JPEG (%d bytes)" % (eid, fname, len(blob)))
                continue
            with open(dest, "wb") as f:
                f.write(blob)
            saved.append("img/%s/%s" % (eid, fname))

        if len(saved) < 2:
            failures.append("%s: only %d image(s) saved" % (eid, len(saved)))

        resolved[eid] = {
            "datasetName": meta.get("name"),
            "equipment": meta.get("equipment"),
            "level": meta.get("level"),
            "primaryMuscles": meta.get("primaryMuscles", []),
            "secondaryMuscles": meta.get("secondaryMuscles", []),
            "instructions": meta.get("instructions", []),
            "images": saved,
        }
        print("  %-34s %d images  %s" % (eid, len(saved), meta.get("name")))

    with open(os.path.join(ROOT, "tools", "resolved.json"), "w", encoding="utf-8") as f:
        json.dump(resolved, f, indent=2, ensure_ascii=False)

    print("\nresolved %d/%d movements" % (len(resolved), len(IDS)))
    total = sum(len(v["images"]) for v in resolved.values())
    print("images saved: %d" % total)
    if failures:
        print("\nFAILURES (%d):" % len(failures))
        for x in failures:
            print("  -", x)
        sys.exit(1)
    print("all good")


if __name__ == "__main__":
    main()
