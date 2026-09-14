# Gate 4：Demo Import Productization Design

## Status

- Date: 2026-09-14
- Branch: `gate/4-demo-import-productization`
- Baseline: `main@cf226e120de50dbc28bef2ee23d13989bfb79718`
- Design approval: user approved the browser-local import direction on 2026-09-14

## Goal

Turn the existing developer-wired `.dem → NormalizedMatchState → ScenarioDraft → Human QA → Second Coach` proof into a normal product path:

`选择 / 拖入 Demo → 本地解析 → 查看比赛与 Round / 时间 → 选择节点 → 生成 Draft → Human QA → practice Second Coach`

The imported Demo must be a new, previously unwired file. Machine recovery is limited to facts that the parser can mechanically establish. Tactical meaning remains authored and reviewable by a human.

## Existing constraints confirmed

- The stable product entry is `ExperienceShell`; it already implements the Second Coach reducer and report flow.
- The current Gate 1 page uses a fixed developer-authored JSON snapshot and a fixed authored `Scenario`. It does not expose Demo selection or node selection.
- `ScenarioDraft` already separates the normalized machine snapshot and QA checks from the authored Scenario, but its current approval helper assumes an existing authored Scenario.
- `NormalizedMatchState` requires strict provenance, ten unique players, round/time identity, bomb state, and an explicit source SHA-256.
- `TacticalPreview` can show a current-state raster only when a map asset and calibration are explicitly available. An imported map without those assets must not receive a fabricated spatial preview.
- Hero, Lite2, Lite3, the existing reducer, and the current Second Coach flow are out of scope for replacement.

## Selected approach

Use the official `demoparser2` WASM package in a dedicated Web Worker as the first path. The browser reads the user-selected local File, transfers its bytes to the Worker, and receives structured inspection data and a selected normalized snapshot. If the current official WASM build rejects a supported real Demo, the client explicitly switches to a bounded compatibility request handled by the existing Next application runtime, using the same real bytes and official native `@laihoe/demoparser2` binding. That compatibility path does not persist the Demo, write generated output, read a repository path, or substitute a fixture.

The implementation will reuse the already validated `demoparser2` semantics and the repository's configurable extraction/normalization rules. It will add a thin browser adapter, not a second parser and not per-map parser scripts.

The import surface will be reachable from the normal Intro entry through a secondary “导入 Demo” action and will have a stable route for direct navigation. `/gate1` and existing content-pack pages remain regression fixtures and are not converted into the product importer.

## User flow and state boundaries

### 1. Select

The user selects or drops one `.dem` file. The UI validates the extension and reports file size/name. It keeps the File in memory only for the active import session.

### 2. Parse and inspect

The Worker performs deterministic parsing and returns:

- file name and SHA-256 provenance;
- parser/version information and map/header data;
- teams and roster data when available;
- mechanically identified round boundaries;
- available deterministic round/time/tick nodes;
- parse capability warnings or a structured unsupported/error state.

The UI labels parser output as “机器恢复事实” and never calls a node “关键决策”, “最佳时机”, or a candidate. The user chooses from the available round/time nodes; no Candidate Engine is introduced.

### 3. Generate Draft

The selected node is normalized into the existing `NormalizedMatchState` contract. A new import builder creates a draft with:

- `verificationStatus: "draft"`;
- `authoredScenarioId: null` (or an equivalent explicit machine-only origin marker);
- strict machine provenance and selection evidence;
- QA items for source/map, round/time, players/alive, objective/bomb, and spatial/render availability;
- no generated Call, Reason, route, zone, Professional Reference, or training conclusion.

The draft is rendered in the product's Human QA surface. It is never silently promoted to `practice` or `verified`.

### 4. Human QA

Human QA first confirms machine facts and then authors the required semantic fields needed by the existing `Scenario` schema:

- scenario title/purpose and user-visible situation framing;
- known facts and unknown boundaries;
- three Calls and their descriptions;
- three to six reason options;
- per-Call challenge guidance;
- per-Call tactical preview annotations when a suitable map base exists;
- Professional / Coach Reference and training framing.

Empty semantic fields block approval. The UI must make it clear that these fields are human-authored and that parser output is not a tactical answer. Spatial preview is optional only when the relevant map asset/calibration is explicitly present; otherwise QA records that the visual is unavailable and the product uses the structured state path.

### 5. Continue to Second Coach

After machine QA and semantic QA pass, a common approval function creates a `practice` Scenario from the imported snapshot plus the human-authored semantics. The existing `ExperienceShell` receives that Scenario through its existing `scenarios` and `currentStateByScenarioId` inputs. The Second Coach flow remains unchanged, including user-first judgment, challenge, Keep/Revise, Tactical Preview, Professional Reference, and Review.

## Domain/API shape

Add a browser-facing domain adapter with strict Zod validation rather than passing raw parser output into React:

- `DemoImportInspection`: provenance, header, teams/players, round list, available node descriptors, parser warnings.
- `DemoImportNode`: stable node id, round number, tick, time semantics, selection evidence, and the normalized state for that node or a validated state payload.
- `DemoImportStatus`: idle, reading, parsing, ready, unsupported, and error states.
- `buildImportedScenarioDraft`: creates a draft without an authored Scenario and preserves the machine/human boundary.
- `approveImportedScenarioDraftForPractice`: accepts only a fully validated human-authored semantic payload plus all required QA confirmations, then delegates to a shared finalization path used by the existing Gate 1 approval helper.

Existing Gate 1 callers and serialized fixtures must remain valid. Any schema change must be backward compatible and covered by existing tests plus import-specific tests.

## Browser/runtime boundary

- The parser Worker owns the large byte buffer and parser calls.
- The main thread owns only validated inspection/state data and UI state.
- Worker messages are discriminated and validated at the boundary.
- Parser exceptions, malformed output, unsupported maps, missing roster identity, and impossible state invariants become actionable UI errors.
- Do not fall back from an invalid parse to a stale fixture or to guessed facts.
- The implementation probes the exact installed WASM API and Next bundling behavior. The acceptance Demo is currently rejected by the upstream WASM build during full event/tick parsing, while the existing app runtime's official native binding parses it reliably. The compatibility request is a thin byte-in/JSON-out route inside the current Next app, not a new backend service, storage layer, queue, or parser implementation.

### Evidence-based runtime correction

The shipped browser asset is the official generated WASM package from `LaihoE/demoparser` revision `2d0f3b3a55d9830bef296e3f0003973fccf17849`. The product also depends directly on the official native `@laihoe/demoparser2@0.42.0` binding for the existing Next runtime. During Gate 4 acceptance, the WASM header path initialized, but the current P1 Demo failed during full event/tick parsing; the native binding returned the complete 13-round inspection and exact tick state. The UI exposes this as an explicit compatibility parser transition, with the same machine-only and no-future-facts boundaries.

## Map and tactical boundary

The importer may attach a known map base only through an explicit, verified asset/calibration mapping. Current-state markers are shown only when the `NormalizedMatchState` render frame passes the existing calibration contract. A parser map name alone is insufficient. The importer must not copy affine constants or create `parse_<map>_demo.py` variants.

Awpy remains a research/reference option for future nav/visibility/region/grenade analytics. It is not added to this Gate unless the minimum browser import demonstrably requires it; this Gate does not build Candidate Engine analytics.

## Non-goals

- backend upload API, database, auth/team domain, queue/worker service, cloud object storage, or replay engine;
- Python GUI or developer CLI as a user requirement;
- full Dataset Platform or parser service;
- automatic “interesting node” ranking or Candidate Engine;
- automatic tactical semantic generation;
- replacing the reducer, training flow, Tactical Preview core, or stable content;
- mass Scenario schema migration;
- claiming compatibility with every CS2 Demo version or every map without evidence.

## Acceptance evidence

Use a real Demo that was not previously wired into the app, preferably the available Mirage P1 or another external match file not represented by an existing Scenario fixture. From a normal browser session, demonstrate:

1. choose/drop the Demo;
2. observe parse progress and successful match/map/roster facts;
3. inspect multiple available Round/time nodes;
4. select one node;
5. verify the displayed normalized state against parser output and provenance;
6. confirm the Draft remains draft and machine facts are labeled as such;
7. complete Human QA with authored semantics;
8. enter the existing Second Coach and complete its normal flow without developer tools.

Also demonstrate an unsupported/error case and verify that future information is not exposed: no later kill, outcome, professional result, or post-decision fact may be used in the Situation or machine Draft unless it is explicitly part of the selected pre-decision snapshot and user-known boundary.

## Verification plan

- Python parser-core unit tests remain green; add only pure tests if shared extraction behavior changes.
- Vitest tests cover Worker message validation, inspection/node normalization, draft invariants, QA approval, backward compatibility, and UI states.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
- Use a real browser for the new-demo E2E and inspect the resulting state/visual map when present.
- Verify the final branch/worktree and commit only Gate 4 design and implementation changes.
