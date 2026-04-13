# Athlete Records Starter Website

A very simple starter website shell where parents can search for an athlete by name and view records.

## Files

- `index.html` - page layout and search input
- `styles.css` - basic page styling
- `app.js` - loads JSON data and handles search/results rendering
- `athlete_records.json` - athlete data source from your track data project

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
