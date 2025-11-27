# trewier.github.io
Ship Builder / Naval Component Architect

This repository contains a small ship/component builder web tool. It's designed for a GitHub Pages static site, using plain HTML, CSS and JavaScript.

Data format & parsing
-- Primary: `ship_data.json` — JSON is the canonical format and preferred for the browser; `ship_data.json` must be present for the site to load data. The XML file(s) were removed and are no longer used.

- `index.html` fetches `ship_data.json` (required) and `main.js` contains the logic to parse JSON and initialize the app.
- The JSON structure mirrors the XML and supports Tier-level defaults for `qty_per_part` and `total_parts`, which reduces repetition.

Files of interest
- `ship_data.json` — primary data file (required)
- `ship_data.xml` — archived backup (deprecated); data is now canonical in `ship_data.json`
- `index.html` — main UI; loads `main.js` which contains the app logic
- `main.js` — externalized application logic (parses JSON and initializes UI)
- `script.js` — sample/auxiliary script (unrelated sample utilities remain)

Local testing (PowerShell)
Open a local server in the repo folder so the browser can fetch data (recommended):
```powershell
python -m http.server 8000
# open http://localhost:8000/index.html
```
```
