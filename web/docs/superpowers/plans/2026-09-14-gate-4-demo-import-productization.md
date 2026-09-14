# Gate 4 Demo Import Productization Implementation Plan

> **Execution note:** Implement this plan task-by-task in the current Gate 4 branch. Follow the repository TDD rule: each production behavior starts with a failing test, then the smallest implementation, then refactoring.

**Goal:** Let a normal user choose/drop a previously unwired CS2 `.dem`, inspect mechanically available match/Round/time data, choose an explicit Round and tick, create a machine-only `ScenarioDraft`, complete the minimum Human QA authoring needed for a legal `practice` Scenario, and continue through the existing Second Coach.

**Architecture:** Browser-local parser in a dedicated Web Worker using the official `demoparser2` WASM package. The Worker keeps the raw File bytes in memory for the active session, returns validated inspection data, and parses the exact user-selected tick on demand. The main thread stores only validated data and authoring state. The importer produces an existing-style Draft and hands a completed practice Scenario to the unchanged `ExperienceShell`.

## Task 1: Confirm the parser package and browser build boundary

**Files:** `package.json`, `pnpm-lock.yaml`, `public/vendor/demoparser2/*` or a narrowly scoped bundling adapter, `docs/superpowers/specs/...` only if an evidence-based correction is needed.

1. Add the official WASM package at the actual published version (`demoparser2@0.15.0`, not the native `@laihoe/demoparser2@0.42.0`) only after verifying package metadata, MIT provenance, exports, and size.
2. Write a small failing runtime/build test or executable probe for the actual WASM exports: initialization, header, event, and exact-tick parsing from `Uint8Array`.
3. Prove that the Next production build can serve the WASM and Worker without importing the native Node binding into client code.
4. If the package cannot reliably parse the acceptance Demo or cannot be packaged without a prohibited server/service, stop with `ARCHITECTURE DECISION REQUIRED` and record the evidence instead of silently switching architectures.

## Task 2: Define strict import-domain contracts

**Files:** `src/domain/demoImport.ts`, `src/domain/normalizedMatchState.ts` (only backward-compatible additions if necessary), `src/test/demoImport.test.ts`.

1. Add failing tests for discriminated import statuses, provenance, round descriptors, exact tick selection, event markers, parse errors, and the rule that selected state contains no later events/facts.
2. Define Zod schemas for:
   - `DemoImportInspection` (file provenance, header, teams/roster, map, rounds, legal tick ranges, neutral mechanical markers, warnings);
   - `DemoImportRound` (round number, start/end/freeze boundary ticks, time semantics, min/max selectable tick);
   - `DemoImportSelection` (explicit round and tick plus selection evidence);
   - Worker request/response envelopes;
   - a machine-only imported Draft marker/origin without changing existing Gate 1 fixture compatibility.
3. Implement pure helpers for tick/time conversion, legal-range checking, deterministic round selection, marker filtering at or before the selected tick, and stable imported IDs.
4. Ensure the domain rejects guessed roster/team identity, duplicate stable IDs, invalid map coordinates, invalid time identity, mismatched round/tick, and any post-selection event included as a Situation fact.

## Task 3: Adapt demoparser2 output into normalized state

**Files:** `src/domain/demoImportAdapter.ts`, `src/test/demoImportAdapter.test.ts`.

1. Add fixture-shaped parser outputs and failing tests for header normalization, team/roster normalization, round boundaries, bomb/objective state, time semantics, SHA-256 provenance, and optional render-frame handling.
2. Reuse the repository's existing NormalizedMatchState validation and configurable extraction semantics. Do not copy the Python parser into TypeScript and do not create per-map parser functions.
3. Implement:
   - one inspection adapter that returns all mechanically available rounds/ranges and neutral event markers;
   - one exact-tick adapter that returns a single `NormalizedMatchState` for the selected tick;
   - explicit unavailable states when the parser cannot establish a required fact;
   - map asset/calibration attachment only through an explicit allowlisted mapping with the existing calibration contract.
4. Keep current-state raster rendering opt-in. A known map name without a verified asset/calibration must remain structured state only.

## Task 4: Build the browser Worker bridge

**Files:** `src/lib/demoImportClient.ts`, `src/workers/demoParserWorker.ts` or `public/workers/demoParserWorker.js`, `src/test/demoImportClient.test.ts`.

1. Add failing tests for Worker request sequencing, progress, cancellation/reset, malformed response rejection, parser exceptions, unsupported files, and no fixture fallback.
2. Implement a single active-session Worker protocol:
   - `load` transfers the selected File bytes and computes provenance;
   - `inspect` parses header/roster/round ranges/events;
   - `select` accepts any tick inside the selected Round's legal range and parses that exact tick on demand;
   - `reset` releases the in-memory bytes and terminates the session.
3. Keep parser output behind Zod parsing before it reaches React. The Worker must never return a stale fixture when a parse fails.
4. Expose a promise/callback client with progress and a structured error state suitable for the UI.

## Task 5: Add the normal product entry and import/selection UI

**Files:** `src/app/import/page.tsx`, `src/components/import/DemoImportScreen.tsx`, `src/components/import/DemoDropzone.tsx`, `src/components/import/DemoRoundSelector.tsx`, `src/components/import/importCopy.ts`, `src/components/experience/IntroScreen.tsx`, `src/test/demoImportScreen.test.tsx`, `src/test/introScreen.test.tsx` if needed, `src/app/globals.css` only for scoped tokens/styles.

1. Add failing UI tests for the normal Intro entry, file picker/drop behavior, extension/size validation, progress, parse failure, round list, arbitrary tick control, displayed event markers, exact selection, and explicit machine-only labels.
2. Add a secondary Intro action to open the importer while keeping the existing Hero/Lite2/Lite3 entry intact.
3. Render the importer as a clear two-step surface:
   - file and parser status;
   - inspection panel with every detected Round and a continuous/legal tick input plus numeric tick/time readout. The user must be able to enter a valid tick within the range, not just choose a small pre-enumerated candidate list.
4. Show mechanical event markers as neutral navigation aids only. Do not call them key decisions, recommendations, or valuable moments, and do not carry post-selection markers into the Situation facts.
5. Add responsive keyboard-accessible controls, visible focus, no drag-only interaction, and reduced-motion-safe progress states.

## Task 6: Implement the minimum Human QA authoring surface

**Files:** `src/components/import/ImportedDraftQaScreen.tsx`, `src/domain/importedScenario.ts`, `src/test/importedDraftQaScreen.test.tsx`, `src/test/importedScenario.test.ts`.

1. Add failing tests that prove a machine-only Draft cannot approve with missing semantic fields and that successful QA produces a schema-valid practice Scenario.
2. Reuse the existing `Scenario`, `ScenarioDraft`, QA-check, status, and tactical preview schemas wherever possible. Add only the smallest backward-compatible helper/field needed to represent an imported Draft with no authored Scenario yet.
3. Render machine snapshot facts read-only and clearly labeled. Include QA confirmations for source/map, round/time, players/alive, objective/bomb, and coordinate/render availability.
4. Add a compact authoring form for only the required semantic fields:
   - title/purpose, phase/time framing, alive/objective framing, and Known/Unknown facts;
   - three Call labels/descriptions;
   - three to six Reason options using existing Reason IDs;
   - three per-Call challenge guidance blocks;
   - three per-Call tactical preview specs only when authored spatial data is available, otherwise an explicit unavailable state;
   - Professional / Coach Reference and training framing.
5. Use empty-field and Zod validation to block approval. Never prefill these values from parser heuristics or an existing Scenario.
6. Finalize with a shared approval helper that preserves the machine snapshot/provenance, sets `verificationStatus: "practice"`, and does not create `verified` content.

## Task 7: Connect to the unchanged Second Coach

**Files:** `src/components/import/ImportedScenarioExperience.tsx` or route-local integration, `src/test/importedScenarioExperience.test.tsx`, minimal changes to `src/components/experience/ExperienceShell.tsx` only if a tested prop gap exists.

1. Add failing tests for passing the approved practice Scenario and current-state map data into the existing shell, user-first decision order, and imported metadata persistence in the final report.
2. Reuse `ExperienceShell` with its existing scenario pool and current-state props. Do not fork the reducer or duplicate challenge/review screens.
3. Preserve the normal user sequence: Situation → initial Call/Reasons → AI Challenge → Keep/Revise → Tactical Preview → Professional Reference → Review.
4. Ensure the imported flow can return to the importer or restart without carrying a stale imported session into the default fixtures.

## Task 8: Browser acceptance and leakage verification

**Files:** `output/playwright/gate4-demo-import/` artifacts, a temporary local acceptance script if needed (do not commit raw Demo files).

1. Use an external, previously unwired real Demo such as `g2-vs-spirit-m3-mirage-p1.dem` and run the normal browser path from file selection through exact Round/tick selection, Draft, Human QA, and the existing Second Coach.
2. Verify at least two Rounds and at least two ticks in one Round can be selected, including a typed tick that was not pre-enumerated as a marker.
3. Verify a parse error/unsupported state with a non-Demo or an intentionally invalid file and confirm no fixture appears.
4. Inspect selected-state facts against the parser output and ensure later kills, bomb outcome, round outcome, professional answer, or other future information is not present in the selected Situation/Draft.
5. Check desktop and mobile layouts, keyboard focus, drag/drop fallback, progress, cancellation/reset, and map raster behavior.

## Task 9: Full verification and branch handoff

**Files:** none beyond implementation artifacts.

1. Run Python parser tests.
2. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
3. Review `git diff --check`, `git status`, and the full Gate 4 diff for scope drift, secrets, raw Demos, generated outputs, or stale fixtures.
4. Keep the design/implementation commits small and on `gate/4-demo-import-productization`; do not merge `main` and do not start Reviewer/Integrator.
5. Before final reporting, independently verify every user requirement with fresh command, browser, and source evidence; report remaining friction and whether `ARCHITECTURE DECISION REQUIRED` was triggered.

