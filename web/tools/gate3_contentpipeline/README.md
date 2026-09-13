# Gate 3 real content pipeline

This directory contains the small offline batch boundary for real CS2 match
snapshots. It reuses the existing `tools/gate1_demopipeline/parse_lite2_demo.py`
core through `ExtractionSpec`; it does not copy a parser, create a service, or
ship raw demos.

The direct dependency remains `demoparser2==0.42.0`, the already pinned CS2
adapter from [LaihoE/demoparser](https://github.com/LaihoE/demoparser), under
its MIT license. Awpy was considered as a higher-level analytics layer, but it
would add a heavier dependency surface and is not needed for this vertical
slice; map overview values are kept as provenance-linked configuration.

## Run against external demos

```powershell
python tools/gate3_contentpipeline/build_content_pack.py `
  --manifest tools/gate3_contentpipeline/real-content-manifest.json `
  --demo-root "D:\CS2 Demo\<verified-match-folder>" `
  --output-dir src/data/realMatch
```

Each entry configures only the verified source context: demo filename, map
overview, round/time target, team roster, and optional expected score. The
shared adapter recovers header identity, tick/time, player state, team side at
the target tick, Bomb event fold, and coordinates. A short/ended round may not
emit `round_time_warning`; the output records that absence as unavailable while
still requiring round boundary/game-time consistency and rejecting target ticks
at or after `round_end`.

Outputs are always `verificationStatus: "draft"` and
`humanQaRequired: true`. `mapAsset: null` is intentional for the new Overpass
and Dust2 snapshots: world coordinates are machine facts, not permission to
render a map without a Human-QA-approved raster calibration. Call, Reason,
trade-off, Tactical Preview, and Professional Reference remain authored human
work.

The committed JSON files are derived facts only. The original `.dem` files
remain external and are never committed.
