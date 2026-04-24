# Athlete Records Starter Website

A very simple starter website shell where parents can search for an athlete by name and view records.

## Files

- `index.html` - page layout and search input
- `styles.css` - basic page styling
- `app.js` - loads JSON data and handles search/results rendering
- `athlete_records.json` - athlete data source from your track data project
- `athlete_goals.json` - optional goal marks by athlete and event for chart target lines
- `division_targets.json` - generated benchmark lines by division and event from MileSplit results
- `athlete_divisions.json` - starter athlete-to-division assignments for benchmark charts
- `regional_qualifiers.json` - optional aggregated top-16 regional qualifiers by event (first two meets combined)
- `build_division_targets.py` - regenerates `division_targets.json` from the MileSplit raw results page

## Data format

`athlete_records.json` should be an object with an `athletes` array:

```json
{
	"athletes": [
		{
			"name": "Chretin, Gillian",
			"search_name": "chretin, gillian",
			"personal_records": {
				"100M": "19.03"
			},
			"results": [
				{
					"meet_date": "4/12/2026",
					"meet_name": "Fiya Meet 3 April 12 2026 Culver City High School",
					"events": {
						"100M": "19.37"
					},
					"is_latest_meet": true
				}
			]
		}
	]
}
```

## Goal data format

`athlete_goals.json` is optional. When present, it adds a dashed goal line to each event chart for that athlete.

Use athlete `id` values from `athlete_records.json` as the keys:

```json
{
	"goals": {
		"chretin-gillian": {
			"100M": "18.50",
			"400M": "1:32.00",
			"JV": "22-00"
		},
		"chretin-nicolas": {
			"100M": "13.50",
			"SP": "35-00"
		}
	}
}
```

Use the same mark formats already used in `athlete_records.json`:

- Running events: `19.03` or `1:08.77`
- Field events: `20-03` or `33-01.00`

## Division target workflow

`division_targets.json` contains three benchmark lines per event:

- `prelim_qualifying` - the last listed mark in prelims
- `finals_qualifying` - the prelim mark that matched the size of the finals field
- `winner` - the winning finals mark

The app uses `athlete_divisions.json` to decide which division benchmark set applies to each athlete. You can also choose a target group from the athlete card in the browser; that choice is saved locally in the browser.

Example assignment file:

```json
{
	"assignments": {
		"chretin-gillian": "1a-girls",
		"chretin-nicolas": "1a-boys"
	}
}
```

Example generated target shape:

```json
{
	"groups": {
		"1a-boys": {
			"label": "1A Boys",
			"events": {
				"100M": {
					"prelim_qualifying": "14.70",
					"finals_qualifying": "12.93",
					"winner": "11.93"
				}
			}
		}
	}
}
```

To regenerate division benchmarks from the MileSplit source page, run:

```powershell
c:/Users/kevin/athlete-records-starter/.venv/Scripts/python.exe build_division_targets.py
```

## Regional qualifiers view (new)

The site now has two entry options:

- `Athlete Records` - existing search interface (unchanged)
- `Regional Qualifiers` - event tabs showing top 16 qualifiers to-date

To populate the new Regional Qualifiers mode, add an optional `regional_qualifiers.json` file in this folder.

Expected format:

```json
{
	"generated_at": "2026-04-24T18:30:00",
	"source_meets": [
		"Regional Meet 1",
		"Regional Meet 2"
	],
	"events": {
		"100M": [
			{
				"athlete": "Runner, Ava",
				"team": "St. Cyril",
				"mark": "13.51",
				"meet": "Regional Meet 1"
			}
		],
		"SP": [
			{
				"athlete": "Thrower, Leo",
				"team": "St. Cyril",
				"mark": "34-08.50",
				"meet": "Regional Meet 2"
			}
		]
	}
}
```

Notes:

- Running events (`100M`, `200M`, `400M`, `800M`, `1600M`) are sorted fastest to slowest.
- Field events (`JV`, `SP`, `LJ`) are sorted longest to shortest.
- The UI automatically keeps the top 16 entries per event.

## Run locally

Run with a simple local server (recommended for loading JSON).

### Use Python server (if Python is installed)

From this folder, run:

```powershell
python -m http.server 5500
```

Then open:

`http://localhost:5500`

## One-command data refresh

To regenerate track data and copy the latest `athlete_records.json` into this website project, run:

```cmd
C:\Users\kevin\athlete-records-starter\Sync_Track_Data.bat
```

After it finishes, refresh the browser page.
