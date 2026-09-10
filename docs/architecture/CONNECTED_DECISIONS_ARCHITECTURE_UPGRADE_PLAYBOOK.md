# Connected Decisions — Architecture Upgrade Execution Playbook

> **Document type:** Architecture / Product Upgrade Execution Specification  
> **Project:** Connected Decisions  
> **Baseline audit commit:** `c0c11bb7e0003b5908b64d75a008b99fe599469d`  
> **Current product status:** `NOT RELEASE READY` / `PROMISING PROTOTYPE`  
> **Primary purpose:** Serve as the repository-level execution manual for future repair, architecture upgrades, and production hardening.  
> **Source of truth:** Real-world product & production audit completed against the baseline commit.

---

## 0. How to Use This Document

This document is **not** permission to rewrite the product from scratch.

It defines:

1. what must remain stable;
2. what must be repaired first;
3. which architectural upgrades are justified by verified product problems;
4. the order in which upgrades should happen;
5. the acceptance gates required before moving to the next stage;
6. what is explicitly out of scope for now.

When an Agent, developer, reviewer, or technical lead works on Connected Decisions, this file should be read **before any large structural change**.

### Execution rule

> **Repair verified failures before introducing architecture intended for future scale.**

Do not replace working product logic merely because a cleaner architecture is possible.

Do not introduce databases, authentication, distributed services, multi-agent systems, WebSockets, CMSs, or large infrastructure unless a later stage in this document explicitly requires them.

---

# 1. Product Baseline

Connected Decisions is evolving from a single-user decision-training prototype into a decision analysis and review system that can eventually support:

- amateur CS2 teams;
- school teams;
- coaches / analysts;
- individual players.

The near-term product is **not yet a full team-management platform**.

The current core value proposition is:

> Present a tactical situation → force the player to make an independent call → capture the reasons → introduce an AI second opinion → let the player keep or revise the judgment → compare with tactical/professional reference material → review the reasoning.

The architecture must support that loop first.

---

# 2. Frozen Core Interaction Loop

Unless a separate architecture decision explicitly changes it, the following flow is considered **product baseline behavior**:

```text
Intro
  ↓
Situation
  ↓
Initial Call
  ↓
Reason Selection / Reasoning Input
  ↓
AI Second Opinion
  ↓
Keep / Revise Decision
  ↓
Tactical Preview
  ↓
Professional Reference
  ↓
Round Review
  ↓
Connection Report
```

The fundamental logic is **not**:

> “AI tells the player the correct answer.”

It is:

> “The player commits to a judgment first, then receives an external challenge, and finally reviews whether and why the judgment changed.”

### Frozen product principles

The following principles must survive refactors:

- **Independent judgment comes before AI intervention.**
- AI is a **second brain / pressure-test mechanism**, not an oracle.
- Multiple tactical options may remain defensible.
- Professional play is a reference path, not automatically the unique correct answer.
- The system should analyze **reasoning quality**, not merely final option convergence.
- Unknown information must remain unknown at the decision timestamp.
- Tactical content must never teach false spatial relationships.
- A user’s recorded reasoning must never be silently rewritten by the system.

---

# 3. Current Release Decision

## Technical status

**NOT RELEASE READY**

The prototype can build, start, and complete the current three-round experience, but verified failures exist in:

- tactical map correctness;
- information fairness;
- report correctness;
- client failure recovery;
- storage failure recovery;
- AI API abuse/cost boundaries;
- AI factual/content boundaries;
- verified vs unverified scenario handling.

## Product status

**PROMISING PROTOTYPE**

The product can already support a one-off tactical discussion, but it is not yet a sustainable training product because it lacks:

- complete reasoning history;
- actionable post-round training tasks;
- reusable content loops;
- persistent training history;
- minimum team handoff / comparison capability.

---

# 4. Architecture Upgrade Strategy

The architecture upgrade must happen in **six stages**.

```text
Stage 0  Freeze & Baseline
   ↓
Stage 1  Trust & Reliability Repair
   ↓
Stage 2  Scenario / Domain Integrity
   ↓
Stage 3  Reasoning & Training Record
   ↓
Stage 4  Dataset / Content Production Loop
   ↓
Stage 5  Team Review & Comparison
   ↓
Stage 6  Production Hardening & Scale
```

A later stage must not be used to justify skipping an earlier release blocker.

---

# 5. Stage 0 — Freeze & Baseline

## Goal

Create a stable reference point before touching architecture.

## Required actions

- Preserve the current baseline commit.
- Preserve current automated tests.
- Preserve production-audit evidence.
- Document the current user flow.
- Document the current Scenario schema and session state shape.
- Record all currently verified P0/P1 issues.
- Confirm the working tree is clean before upgrade work begins.

## Must not change

- Core interaction order.
- Current decision semantics.
- Existing verified Scenario meaning without content-review evidence.
- AI timing: AI must not appear before the player’s independent judgment.

## Exit gate

Stage 0 passes only when:

- baseline tests are reproducible;
- the existing flow can still be completed;
- known defects are tracked rather than silently “fixed along the way” without evidence.

---

# 6. Stage 1 — Trust & Reliability Repair

This stage is **mandatory before architectural expansion**.

## 6.1 Tactical Preview correctness

### Verified problem

Tactical routes, labels, and endpoints do not consistently match the intended site, player positions, or map geometry.

### Required outcome

Every tactical visualization must be semantically consistent with:

- map;
- side;
- decision timestamp;
- player position;
- call destination;
- tactical intent.

### Acceptance

For every active Scenario:

- route start points align with the intended players;
- route endpoints align with the stated tactical destination;
- A/B site semantics are correct;
- image cropping does not remove critical tactical information;
- visual QA exists at desktop and mobile widths.

**Release blocker until fixed.**

---

## 6.2 Information fairness

### Verified problem

Decision screens can display unrelated or later-timestamp match imagery containing X-Ray/HUD information.

### Required outcome

A decision screen may contain only:

1. information known to the user at the decision timestamp; or
2. clearly marked non-evidentiary decorative media.

### Required architecture rule

Scenario content must distinguish:

```ts
decisionEvidence
contextMedia
referenceMedia
```

These three concepts must not be represented by one ambiguous asset field.

### Acceptance

No Scenario can expose:

- post-decision player positions;
- later player-count state;
- hidden opponent information;
- misleading match/map imagery presented as current evidence.

**Release blocker until fixed.**

---

## 6.3 Report semantic correctness

### Verified problem

Reason identifiers can collide across scenarios, causing reports to display the wrong reason labels.

### Required outcome

Reason identity must be scoped safely.

Preferred invariant:

```text
reason identity = scenarioId + reasonId
```

or an equivalent globally unique identifier.

### Acceptance

A completed multi-round run must reproduce the exact reasons selected in each Scenario.

No label substitution, collision, or late-scenario overwrite is allowed.

**Release blocker until fixed.**

---

## 6.4 Client request timeout and fallback

### Verified problem

A browser request can hang indefinitely even if the server-side model timeout is configured.

### Required outcome

Client-side requests for AI challenge/report must have:

- explicit deadline;
- deterministic timeout handling;
- retry or fallback path;
- user-visible recovery state.

### Acceptance

Injected request hangs must not permanently block training progression.

**Release blocker until fixed.**

---

## 6.5 Storage degradation

### Verified problem

Storage denial/quota errors can crash or block the application.

### Required outcome

Storage must be treated as a fallible dependency.

The application should support:

```text
persistent session
    ↓ failure
temporary in-memory session
```

### Acceptance

Injected failures for:

- `getItem`;
- `setItem`;
- `removeItem`;
- quota exhaustion;
- security denial

must not make the core training flow unusable.

**Release blocker until fixed.**

---

## 6.6 Public AI API boundaries

### Verified problem

Anonymous endpoints lack a verified application-level cost/abuse boundary.

### Required outcome

Before public release, provide a defensible limit using one or more of:

- application rate limiting;
- deployment/gateway rate limiting;
- request deduplication;
- per-session budget;
- per-IP budget;
- concurrency control;
- hard model-call budget;
- safe fallback when budget is exhausted.

Authentication is **not automatically required**.

### Acceptance

The team must be able to answer:

> “What prevents a stranger or script from generating unbounded model cost?”

with an implemented and tested mechanism.

**Release blocker unless equivalent deployment controls are verified.**

---

## 6.7 AI factual/content boundary

### Verified problem

Schema validation alone cannot prevent plausible but invented tactical facts.

### Required outcome

AI may reason about supplied facts, but must not create unsupported facts.

The AI contract must clearly separate:

```text
facts supplied by Scenario
reasoning over those facts
uncertainty / assumptions
recommendation
```

### Acceptance

Tests must reject or safely degrade outputs containing:

- fabricated exact defender positions;
- fabricated utility state;
- fabricated player resources;
- unsupported “only correct answer” claims;
- other factual assertions outside the Scenario evidence.

**Release blocker until bounded.**

---

## 6.8 Verified vs practice Scenario isolation

### Verified problem

Unverified practice content can later be described as a verified professional path.

### Required outcome

Scenario verification status must propagate through the entire product.

Minimum states:

```ts
verified
practice
draft
```

Equivalent naming is acceptable.

### Acceptance

A practice Scenario must never be represented as:

- verified professional evidence;
- verified professional trajectory;
- verified benchmark data.

---

# 7. Stage 1 Exit Gate

Stage 1 is complete only if:

- all P0/P1 release blockers above are resolved or explicitly waived with evidence;
- regression tests are added;
- desktop and mobile flows pass;
- injected storage and network failures degrade safely;
- Scenario evidence is trustworthy;
- report reasons are exact;
- no unverified content is promoted as verified.

Only after this gate should broader data/domain restructuring begin.

---

# 8. Stage 2 — Scenario / Domain Integrity

## Goal

Turn Scenario from a loosely coupled UI data object into a trustworthy domain object suitable for a growing content library.

This is the first justified architecture upgrade beyond repair.

## 8.1 Scenario should become the central domain unit

A Scenario should eventually describe at minimum:

```text
Identity
Match metadata
Decision timestamp
Player perspective
Known information
Unknown information
Decision options
Reason candidates
Tactical visualization
AI-safe factual context
Professional / reference path
Verification status
Source provenance
Review material
Content version
```

Do not implement fields only because they sound useful. Add fields only when required by product behavior or content QA.

---

## 8.2 Separate content from presentation

Scenario data should not depend on a specific React screen implementation.

Target dependency direction:

```text
Scenario / Domain
      ↓
Application logic
      ↓
UI renderer
```

Not:

```text
UI component
   ↓
embedded tactical/content assumptions
```

---

## 8.3 Explicit information boundary

Every decision Scenario must be able to answer:

```text
What does the player know?
What does the player not know?
What is inferred?
What is only revealed later?
```

The product must not rely on visual convention alone to express these boundaries.

---

## 8.4 Content provenance

Verified scenarios need source evidence.

Minimum provenance concept:

```text
match
map
round
decision timestamp
source video/demo
verification status
reviewer / verification note
```

This does not require a database yet.

A versioned JSON/TS/Markdown content package is acceptable during this stage.

---

## 8.5 Scenario validation

Add automated content validation where possible.

Examples:

- duplicate Scenario IDs;
- duplicate Reason IDs inside a Scenario;
- invalid reference Call;
- missing verification metadata;
- missing tactical assets;
- impossible timestamps;
- malformed coordinates;
- mismatched map metadata;
- practice content marked professional.

Validation should stop bad content from entering the production build where practical.

---

# 9. Stage 2 Exit Gate

Stage 2 passes when:

- Scenario semantics no longer depend on hidden UI assumptions;
- information boundaries are explicit;
- verification state is first-class;
- content has provenance;
- reusable validation catches structural mistakes;
- existing three Scenarios still behave correctly.

---

# 10. Stage 3 — Reasoning & Training Record

## Goal

Upgrade the product from “choice tracking” to “reasoning tracking”.

The audit established an important distinction:

> Recording whether a player changed the answer is not the same as recording whether the player improved the reasoning.

## 10.1 Minimum reasoning chain

For each round, preserve:

```text
initialCall
initialReasons
optionalFreeformReasoning
aiChallenge
aiSource
userResponseToChallenge
finalCall
changeReason
professionalReference
postRoundReflection
nextTrainingHypothesis
```

Not every field must initially be mandatory.

The architecture should support them.

---

## 10.2 Preserve AI intervention

A completed session should be able to reconstruct:

- what the user believed first;
- which facts/reasons they used;
- what AI challenged;
- whether AI was live or fallback;
- why the user stayed or changed;
- what they concluded after comparison.

This history must not be regenerated from the latest Scenario content.

It should be stored as a historical training record.

---

## 10.3 Distinguish decision quality from convergence

Do not use:

```text
closer to professional path = automatically better
```

as the core training metric.

Convergence may remain one descriptive signal, but it must not be treated as a universal performance score.

---

## 10.4 Create a next-training output

Every round or session should be capable of producing one actionable item such as:

```text
“Next time, test whether you identify when A-site space can be converted before rotating.”
```

or:

```text
“Your next task is to distinguish information gain from unnecessary delay in a 3v2.”
```

This can initially be rule-based.

It does not require a large AI report system.

---

## 10.5 Training record identity

A training record must be immutable enough to support later comparison.

Recommended conceptual identity:

```text
sessionId
scenarioId
scenarioVersion
startedAt
completedAt
```

Exact implementation is open.

---

# 11. Stage 3 Exit Gate

Stage 3 passes when:

- a past round can be reconstructed without guessing;
- AI intervention is preserved;
- live/fallback source is visible in the record;
- change/no-change reasoning can be reviewed;
- the session produces at least one actionable next-training item;
- refreshing or restarting does not silently destroy completed history.

---

# 12. Stage 4 — Dataset / Content Production Loop

## Goal

Make scenario production scalable **without prematurely building a massive platform**.

The long-term direction may include real `.dem` ingestion and semi-automated/automated scenario generation, but that is not required to repair the current product.

## 12.1 Content pipeline concept

The desired long-term flow is:

```text
Match / Scrim .dem
        ↓
Candidate event extraction
        ↓
Decision-node discovery
        ↓
ScenarioDraft
        ↓
Human verification / correction
        ↓
Scenario
        ↓
QA validation
        ↓
Published training set
```

The exact automation level may evolve.

---

## 12.2 ScenarioDraft and Scenario must remain distinct

A generated candidate is not trusted training data.

```text
ScenarioDraft ≠ Scenario
```

Drafts may contain:

- inferred player roles;
- candidate decision timestamps;
- proposed calls;
- automatically generated reason candidates;
- extracted positions;
- source references.

Only reviewed/published Scenarios should enter verified training.

---

## 12.3 Human review is part of the architecture

Human verification is not a temporary embarrassment to hide.

For tactical training data, human review is a legitimate production stage.

The system should make review cheaper and more consistent rather than pretending it can immediately be removed.

---

## 12.4 Dataset QA

As the content library grows, QA should cover:

- schema correctness;
- known/unknown information integrity;
- temporal leakage;
- tactical map correctness;
- option trade-off quality;
- reference-source validity;
- verification status;
- duplicate/similar scenarios;
- content versioning.

---

## 12.5 Content organization

Avoid one endless fixed sequence.

Future training should support organization by objectives such as:

- mid-round conversion;
- rotation timing;
- information discipline;
- utility risk;
- man-advantage decisions;
- retake/save decisions;
- trade structure;
- map-specific situations.

The exact taxonomy should be derived from real team use, not invented all at once.

---

# 13. Stage 4 Exit Gate

Stage 4 passes when:

- new scenarios can be produced without editing multiple unrelated UI modules;
- draft and verified content are clearly separated;
- QA catches common content mistakes;
- scenario versioning exists;
- the product can present unseen scenarios across multiple training sessions.

---

# 14. Stage 5 — Team Review & Comparison

## Goal

Support the minimum workflow needed by a captain, IGL, coach, or analyst.

Do **not** jump directly to a club-management system.

## 14.1 Minimum team handoff

The first acceptable implementation may be as simple as:

```text
player completes training
        ↓
exports/shareable result
        ↓
captain/coach collects results
        ↓
comparison view
```

A database/account system is optional at first.

---

## 14.2 Team comparison should focus on reasoning differences

Useful comparison questions include:

- Did players choose different Calls from the same information?
- Which facts did each player prioritize?
- Which players changed after challenge?
- What conditions caused disagreement?
- Did players disagree because of tactical philosophy, risk tolerance, or missed information?
- Which disagreements are worth replaying in practice?

The target is not merely a leaderboard.

---

## 14.3 Coach review

The minimum coach workflow should support:

- select or assign scenario set;
- inspect player reasoning;
- compare decisions;
- add a review conclusion or training target;
- preserve the result for the next session.

Real-time multiplayer is not required.

---

# 15. Stage 5 Exit Gate

Stage 5 passes when a small real team can complete:

```text
assign
→ individual judgment
→ collect
→ compare
→ discuss
→ leave next-session task
```

without relying on screenshots and manually reconstructing every player’s history.

---

# 16. Stage 6 — Production Hardening & Scale

Only enter this stage after the training loop itself proves useful.

Possible work includes:

- authentication;
- organization/team model;
- persistent cloud storage;
- role permissions;
- observability;
- structured analytics;
- content publishing workflow;
- public API protection;
- storage migration;
- large dataset distribution;
- background processing;
- `.dem` ingestion services;
- queue/worker architecture;
- model routing;
- deployment cost controls.

These are **scale solutions**, not proof of product value.

---

# 17. Explicit Non-Goals for the Current Repair Cycle

Do not build these merely because they may eventually be useful:

- full club management;
- subscription/payment;
- real-time multiplayer room;
- WebSocket collaboration;
- complex RBAC;
- large cloud database migration;
- full replay engine;
- complete automatic Demo parser pipeline;
- coach CMS;
- 5,000-scenario search system;
- personality radar charts;
- player “ability score”;
- large multi-agent architecture;
- multiple LLM providers;
- AI-generated long reports;
- animation-heavy redesign.

---

# 18. Severity & Execution Priority

Use the following order unless new evidence changes priority.

## P0 — Training trust

1. Tactical Preview teaches incorrect spatial relationships.

## P1 — Release blockers

2. Decision-time information leakage / mismatched media.  
3. Report reason-label corruption.  
4. Client request hang.  
5. Storage failure crash/block.  
6. Public AI cost/abuse boundary.  
7. AI unsupported factual claims.  
8. Unverified content represented as verified professional reference.

## P2 — Reliability / correctness

Examples include:

- invalid sessions producing `NaN%`;
- multi-tab reset collisions;
- report API trusting fabricated history;
- incorrect round description;
- missing map legend player;
- hidden live/fallback provenance;
- undersized touch targets.

P2 work may be grouped after release blockers unless it directly interferes with a current fix.

---

# 19. Required Test Layers

Every architecture stage should preserve or expand these layers.

## 19.1 Unit tests

Use for:

- domain invariants;
- reason identity;
- session reducers;
- parsing;
- content validation;
- fallback behavior.

## 19.2 Integration tests

Use for:

- API request/response contracts;
- timeout/fallback;
- storage degradation;
- Scenario → session → report consistency.

## 19.3 End-to-end tests

At minimum cover:

```text
initial judgment
→ AI agrees
→ continue
```

```text
initial judgment
→ AI disagrees
→ keep judgment
```

```text
initial judgment
→ AI disagrees
→ revise judgment
```

and:

- refresh/recovery;
- mobile width;
- timeout injection;
- storage failure injection.

## 19.4 Visual/content QA

Automated tests cannot replace tactical visual inspection.

For each verified Scenario, reviewers should inspect:

- map;
- positions;
- routes;
- labels;
- decision-time imagery;
- reference video;
- option descriptions.

---

# 20. Definition of Done for Any Architecture Change

An architecture task is **not complete** because the code compiles.

For any meaningful change, the implementer must provide:

```text
1. What problem was being solved?
2. Which verified audit issue or product requirement justified the change?
3. What code/domain boundary changed?
4. What was intentionally not changed?
5. What tests were added or updated?
6. What regression risks remain?
7. What evidence proves the user flow still works?
8. Does this unlock a later stage, or only repair the current one?
```

---

# 21. Change-Control Rules

Before making a **large architecture change**, stop and review if the change introduces any of the following:

- new persistent database;
- authentication/account model;
- team/organization domain;
- new backend service;
- queue/worker;
- new AI provider/model-routing layer;
- `.dem` parser service;
- major Scenario schema migration;
- public API redesign;
- replacement of the current session reducer/state machine;
- replacement of the core training flow.

These are not forbidden.

They require explicit architectural justification and should not be smuggled into a bug-fix task.

---

# 22. Agent Execution Contract

When an AI coding Agent receives this file:

## It should

- inspect the repository before proposing structural changes;
- map each change to a verified problem;
- prefer the smallest architecture that solves the current stage;
- preserve working semantics;
- add tests before claiming completion;
- run relevant regression suites;
- report blockers and uncertainty;
- distinguish repair from redesign;
- distinguish content problems from code problems.

## It should not

- “clean up” unrelated architecture during bug repair;
- replace stable code just because another pattern is fashionable;
- invent tactical facts;
- silently alter Scenario semantics;
- turn practice data into verified data;
- introduce infrastructure without a current requirement;
- claim production readiness solely from unit/build success.

---

# 23. Repository Documentation Recommendation

Recommended repository placement:

```text
/docs/architecture/CONNECTED_DECISIONS_ARCHITECTURE_UPGRADE_PLAYBOOK.md
```

Recommended related documents over time:

```text
/docs/architecture/
├── CONNECTED_DECISIONS_ARCHITECTURE_UPGRADE_PLAYBOOK.md
├── DOMAIN_MODEL.md
├── AI_CONTRACT.md
├── SCENARIO_SCHEMA.md
├── TRAINING_RECORD_SCHEMA.md
└── ADR/
```

Do not create all of these immediately.

Create them when the corresponding architecture actually exists.

---

# 24. Near-Term Execution Order

For the current upgrade cycle, follow this sequence:

```text
A. Freeze baseline
B. Fix Tactical Preview correctness
C. Fix information leakage / media semantics
D. Fix reason identity and report correctness
E. Add client timeout + recovery
F. Harden storage failure handling
G. Add AI cost / abuse boundaries
H. Strengthen AI factual boundary
I. Isolate verified / practice content
J. Re-run full production audit
```

Only after **J** passes should the team decide how much of Stage 2–3 to implement immediately.

---

# 25. Architecture Decision Principle

When there are multiple technically valid solutions, choose based on:

1. correctness;
2. user trust;
3. training value;
4. ability to verify;
5. maintainability;
6. future extensibility;
7. implementation cost.

Do **not** rank “future extensibility” above present correctness.

---

# 26. Final Target

The long-term target is not simply:

> “a CS2 website with AI.”

It is:

> **A trustworthy CS2 decision-analysis and review system that turns real match situations into reproducible training scenarios, records how players reason, pressure-tests those judgments, and allows players or teams to compare and improve decision-making over time.**

The path to that target is:

```text
Trustworthy scenario
    ↓
Faithful reasoning record
    ↓
Actionable review loop
    ↓
Repeatable content production
    ↓
Team comparison
    ↓
Production scale
```

If a proposed architecture upgrade does not strengthen one of these links, it is probably not the next priority.

---

# Appendix A — Verified Audit Baseline

The baseline audit established:

- existing automated tests passed;
- TypeScript passed;
- ESLint passed;
- production build passed after network access was available;
- production server started successfully;
- the three-round flow completed;
- refresh recovery worked in the normal path;
- fallback and live AI branches were exercised;
- tactical/content/reliability failures were still reproducible.

This means the project should be treated as a **working prototype with verified product and reliability defects**, not as a broken codebase requiring a rewrite.

---

# Appendix B — Release Readiness Gate

The product may be reconsidered for limited real-team testing when all of the following are true:

- [ ] Tactical maps and routes are correct.
- [ ] Decision-time evidence contains no hidden/future information.
- [ ] Reason records are exact.
- [ ] Practice and verified content are separated.
- [ ] AI challenge requests cannot hang indefinitely.
- [ ] Storage failures degrade safely.
- [ ] Public AI calls have a tested cost/abuse boundary.
- [ ] AI factual output is bounded by Scenario evidence.
- [ ] A complete reasoning chain can be reviewed.
- [ ] Each session can leave a concrete next-training task.
- [ ] Training history can be preserved/exported.
- [ ] Full regression and production audit passes.
- [ ] At least one small real-team trial is conducted before claiming real training-product readiness.

---

# Appendix C — Guiding Sentence

> **Do not build the final platform before the current training loop is trustworthy. Fix truth, preserve reasoning, close the learning loop, then scale.**
