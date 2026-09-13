# Plan: Gate 1 Real Match Vertical Slice

## Goal

Prove one real CS2 demo state can cross an offline Python-to-JSON boundary and appear in the existing Connected Decisions Tactical Preview without changing authored Scenario semantics or the Second Coach flow.

The fixed proof target is G2 vs Team Spirit on Mirage, human Round 34, with the round clock showing about 0:40 and a 5v5 state. The verified source is `g2-vs-spirit-m3-mirage-p2.dem`; its internal round boundaries place human Round 34 at parser round counter 33. The resolved snapshot is tick 184065, derived from the Round 34 freeze-end tick 179265, a 64 tick/s game-time sample, and 75 elapsed seconds / 40 remaining seconds.

## Architecture and boundaries

```text
real .dem
  -> tools/gate1_demopipeline/parse_lite2_demo.py
  -> deterministic NormalizedMatchState JSON
  -> src/domain/normalizedMatchState.ts validation
  -> src/domain/currentStatePreview.ts thin product adapter
  -> TacticalPreview current-state marker mode
  -> /gate1 proof screen
```

- Python is an offline producer only. It does not expose HTTP, a worker, a database, or a parser service.
- The JSON file is the formal boundary and contains only the vertical-slice state and extraction provenance.
- `ScenarioSchema`, `previewByCall`, `TacticalPreviewScreen`, `experienceReducer`, existing verified scenarios, and the Second Coach interaction remain unchanged.
- Current match markers are explicitly separate from authored `previewByCall` routes. The renderer must not present current positions as executable Call A/B/C routes.
- Only Mirage metadata is supported in this Gate. The adapter rejects unsupported maps and out-of-range normalized coordinates rather than clamping them.
- The raw `.dem` is not added to the repository.

## Tech stack

- Python 3 standard library plus pinned `demoparser2==0.42.0` for offline extraction.
- TypeScript strict mode, Zod 4, React, existing Next.js App Router, and Vitest.
- Existing `/maps/Lite2_Map.png` is reused as the product map asset.

## Work items

### 1. Add failing parser and contract tests first

Create `tools/gate1_demopipeline/test_parse_lite2_demo.py` with `unittest` coverage for:

- human-round selection from parser round counters, including the Round 34 -> counter 33 mapping and missing-target failure;
- 64 tick/s target-tick calculation and validation against round-clock remaining time; warning-event anchors are usable only when they occur at or before the target;
- required player identity/position normalization, optional weapon handling, unique IDs, and exact 10-player validation;
- bomb carrier folding from pickup/drop events, including unavailable state when no reliable event exists;
- explicit unsupported-demo failures for wrong map, missing round boundaries, and incompatible roster;
- deterministic JSON serialization with sorted keys and rejection of non-finite numbers.

Create the TypeScript tests `src/test/coordinateAdapter.test.ts`, `src/test/normalizedMatchState.test.ts`, and `src/test/currentStatePreview.test.ts` before their production modules exist. These tests will assert:

- Mirage overview corners and a known target player map to expected radar/0..100 values with the correct Y direction;
- out-of-range world points are rejected rather than clipped;
- the real JSON parses, contains 10 distinct players, preserves alive/side/team/weapon data, and identifies `magixx` as the derived bomb carrier;
- malformed or non-finite JSON is rejected;
- the product adapter returns marker data while leaving authored Scenario data untouched.

Run the targeted Python and Vitest tests at this point and record the expected missing-implementation failures before adding production code.

### 2. Implement the minimal offline producer

Add `tools/gate1_demopipeline/parse_lite2_demo.py` with pure functions and a thin parser-specific boundary:

- `RoundBoundary` and `TargetSpec` value objects;
- `select_round_boundary`, `infer_tickrate`, `select_target_tick`, and time-anchor validation;
- `normalize_player_row` and roster validation using stable Steam IDs;
- `fold_bomb_events` for event-derived carrier state;
- `serialize_deterministic` using finite JSON values, stable ordering, and readable indentation;
- `inspect_round_range` for reporting the actual human round range in each demo;
- `extract_lite2_demo(demo_path, output_path)` using `demoparser2` friendly aliases and raw round-time data only where needed.

The extractor must verify `de_mirage`, the explicit G2/Spirit roster, the Round 34 boundary, and the game-time/tick-rate relationship. A configured round-time warning may be required to exist in the selected round, but a warning after the target is never exposed or used as a target-time fact. It must derive alive counts from per-player `is_alive` rows because the observed aggregate game-rule fields are stale at the target snapshot. It must label team-name mapping, bomb carrier, and time derivation in extraction metadata.

Add `tools/gate1_demopipeline/requirements.txt` pinned to `demoparser2==0.42.0`, and `tools/gate1_demopipeline/README.md` documenting installation, the exact source asset, the p1/p2 round-range evidence, the invocation, metadata provenance, and the fact that this is an offline spike rather than a service.

Generate `src/data/realMatch/lite2-g2-spirit-r34.json` from the supplied p2 demo. The artifact must contain schema version, source filename/SHA/parser version, map overview metadata, human/parser round identity, resolved tick/time semantics, all 10 normalized players, bomb state, and draft/human-QA extraction metadata. Do not commit the demo itself.

### 3. Implement coordinate and JSON-boundary adapters

Add `src/domain/normalizedMatchState.ts`:

- define strict Zod schemas for the versioned JSON shape, map overview metadata, player state, bomb state, time semantics, and extraction metadata;
- export inferred types and `parseNormalizedMatchState(input: unknown)`;
- require finite numbers and reject malformed state.

Add `src/domain/coordinateAdapter.ts`:

- define the Mirage overview metadata contract (`posX=-3230`, `posY=1713`, `scale=5`, 1024x1024 radar space) with provenance;
- implement `worldToNormalizedPosition` using `radarX=(worldX-posX)/scale` and `radarY=(posY-worldY)/scale`, followed by radar-dimension conversion to 0..100;
- retain radar coordinates for auditability, round only at the product boundary, and throw for non-finite or out-of-range results;
- keep the map aspect/letterbox concern in the renderer rather than folding it into world-coordinate conversion.

Add `src/domain/currentStatePreview.ts`:

- parse the normalized JSON;
- map each player to a static current-state marker with normalized position and retain identity, side, alive, health, weapon, and place;
- expose bomb status/carrier and round/tick/time/score metadata;
- reject maps other than the supported Mirage configuration;
- never write or transform `Scenario.previewByCall`.

Run the targeted Python and TypeScript tests, then regenerate the fixture if the real extraction output changes.

### 4. Add an isolated product proof surface

Extend `src/components/tactical/TacticalPreview.tsx` with an optional current-state data prop. Preserve the existing authored route/zones/metrics/movement rendering path byte-for-byte in behavior when the prop is absent. When present:

- render 10 static player markers using the existing map and Lite2 letterbox transform;
- distinguish CT/T and alive/dead state visually and expose names/roles through accessible labels;
- add a bomb-carrier indicator when available;
- suppress authored route/zone/metric overlays and the renderer-generated authored legend in this mode;
- label the view as real match state at a static tick, not an execution route or result prediction.

Add `src/components/gate1/RealMatchSpikeScreen.tsx` and `src/app/gate1/page.tsx`. The proof page uses the real JSON and the existing Lite2 Scenario only for its map context; it shows the static tactical state, source/timing/provenance, and a compact player audit list. It must not enter the reducer, alter the scenario, or expose a new product flow from the main page.

### 5. Verify and reverse-review

Run:

```text
python -m unittest discover -s tools/gate1_demopipeline -p "test_*.py"
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Start the local app and manually inspect `/gate1` on desktop and a narrow viewport. Verify the 10 real markers, `magixx` carrier, Round 34 / 0:40 label, A/B/CT/T orientation, and lack of systematic mirror/offset against the supplied demo evidence and existing Lite2 QA reference. Run `git diff --check` and inspect the diff for Scenario/reducer/Tactical semantics drift.

The reverse review must explicitly challenge round indexing, tick/time identity, roster identity, side assignment, X/Y orientation, radar dimensions, bomb-event derivation, dead-player handling, current-state versus authored-route separation, and accidental claims of all-map/parser compatibility.

### 6. Commit and stop at Implementer boundary

Stage only Gate 1 files. Do not stage the pre-existing user edits in the repository-root `AGENTS.md`, `PRODUCTION.md`, or `TASKS.md`. Commit the reviewed implementation with a concise Gate 1 message, verify the commit and working-tree state, and stop. Do not push, merge, create a Reviewer task, or begin ScenarioDraft/Candidate/Awpy work.

## Acceptance criteria

- The supplied p2 demo is selected by Demo-internal map, roster, round-boundary, score, and time evidence; p1 is recorded as rounds 1–13 and p2 as rounds 14–47.
- Human Round 34 resolves to tick 184065 with 40 seconds remaining under validated 64 tick/s semantics.
- The output contains 10 distinct stable player identities, all five-versus-five at the snapshot, and an event-derived `magixx` bomb carrier when available.
- The JSON is deterministic, finite, human-readable, versioned, and validated at the TypeScript boundary.
- Mirage world coordinates map to correct 0..100 positions with known-point/direction tests and no silent clamping.
- The existing product can show the real state as isolated static markers without changing authored Scenario behavior or Second Coach interaction.
- No prohibited service, database, parser platform, full replay engine, candidate engine, Awpy, or broad schema migration is introduced.
