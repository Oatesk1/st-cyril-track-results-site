import json
import re
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_PATH = Path("regional_qualifiers.json")

RAW_MEET_SOURCES = [
    {
        "label": "CYO-LA Regionals 1",
        "url": "https://ca.milesplit.com/meets/736149-cyo-la-regionals-1-st-anthony-ac-2026/results/1283773/raw",
    },
    {
        "label": "CYO-LA Regionals 2",
        "url": "https://ca.milesplit.com/meets/744317-cyo-la-regionals-2-st-paul-hs-2026/results/1283781/raw",
    },
    {
        "label": "CYO-LA Regionals 3",
        "url": "https://ca.milesplit.com/meets/736147-cyo-la-regionals-3-alemany-hs-2026/results/1289569/raw",
    },
    {
        "label": "CYO-LA Regionals 4",
        "url": "https://ca.milesplit.com/meets/736148-cyo-la-regionals-4-damien-hs-2026/results/1289574/raw",
    },
]

TOP_PER_MEET_PER_EVENT = 8

SECTION_HEADER_RE = re.compile(r'^(Boys|Girls)\s+(.+?)\s+"([AB])"$')
RESULT_LINE_RE = re.compile(
    r'^\s*(\d+)\s+(.+?)\s+(\d+)\s+(.+?)\s+([0-9]+(?::[0-9]{2}\.[0-9]{2})?|[0-9]+\.[0-9]+|[0-9]+-[0-9.]+)\s+(\d+)\s*$'
)

ALLOWED_EVENT_PATTERNS = (
    "100 meter Dash",
    "200 meter Dash",
    "400 meter Dash",
    "800 meter Run",
    "1600 meter Run",
    "Long Jump",
    "Shot Put",
    "Javelin Throw",
)

RUNNING_EVENT_SNIPPETS = ("meter Dash", "meter Run")


def fetch_raw_results_text(url):
    with urllib.request.urlopen(url) as response:
        return response.read().decode("utf-8", errors="ignore")


def strip_html(raw_text):
    lines = []
    for line in raw_text.splitlines():
        without_tags = re.sub(r"<[^>]+>", "", line)
        clean = without_tags.replace("\xa0", " ").rstrip()
        lines.append(clean)
    return lines


def is_allowed_event(event_name):
    return any(pattern in event_name for pattern in ALLOWED_EVENT_PATTERNS)


def is_running_event(event_name):
    return any(snippet in event_name for snippet in RUNNING_EVENT_SNIPPETS)


def parse_running_value(mark):
    parts = mark.split(":")
    try:
        if len(parts) == 1:
            return float(parts[0])
        total = 0.0
        for value in parts:
            total = total * 60 + float(value)
        return total
    except ValueError:
        return float("inf")


def parse_field_value(mark):
    if "-" not in mark:
        try:
            return float(mark) * 12
        except ValueError:
            return float("-inf")

    feet, inches = mark.split("-", 1)
    try:
        return float(feet) * 12 + float(inches)
    except ValueError:
        return float("-inf")


def extract_event_rows(lines, source_url):
    events = defaultdict(list)
    index = 0

    while index < len(lines):
        header_match = SECTION_HEADER_RE.match(lines[index].strip())
        if not header_match:
            index += 1
            continue

        gender, event_name, division = header_match.groups()
        full_event_name = f'{gender} {event_name} "{division}"'
        index += 1

        if not is_allowed_event(event_name):
            while index < len(lines):
                if SECTION_HEADER_RE.match(lines[index].strip()):
                    break
                index += 1
            continue

        in_finals = False
        finalists = []

        while index < len(lines):
            current = lines[index].strip()
            if SECTION_HEADER_RE.match(current):
                break

            lowered = current.lower()
            if lowered.startswith("final"):
                in_finals = True
                index += 1
                continue

            if lowered.startswith("prelim"):
                in_finals = False
                index += 1
                continue

            if in_finals:
                row_match = RESULT_LINE_RE.match(lines[index])
                if row_match:
                    rank, athlete, _year, team, mark, _heat = row_match.groups()
                    finalists.append(
                        {
                            "athlete": athlete.strip(),
                            "team": team.strip(),
                            "mark": mark.strip(),
                            "meet": source_url,
                            "html_rank": rank,
                        }
                    )

            index += 1

        events[full_event_name].extend(finalists[:TOP_PER_MEET_PER_EVENT])

    return events


def sort_event_rows(event_name, rows):
    running = is_running_event(event_name)

    def sort_key(entry):
        score = parse_running_value(entry["mark"]) if running else parse_field_value(entry["mark"])
        if running:
            return (score, entry["athlete"])
        return (-score, entry["athlete"])

    return sorted(rows, key=sort_key)


def build_aggregated_payload():
    aggregated_events = defaultdict(list)

    for source in RAW_MEET_SOURCES:
        raw_text = fetch_raw_results_text(source["url"])
        lines = strip_html(raw_text)
        parsed = extract_event_rows(lines, source["url"])
        for event_name, rows in parsed.items():
            aggregated_events[event_name].extend(rows)

    normalized = {}
    for event_name, rows in aggregated_events.items():
        normalized[event_name] = sort_event_rows(event_name, rows)

    return {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source_meets": [source["label"] for source in RAW_MEET_SOURCES],
        "source_urls": [source["url"] for source in RAW_MEET_SOURCES],
        "top_per_meet_per_event": TOP_PER_MEET_PER_EVENT,
        "events": normalized,
    }


def main():
    payload = build_aggregated_payload()
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
