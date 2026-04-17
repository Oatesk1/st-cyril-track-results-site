import json
import re
import urllib.request
from datetime import date
from pathlib import Path


RAW_RESULTS_URL = "https://ca.milesplit.com/meets/687874-cyo-la-finals-2025/results/1168890/raw"
OUTPUT_PATH = Path("division_targets.json")

GROUP_LABELS = {
    ("boys", "A"): "1A Boys",
    ("boys", "B"): "Division B Boys",
    ("girls", "A"): "1A Girls",
    ("girls", "B"): "Division B Girls",
}

GROUP_KEYS = {
    ("boys", "A"): "1a-boys",
    ("boys", "B"): "division-b-boys",
    ("girls", "A"): "1a-girls",
    ("girls", "B"): "division-b-girls",
}

EVENT_NAME_MAP = {
    "100 meter Dash": "100M",
    "200 meter Dash": "200M",
    "400 meter Dash": "400M",
    "800 meter Run": "800M",
    "1600 meter Run": "1600M",
    "Long Jump": "LJ",
    "Javelin": "JV",
    "Javelin Throw": "JV",
    "Shot Put": "SP",
}

SECTION_HEADER_RE = re.compile(r'^(Boys|Girls)\s+(.+?)\s+"([AB])"$')
RESULT_LINE_RE = re.compile(r'^\s*(\d+)\s+.+\s+([^\s]+)\s+(\d+)\s*$')


def fetch_raw_results_text():
    with urllib.request.urlopen(RAW_RESULTS_URL) as response:
        return response.read().decode("utf-8", errors="ignore")


def normalize_sections(text):
    lines = [line.rstrip() for line in text.splitlines()]
    sections = []
    index = 0

    while index < len(lines):
        match = SECTION_HEADER_RE.match(lines[index].strip())
        if not match:
            index += 1
            continue

        sex = match.group(1).lower()
        raw_event_name = match.group(2).strip()
        division_letter = match.group(3)
        event_code = EVENT_NAME_MAP.get(raw_event_name)
        index += 1

        if not event_code:
            continue

        while index < len(lines):
            stripped = lines[index].strip()

            if not stripped:
                index += 1
                continue

            if SECTION_HEADER_RE.match(stripped):
                break

            round_name = stripped.lower()
            if round_name not in {"prelims", "finals"}:
                index += 1
                continue

            index += 1
            marks = []

            while index < len(lines):
                stripped = lines[index].strip()
                if SECTION_HEADER_RE.match(stripped) or stripped.lower() in {"prelims", "finals"}:
                    break

                if stripped and not set(stripped) <= {"="}:
                    result_match = RESULT_LINE_RE.match(lines[index])
                    if result_match:
                        marks.append({
                            "rank": int(result_match.group(1)),
                            "mark": result_match.group(2),
                        })

                index += 1

            sections.append({
                "group_key": GROUP_KEYS[(sex, division_letter)],
                "group_label": GROUP_LABELS[(sex, division_letter)],
                "event_code": event_code,
                "round_name": round_name,
                "marks": marks,
            })

    return sections


def build_targets(sections):
    groups = {}

    for section in sections:
        group = groups.setdefault(section["group_key"], {
            "label": section["group_label"],
            "events": {},
        })
        event = group["events"].setdefault(section["event_code"], {})
        event[section["round_name"]] = section["marks"]

    for group in groups.values():
        normalized_events = {}
        for event_code, rounds in group["events"].items():
            prelims = rounds.get("prelims", [])
            finals = rounds.get("finals", [])
            finalists_count = len(finals)

            prelim_cutoff = prelims[-1]["mark"] if prelims else None
            finals_cutoff = prelims[finalists_count - 1]["mark"] if prelims and finalists_count and len(prelims) >= finalists_count else None
            winner_mark = finals[0]["mark"] if finals else (prelims[0]["mark"] if prelims else None)

            normalized_events[event_code] = {
                "prelim_qualifying": prelim_cutoff,
                "finals_qualifying": finals_cutoff,
                "winner": winner_mark,
            }

        group["events"] = normalized_events

    return {
        "source": {
            "meet": "CYO-LA Finals 2025",
            "source_url": RAW_RESULTS_URL,
            "generated_on": str(date.today()),
            "notes": [
                "Prelim Qualifying is the last listed mark in the prelim results.",
                "Finals Qualifying is the prelim mark at the same rank as the size of the finals field.",
                "Winner is the first-place finals mark.",
            ],
        },
        "groups": groups,
    }


def main():
    raw_text = fetch_raw_results_text()
    sections = normalize_sections(raw_text)
    payload = build_targets(sections)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()