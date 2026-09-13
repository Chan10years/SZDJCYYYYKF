# Gate 2 Reasoning & Training Record Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将完成后的训练记录从“Call 是否改变”扩展为可复盘的 reasoning chain：初始依据、AI 实际 Challenge 与 live/fallback 来源、用户坚持/改判理由，以及本局 takeaway / next check。

**Architecture:** 在现有 `ExperienceState` 和显式 reducer phase 上增加最小的受控字段与动作，不改变 `Situation → Initial Call → Reasons → AI Challenge → Keep / Revise → Tactical Preview → Professional Reference → Review` 顺序。`RoundResult` 保存 Challenge 与 Professional Reference 的历史快照；旧 session 的新增字段通过 Zod 默认/可选字段兼容，报告从历史记录渲染 reasoning chain，不从当前 Scenario 重新猜测。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Zod, Vitest, React Testing Library, Tailwind CSS, pnpm.

**Spec:** `TASKS.md` Gate 2 — Second Coach Enhancement；`PRODUCTION.md` 第 10 节；`docs/architecture/CONNECTED_DECISIONS_ARCHITECTURE_UPGRADE_PLAYBOOK.md` 第 10–11、19–20 节。

## Global Constraints

- 保持用户先独立判断、AI 作为第二意见、Professional Reference 不是标准答案的产品原则。
- 只扩展当前 session/reducer、既有页面和报告，不引入数据库、登录、Team Domain、新服务、Worker、队列、大型 Schema Migration、reducer 替换或 Tactical Preview 替换。
- `draft / practice / verified` 语义不变；不进入 Gate 3 内容包或 Human QA。
- AI 失败仍走现有 deterministic fallback；记录必须显示 `live` / `fallback` 来源。
- 不新增人格评分、正确率、能力模型，也不把 Professional Alignment 当作训练成绩。
- 先写并运行失败测试，再写对应 production code；每个主要切片运行针对性测试。

---

### Task 1: Define the reasoning-record contract and rule-based next check

**Files:**
- Create: `src/domain/trainingRecord.ts`
- Modify: `src/domain/schemas.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/sessionSchema.ts`
- Modify: `src/test/storage.test.ts`
- Modify: `src/test/freshEntry.test.ts`
- Test: `src/test/trainingRecord.test.ts`

**Interfaces:**
- Produces `ChallengeResponse = "keep" | "revise"`, `buildNextTrainingHypothesis({ initialCall, finalCall, challenge })`, and optional historical fields on `RoundResult`.
- `RoundResult` adds `optionalFreeformReasoning`, full `aiChallenge`, `userResponseToChallenge`, `changeReason`, `professionalReference`, `postRoundReflection`, and `nextTrainingHypothesis`; old persisted rounds may omit the new fields and must render as unavailable rather than guessed.

- [ ] **Step 1: Write the failing pure-function and schema tests.**

At the top of `src/test/trainingRecord.test.ts`, reuse `scenarios[0]` as `scenario`, define the existing `challenge` fixture from `src/test/reducer.test.ts`, and define `legacyRound` with the current required `RoundResult` fields. The test file must import `RoundResultSchema`, `buildNextTrainingHypothesis`, and `scenarios`; these are the complete fixtures used by the snippets below.

```ts
it("builds a check for the exact response path without judging correctness", () => {
  expect(buildNextTrainingHypothesis({
    initialCall: "A",
    finalCall: "B",
    challenge,
  })).toContain("改判前要验证的条件");
});

it("preserves a full challenge and optional reflection fields in a round result", () => {
  const parsed = RoundResultSchema.parse({
    ...legacyRound,
    optionalFreeformReasoning: "先确认空间。",
    aiChallenge: challenge,
    userResponseToChallenge: "keep",
    changeReason: "这个风险还不足以改变我的判断。",
    professionalReference: scenario.professional,
    postRoundReflection: "我忽略了时间窗口。",
    nextTrainingHypothesis: "下一次先检查时间窗口。",
  });
  expect(parsed.aiChallenge).toEqual(challenge);
  expect(parsed.nextTrainingHypothesis).toBe("下一次先检查时间窗口。");
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the new contract is absent.**

Run: `pnpm test -- src/test/trainingRecord.test.ts`

Expected: FAIL with missing `buildNextTrainingHypothesis` / new schema fields, not a test-environment error.

- [ ] **Step 3: Add the smallest contract implementation.**

Use the existing `ChallengeOutput` and `RoundResult` types. The next-check helper must only refer to the recorded response path: changed calls mention validating the condition before switching; kept challenged calls mention checking the AI blind spot before keeping; agreed calls mention restating the key initial condition. Do not invent map, player, economy, or outcome facts.

- [ ] **Step 4: Run the focused test and the schema regression tests.**

Run: `pnpm test -- src/test/trainingRecord.test.ts src/test/schemas.test.ts`

Expected: PASS, with legacy `RoundResult` data still accepted where the new historical fields are absent.

- [ ] **Step 5: Commit the contract slice.**

```bash
git add src/domain/trainingRecord.ts src/domain/schemas.ts src/domain/types.ts src/domain/sessionSchema.ts src/test/trainingRecord.test.ts src/test/storage.test.ts src/test/freshEntry.test.ts
git commit -m "feat: define Gate 2 reasoning record contract"
```

### Task 2: Capture initial reasoning and Challenge response in the existing flow

**Files:**
- Modify: `src/domain/experienceReducer.ts`
- Modify: `src/components/experience/ExperienceShell.tsx`
- Modify: `src/components/experience/DecisionScreen.tsx`
- Modify: `src/components/experience/ChallengeScreen.tsx`
- Modify: `src/test/reducer.test.ts`
- Modify: `src/test/challengeScreen.test.tsx`

**Interfaces:**
- `ExperienceState` owns `optionalFreeformReasoning`, `userResponseToChallenge`, and `changeReason` so refresh retains in-progress input.
- New actions are `SET_INITIAL_REASONING`, `SET_CHANGE_REASON`, and `RESPOND_TO_CHALLENGE`; legacy keep/alternative actions remain safe for old callers but the UI uses the new response action.

- [ ] **Step 1: Add failing reducer tests for state capture and guarded response.**

```ts
it("stores initial reasoning and requires a response reason before leaving Challenge", () => {
  const decision = experienceReducer(decisionState, {
    type: "SET_INITIAL_REASONING",
    value: "先确认已知信息，再比较风险。",
  });
  const challenged = experienceReducer(decision, { type: "REQUEST_CHALLENGE" });
  const blocked = experienceReducer(challenged, {
    type: "RESPOND_TO_CHALLENGE",
    response: "keep",
  });
  expect(blocked.phase).toBe("challenge");

  const answered = experienceReducer(
    { ...challenged, changeReason: "这个风险仍不足以改变我的判断。" },
    { type: "RESPOND_TO_CHALLENGE", response: "keep" },
  );
  expect(answered.userResponseToChallenge).toBe("keep");
  expect(answered.finalCall).toBe(answered.initialCall);
  expect(answered.phase).toBe("preview");
});
```

- [ ] **Step 2: Run the reducer test and verify the new assertions fail.**

Run: `pnpm test -- src/test/reducer.test.ts`

Expected: FAIL because the actions and fields do not yet exist.

- [ ] **Step 3: Implement reducer/state changes and wire the two existing screens.**

Add a controlled optional textarea to `DecisionScreen`. Add a controlled response-reason textarea to `ChallengeScreen`; disable Keep/Revise until it contains non-whitespace text. Keep the current AI loading, source label, and two equal actions. The revise action is valid only when `alternativeCall` exists.

- [ ] **Step 4: Run focused reducer and component tests.**

Run: `pnpm test -- src/test/reducer.test.ts src/test/challengeScreen.test.tsx`

Expected: PASS, including the existing fallback-source assertion and all phase-guard tests.

- [ ] **Step 5: Commit the capture slice.**

```bash
git add src/domain/experienceReducer.ts src/components/experience/ExperienceShell.tsx src/components/experience/DecisionScreen.tsx src/components/experience/ChallengeScreen.tsx src/test/reducer.test.ts src/test/challengeScreen.test.tsx
git commit -m "feat: capture initial reasoning and challenge response"
```

### Task 3: Capture review takeaway and create immutable completed records

**Files:**
- Modify: `src/domain/experienceReducer.ts`
- Modify: `src/components/experience/ExperienceShell.tsx`
- Modify: `src/components/experience/RoundReviewScreen.tsx`
- Modify: `src/test/reducer.test.ts`
- Modify: `src/test/reviewSemantics.test.tsx`

**Interfaces:**
- Review state owns `postRoundReflection` and `nextTrainingHypothesis`; entering Review seeds the latter with `buildNextTrainingHypothesis` when empty.
- `COMPLETE_ROUND` snapshots the full `ChallengeOutput` and `scenario.professional` into `RoundResult`, plus all user-entered reasoning fields, before clearing the next-round state.

- [ ] **Step 1: Add failing tests for historical snapshot and review fields.**

Reuse the existing `challenge`, `reviewState`, and `scenarios` fixtures already present in `src/test/reducer.test.ts`; `reviewState` must also contain the new state fields with empty strings/nulls so the expected snapshot is explicit.

```ts
it("completes a round with the full reasoning chain and next check", () => {
  const completed = experienceReducer(
    {
      ...reviewState,
      optionalFreeformReasoning: "先确认空间，再决定是否提速。",
      userResponseToChallenge: "keep",
      changeReason: "AI 提到的风险还没有改变关键条件。",
      postRoundReflection: "我需要更明确地说出关键条件。",
      nextTrainingHypothesis: "下一次先检查关键条件是否仍成立。",
    },
    { type: "COMPLETE_ROUND" },
  );
  expect(completed.completedRounds[0]).toMatchObject({
    optionalFreeformReasoning: "先确认空间，再决定是否提速。",
    aiChallenge: challenge,
    userResponseToChallenge: "keep",
    changeReason: "AI 提到的风险还没有改变关键条件。",
    professionalReference: scenarios[0].professional,
    postRoundReflection: "我需要更明确地说出关键条件。",
    nextTrainingHypothesis: "下一次先检查关键条件是否仍成立。",
  });
});
```

- [ ] **Step 2: Run the focused reducer/review tests and verify the new assertions fail.**

Run: `pnpm test -- src/test/reducer.test.ts src/test/reviewSemantics.test.tsx`

Expected: FAIL because completed rounds do not yet contain the historical chain or review inputs.

- [ ] **Step 3: Implement the controlled Review fields and snapshot logic.**

Keep the existing tactical/professional comparison and button labels. Add only two review inputs: optional “本局 takeaway/反思” and editable “下一次检查”; use the rule-based suggestion as the initial next check. Reset both fields after `COMPLETE_ROUND`.

- [ ] **Step 4: Run focused tests and storage tests.**

Run: `pnpm test -- src/test/reducer.test.ts src/test/reviewSemantics.test.tsx src/test/storage.test.ts`

Expected: PASS, including three-round summary and refresh round-trip behavior.

- [ ] **Step 5: Commit the completed-record slice.**

```bash
git add src/domain/experienceReducer.ts src/components/experience/ExperienceShell.tsx src/components/experience/RoundReviewScreen.tsx src/test/reducer.test.ts src/test/reviewSemantics.test.tsx
git commit -m "feat: preserve completed reasoning chain"
```

### Task 4: Render the historical reasoning chain in the report

**Files:**
- Create: `src/components/report/ReasoningChain.tsx`
- Modify: `src/components/experience/ConnectionReportScreen.tsx`
- Modify: `src/components/report/ConnectionTrajectory.tsx`
- Modify: `src/domain/stats.ts`
- Modify: `src/test/reportScreen.test.tsx`
- Modify: `src/test/stats.test.ts`

**Interfaces:**
- `ReasoningChain` consumes `RoundResult[]` and the current `scenarioPool`, but uses stored `aiChallenge`/`professionalReference` snapshots whenever available.
- Missing fields from pre-Gate-2 saved records are shown as “旧记录未保存” / “未补充”，never reconstructed as facts.

- [ ] **Step 1: Add failing report tests.**

Extend the existing `round()` helper in `src/test/reportScreen.test.tsx` with a `richReasoningRound` fixture for `scenarios[0]`, including the exact strings asserted below, `aiChallenge` equal to the fallback `challenge`, `userResponseToChallenge: "keep"`, and `professionalReference: scenarios[0].professional`.

```tsx
it("shows the saved initial reasoning, exact Challenge, response reason, and next check", () => {
  render(<ConnectionReportScreen rounds={[richReasoningRound]} onReset={vi.fn()} />);
  expect(screen.getByText("先确认空间，再比较风险。"))
    .toBeInTheDocument();
  expect(screen.getByText("针对初始 Call 的反问。"))
    .toBeInTheDocument();
  expect(screen.getByText("这个风险仍不足以改变我的判断。"))
    .toBeInTheDocument();
  expect(screen.getByText("下一次先检查关键条件。"))
    .toBeInTheDocument();
  expect(screen.getByText("来源：程序化 fallback"))
    .toBeInTheDocument();
});
```

- [ ] **Step 2: Run the report test and verify it fails because the report has no reasoning chain.**

Run: `pnpm test -- src/test/reportScreen.test.tsx src/test/stats.test.ts`

Expected: FAIL only on the new history assertions.

- [ ] **Step 3: Implement a compact report history section.**

Add one expandable “训练记录” entry per completed round after the trajectory. Show initial Call/reasons/freeform reasoning, full stored AI Challenge and source, Keep/Revise plus change reason, stored reference label, post-round reflection, and next check. Keep alignment metrics as descriptive observations and pass `scenarioPool` into stats so practice pools do not look up unrelated default scenarios.

- [ ] **Step 4: Run report, trajectory, and full unit tests.**

Run: `pnpm test -- src/test/reportScreen.test.tsx src/test/stats.test.ts src/test/reviewSemantics.test.tsx` then `pnpm test`.

Expected: all tests pass; old records render truthful unavailable labels.

- [ ] **Step 5: Commit the report slice.**

```bash
git add src/components/report/ReasoningChain.tsx src/components/experience/ConnectionReportScreen.tsx src/components/report/ConnectionTrajectory.tsx src/domain/stats.ts src/test/reportScreen.test.tsx src/test/stats.test.ts
git commit -m "feat: show reasoning chain in connection report"
```

### Task 5: Full verification, browser flow, and Git handoff

**Files:**
- Modify only files already covered by Tasks 1–4 if verification exposes a Gate 2 regression.
- Do not create Gate 3 content or Human QA assets.

- [ ] **Step 1: Run the complete automated checks from `web`.**

Run each command freshly and record exit code/output:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

- [ ] **Step 2: Start the existing Next.js app and run a real browser flow.**

Use the Playwright CLI wrapper after checking `npx`. In a fresh browser context complete at least one round: enter a freeform initial reason, choose Call/reasons, wait for and verify the visible `来源：程序化 fallback` path when no live AI key is configured, enter a Keep/Revise reason, enter/edit takeaway and next check, complete the round, refresh at Review/summary, and verify the saved reasoning chain remains. Also run one live-path-compatible UI flow with the existing request flag if a live response is available; report live as unverified if the environment cannot provide it.

- [ ] **Step 3: Perform reverse self-check.**

Inspect `git diff --check`, `git status --short --branch`, `git log -1`, and the final diff. Confirm no database/auth/service/Team/schema migration/reducer replacement/Tactical Preview or Gate 3 files were added; confirm source labels are historical and fallback text is not presented as live.

- [ ] **Step 4: Commit any verification-only fix, then report and stop.**

Use a focused `fix:` commit only if a fresh verification failure requires it. Final report must be Chinese and include resolved problem, changed files, why, what was not changed, tests, browser evidence, residual risks, HEAD, workspace state, and Scope Drift; do not start Reviewer.
