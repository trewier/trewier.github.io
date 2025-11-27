# trewier.github.io
Ship Builder / Naval Component Architect

This repository contains a small ship/component builder web tool. Recent changes simplified the XML and parsing logic:
- `ship_data.xml` now uses Tier-level defaults for `qty_per_part` and `total_parts` to remove per-Part repetition.
- Facilities now include a `label` attribute for UI display (fallback to `name` is supported in code).
- Inline JS parser in `index.html` now understands Tier-level defaults and uses part-level overrides if present.

Files updated as part of simplification:
- `ship_data.xml` (compacted Tier defaults, facility `label` attributes added)
- `index.html` (inline parser updated to read Tier defaults and facility labels)

There are also alternate simplified files created for testing (`ship_data.min.xml`, `script.min.js`, `index.min.html`). Keep them for reference, or delete if you prefer.
```
