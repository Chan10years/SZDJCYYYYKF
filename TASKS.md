# TASKS.md

# Connected Decisions MVP 开发执行计划

> **给 coding agent：** 必须按任务顺序逐项执行，每个 Task 完成后都要经过一次独立验证。若环境中安装了 Superpowers，优先使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。所有步骤均使用本文件中的 checkbox 追踪。

**目标：** 完成一个 Mobile-first Game Jam 原型，证明以下 Connection 机制：  
**人类独立判断 → AI 第二意见 → 人类重新判断 → 职业路径参照 → Connection 行为分析。**

**架构：** 单一 Next.js App Router 应用，放在 `web/`。主交互由显式 reducer 驱动。Scenario 内容全部类型化并通过 Zod 校验。Session 只存在 React state 与 `localStorage`。所有 AI 调用都在服务端完成，必须有 schema 校验、超时和 deterministic fallback。

**技术栈：**

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- Zod
- Framer Motion
- Vitest
- React Testing Library
- pnpm

**产品规格：** `PRODUCTION.md`

---

# 全局开发约束

- 应用位于 `web/`。
- 包管理器只用 pnpm。
- 不使用数据库。
- 不做登录。
- 不引入额外状态管理库。
- MVP 不引入图表库。
- 职业路径只能表达为 Reference，不能表达为 Correct Answer。
- 三局只能支持“小样本行为观察”。
- Hero 为完整实现，Scenario 2/3 只做复用验证。
- Tactical Preview 只展示预设空间意义，不模拟未来。
- AI Key 只能在服务端。
- live AI 失败不能阻断用户流程。
- 所有运行时内容必须通过 Zod。
- 正式 Scenario 只有经过人工核验才可 `verified: true`。
- Mobile-first 基准宽度 430–440 CSS px。
- Release 前必须全部通过：

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

---

# 优先级定义

- **P0：** 不完成就无法证明核心机制。
- **P1：** 不完成就不适合提交。
- **P2：** 只在已有 Release Candidate 后做。

只要存在未完成 P0/P1，就禁止开始 P2。

---

# 目标文件结构

```text
/
├─ AGENTS.md
├─ PRODUCTION.md
├─ TASKS.md
├─ README.md
├─ AI_COLLAB_LOG.md
└─ web/
   ├─ .env.example
   ├─ package.json
   ├─ vitest.config.ts
   ├─ src/
   │  ├─ app/
   │  │  ├─ api/
   │  │  │  ├─ challenge/route.ts
   │  │  │  └─ report/route.ts
   │  │  ├─ globals.css
   │  │  ├─ layout.tsx
   │  │  └─ page.tsx
   │  ├─ components/
   │  │  ├─ experience/
   │  │  │  ├─ ExperienceShell.tsx
   │  │  │  ├─ IntroScreen.tsx
   │  │  │  ├─ SituationScreen.tsx
   │  │  │  ├─ DecisionScreen.tsx
   │  │  │  ├─ ChallengeScreen.tsx
   │  │  │  ├─ TacticalPreviewScreen.tsx
   │  │  │  ├─ ProfessionalReferenceScreen.tsx
   │  │  │  ├─ RoundReviewScreen.tsx
   │  │  │  └─ ConnectionReportScreen.tsx
   │  │  ├─ tactical/
   │  │  │  └─ TacticalPreview.tsx
   │  │  └─ report/
   │  │     ├─ ConnectionTrajectory.tsx
   │  │     ├─ DonutMetric.tsx
   │  │     └─ MetricCard.tsx
   │  ├─ data/
   │  │  ├─ scenarios.fixture.ts
   │  │  └─ scenarios.ts
   │  ├─ domain/
   │  │  ├─ schemas.ts
   │  │  ├─ types.ts
   │  │  ├─ experienceReducer.ts
   │  │  ├─ sessionSchema.ts
   │  │  ├─ stats.ts
   │  │  └─ fallback.ts
   │  ├─ lib/
   │  │  ├─ aiClient.ts
   │  │  ├─ aiParsing.ts
   │  │  └─ storage.ts
   │  └─ test/
   │     ├─ setup.ts
   │     ├─ smoke.test.ts
   │     ├─ schemas.test.ts
   │     ├─ reducer.test.ts
   │     ├─ stats.test.ts
   │     ├─ fallback.test.ts
   │     ├─ aiParsing.test.ts
   │     └─ storage.test.ts
   └─ public/
      ├─ maps/
      └─ media/
         └─ scenarios/
```

---

# 固定 Domain 接口

以下命名是 canonical contract。除非修改规格文档，否则 agent 不得随意重命名。

```ts
export type CallId = "A" | "B" | "C";

export type ReasonId =
  | "numbers_advantage"
  | "known_position"
  | "time_pressure"
  | "utility_advantage"
  | "unknown_space"
  | "resource_preservation";

export type ExperiencePhase =
  | "intro"
  | "situation"
  | "decision"
  | "challenge"
  | "preview"
  | "reference"
  | "review"
  | "summary";
```

AI Challenge 固定结构：

```ts
export type ChallengeOutput = {
  stance: "agree" | "challenge";
  acknowledge: string;
  blindspot: string;
  question: string;
  alternativeCall: CallId | null;
  source: "live" | "fallback";
};
```

RoundResult：

```ts
export type RoundResult = {
  scenarioId: string;
  initialCall: CallId;
  reasonIds: ReasonId[];
  aiStance: "agree" | "challenge";
  aiAlternativeCall: CallId | null;
  aiResponseSource: "live" | "fallback";
  finalCall: CallId;
  changedAfterAI: boolean;
  professionalCall: CallId;
  completedAt: string;
};
```

ConnectionStats：

```ts
export type ConnectionStats = {
  totalRounds: number;
  disagreementCount: number;
  acceptanceCount: number;
  persistenceCount: number;
  initialProfessionalAlignmentCount: number;
  finalProfessionalAlignmentCount: number;
  reasonFrequency: Record<ReasonId, number>;
};
```

---

# Task 1 — 初始化应用与测试基础设施 [P0]

**交付结果：** `web/` 下存在可启动的 Next.js 项目，TypeScript strict、Tailwind、Vitest、Testing Library、Zod、Framer Motion 均已配置。

**文件：**

- Create: `web/`
- Create: `web/vitest.config.ts`
- Create: `web/src/test/setup.ts`
- Create: `web/src/test/smoke.test.ts`
- Modify: `web/package.json`
- Create: `web/.env.example`
- Create: `README.md`
- Create: `AI_COLLAB_LOG.md`

**产出接口：**

- scripts：`dev`、`build`、`start`、`lint`、`typecheck`、`test`、`test:watch`
- `.env.example` 中定义 AI 环境变量

- [ ] **Step 1：创建 Next.js 项目**

仓库根目录执行：

```bash
pnpm create next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

验收：

- `web/package.json` 存在；
- `web/src/app/page.tsx` 可渲染；
- `pnpm dev` 可启动。

- [ ] **Step 2：安装最小依赖**

```bash
cd web
pnpm add zod framer-motion
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

验收：

- 安装无阻断 build 的依赖冲突。

- [ ] **Step 3：补齐 package scripts**

`web/package.json` 至少包含：

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4：创建 `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 5：创建测试 setup**

`web/src/test/setup.ts`：

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6：创建 smoke test**

`web/src/test/smoke.test.ts`：

```ts
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs Vitest successfully", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 7：创建 `.env.example`**

```dotenv
AI_BASE_URL=https://api.example.com/v1
AI_API_KEY=
AI_MODEL=fast-chat-model
AI_CHALLENGE_TIMEOUT_MS=3500
AI_REPORT_TIMEOUT_MS=6500
```

不能放真实 Key。

- [ ] **Step 8：创建 README**

根目录 README 至少写明：

```text
Project: Connected Decisions
App directory: web
Package manager: pnpm

Development:
cd web
pnpm install
pnpm dev

Checks:
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

并说明：

> 即使未配置 AI Key，fallback 也应该能跑完整核心流程。

- [ ] **Step 9：创建 `AI_COLLAB_LOG.md`**

初始模板：

```markdown
# AI Collaboration Log

记录 AI 对概念、视觉、开发、调试、验证产生实质影响的节点。

## Entry Format

- Time:
- Tool/model:
- Task:
- Human decision before AI:
- AI contribution:
- Adopted:
- Rejected:
- Reason:
- Artifact/code affected:
```

第一条应记录：

> Scope 从“三个完整 Scenario”收缩为“1 Hero + 2 Lite”。

- [ ] **Step 10：执行基础检查**

```bash
cd web
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

全部通过。

- [ ] **Step 11：Commit**

```bash
git add AGENTS.md PRODUCTION.md TASKS.md README.md AI_COLLAB_LOG.md web
git commit -m "chore: scaffold connected decisions app"
```

---

# Task 2 — 建立 Scenario Domain Model 与 Zod 校验 [P0]

**交付结果：** 有稳定 Scenario Schema、类型定义、三个开发 Fixture。

**文件：**

- Create: `web/src/domain/schemas.ts`
- Create: `web/src/domain/types.ts`
- Create: `web/src/data/scenarios.fixture.ts`
- Create: `web/src/data/scenarios.ts`
- Test: `web/src/test/schemas.test.ts`

**输出接口：**

- `ScenarioSchema`
- `Scenario`
- `RoundResult`
- `ChallengeOutput`
- `ConnectionStats`
- `scenarios: Scenario[]`

- [ ] **Step 1：先写 schema 测试**

创建 `schemas.test.ts`，至少覆盖：

```ts
import { describe, expect, it } from "vitest";
import { ScenarioSchema } from "@/domain/schemas";
import { fixtureScenarios } from "@/data/scenarios.fixture";

describe("ScenarioSchema", () => {
  it("accepts all development fixtures", () => {
    for (const scenario of fixtureScenarios) {
      expect(ScenarioSchema.parse(scenario)).toEqual(scenario);
    }
  });

  it("rejects a Tactical Preview point outside normalized map bounds", () => {
    const invalid = structuredClone(fixtureScenarios[0]);
    invalid.previewByCall.A.routes[0].points[0].x = 101;
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });

  it("rejects more than three call options", () => {
    const invalid = structuredClone(fixtureScenarios[0]);
    invalid.calls.push({
      id: "A",
      label: "duplicate",
      description: "invalid duplicate",
    });
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });
});
```

- [ ] **Step 2：运行并确认失败**

```bash
cd web
pnpm test -- schemas.test.ts
```

Expected：

> FAIL，因为 schema / fixture 尚不存在。

- [ ] **Step 3：实现 `schemas.ts`**

定义 Zod Schema：

```text
CallId
ReasonId
ExperiencePhase
Point
PreviewRoute
PreviewZone
PreviewMetric
TacticalPreviewSpec
ScenarioFact
ScenarioSource
CallOption
ChallengeGuidance
ProfessionalReference
Scenario
ChallengeOutput
RoundResult
```

必须限制：

```text
Point.x/y: 0..100
Scenario.calls: exactly 3
Scenario.reasonOptions: 3..6
RoundResult.reasonIds: 1..2
Scenario.verified: boolean
```

`ScenarioSource`：

```ts
{
  event: string;
  match: string;
  map: string;
  round: number;
  sourceLabel: string;
  sourceUrl?: string;
}
```

`ProfessionalReference`：

```ts
{
  call: CallId;
  pathLabel: string;
  outcome: string;
  observations: string[];
  clipSrc?: string;
}
```

`observations` 限制为 1–3 项。

- [ ] **Step 4：实现 `types.ts`**

优先使用 `z.infer`：

```ts
import { z } from "zod";
import {
  ChallengeOutputSchema,
  RoundResultSchema,
  ScenarioSchema,
} from "./schemas";

export type Scenario = z.infer<typeof ScenarioSchema>;
export type ChallengeOutput = z.infer<typeof ChallengeOutputSchema>;
export type RoundResult = z.infer<typeof RoundResultSchema>;
```

`ExperiencePhase` 从对应 schema 推导。

`ConnectionStats` 按本文件前面固定接口定义。

- [ ] **Step 5：创建三个明确为开发用途的 Fixture**

`scenarios.fixture.ts`：

```ts
export const fixtureScenarios: Scenario[] = [...]
```

规则：

- `verified: false`；
- 赛事/比赛名必须显式包含 `Practice Fixture`；
- 不冒充真实比赛；
- 三局冲突类型不同；
- 每局正好 3 个 Calls；
- Reason Options 为 3–6 个；
- A/B/C 都有 `previewByCall`；
- 每局有 `challengeGuidance`；
- 职业参考标注 `Practice Reference`。

Hero fixture 可使用：

```text
3v2
31 seconds
A 区信息更明确
B 区更未知
```

但必须明确是 Fixture。

- [ ] **Step 6：创建 `scenarios.ts`**

```ts
import { ScenarioSchema } from "@/domain/schemas";
import { fixtureScenarios } from "./scenarios.fixture";

export const scenarios = fixtureScenarios.map((scenario) =>
  ScenarioSchema.parse(scenario),
);
```

禁止 catch 后静默吞掉验证错误。

- [ ] **Step 7：运行测试**

```bash
pnpm test -- schemas.test.ts
pnpm typecheck
```

- [ ] **Step 8：Commit**

```bash
git add web/src/domain web/src/data web/src/test/schemas.test.ts
git commit -m "feat: define scenario domain model"
```

---

# Task 3 — 实现 Connection Statistics [P0]

**交付结果：** 最终报告所有数字都来自纯函数。

**文件：**

- Create: `web/src/domain/stats.ts`
- Test: `web/src/test/stats.test.ts`

**接口：**

```ts
calculateConnectionStats(rounds: RoundResult[]): ConnectionStats
```

- [ ] **Step 1：写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { calculateConnectionStats } from "@/domain/stats";
import type { RoundResult } from "@/domain/types";

const rounds: RoundResult[] = [
  {
    scenarioId: "s1",
    initialCall: "A",
    reasonIds: ["known_position"],
    aiStance: "challenge",
    aiAlternativeCall: "B",
    aiResponseSource: "live",
    finalCall: "B",
    changedAfterAI: true,
    professionalCall: "B",
    completedAt: "2026-09-05T12:00:00.000Z",
  },
  {
    scenarioId: "s2",
    initialCall: "B",
    reasonIds: ["numbers_advantage", "time_pressure"],
    aiStance: "challenge",
    aiAlternativeCall: "C",
    aiResponseSource: "fallback",
    finalCall: "B",
    changedAfterAI: false,
    professionalCall: "A",
    completedAt: "2026-09-05T12:01:00.000Z",
  },
  {
    scenarioId: "s3",
    initialCall: "C",
    reasonIds: ["resource_preservation"],
    aiStance: "agree",
    aiAlternativeCall: null,
    aiResponseSource: "live",
    finalCall: "C",
    changedAfterAI: false,
    professionalCall: "C",
    completedAt: "2026-09-05T12:02:00.000Z",
  },
];

describe("calculateConnectionStats", () => {
  it("calculates disagreement, acceptance, persistence and alignment correctly", () => {
    expect(calculateConnectionStats(rounds)).toMatchObject({
      totalRounds: 3,
      disagreementCount: 2,
      acceptanceCount: 1,
      persistenceCount: 1,
      initialProfessionalAlignmentCount: 1,
      finalProfessionalAlignmentCount: 2,
    });
  });

  it("counts selected reasons", () => {
    const stats = calculateConnectionStats(rounds);
    expect(stats.reasonFrequency.known_position).toBe(1);
    expect(stats.reasonFrequency.numbers_advantage).toBe(1);
    expect(stats.reasonFrequency.time_pressure).toBe(1);
    expect(stats.reasonFrequency.resource_preservation).toBe(1);
  });
});
```

- [ ] **Step 2：运行并确认失败**

```bash
pnpm test -- stats.test.ts
```

- [ ] **Step 3：实现统计逻辑**

定义：

```text
disagreement:
  aiAlternativeCall != null
  AND aiAlternativeCall != initialCall

acceptance:
  disagreement
  AND finalCall == aiAlternativeCall

persistence:
  disagreement
  AND finalCall == initialCall

initialProfessionalAlignment:
  initialCall == professionalCall

finalProfessionalAlignment:
  finalCall == professionalCall
```

所有 `ReasonId` 初始频次必须是 0。

- [ ] **Step 4：运行**

```bash
pnpm test -- stats.test.ts
pnpm typecheck
```

- [ ] **Step 5：Commit**

```bash
git add web/src/domain/stats.ts web/src/test/stats.test.ts
git commit -m "feat: calculate connection statistics"
```

---

# Task 4 — 实现 deterministic fallback Challenge [P0]

**交付结果：** 无网络、无 AI 时也能根据 Reason 和 Scenario 给出合理 Challenge。

**文件：**

- Create: `web/src/domain/fallback.ts`
- Test: `web/src/test/fallback.test.ts`

**接口：**

```ts
buildFallbackChallenge(
  scenario: Scenario,
  initialCall: CallId,
  reasonIds: ReasonId[],
): ChallengeOutput
```

- [ ] **Step 1：写测试**

必须验证：

- acknowledge 包含用户选择的 Reason Label；
- blindspot 来自 scenario-specific guidance；
- `source === "fallback"`；
- alternativeCall 正确；
- 结果中不能出现：
  - `正确答案`
  - `答错`
  - `必然`

- [ ] **Step 2：确认失败**

```bash
pnpm test -- fallback.test.ts
```

- [ ] **Step 3：实现 fallback**

算法固定：

1. 从 `scenario.reasonOptions` 找到 Reason Label；
2. 一个 Reason：
   > `你把「X」作为主要依据。`
3. 两个 Reason：
   > `你主要依据「X」和「Y」做出判断。`
4. 读取：
   `scenario.challengeGuidance[initialCall]`
5. 返回 blindspot / question / alternative；
6. `source: "fallback"`。

禁止随机文本。

- [ ] **Step 4：运行**

```bash
pnpm test -- fallback.test.ts
pnpm typecheck
```

- [ ] **Step 5：Commit**

```bash
git add web/src/domain/fallback.ts web/src/test/fallback.test.ts
git commit -m "feat: add challenge fallback"
```

---

# Task 5 — 实现显式状态机与 Session Persistence [P0]

**交付结果：** 完整 reducer 流程 + 刷新恢复。

**文件：**

- Create: `web/src/domain/experienceReducer.ts`
- Create: `web/src/domain/sessionSchema.ts`
- Create: `web/src/lib/storage.ts`
- Test: `web/src/test/reducer.test.ts`
- Test: `web/src/test/storage.test.ts`

**状态结构：**

```ts
export type ExperienceState = {
  phase: ExperiencePhase;
  scenarioIndex: number;
  initialCall: CallId | null;
  reasonIds: ReasonId[];
  challenge: ChallengeOutput | null;
  finalCall: CallId | null;
  completedRounds: RoundResult[];
};
```

- [ ] **Step 1：先写 reducer 测试**

至少覆盖：

1. 初始 `intro`
2. `START` → `situation`
3. `BEGIN_DECISION` → `decision`
4. 选择 Call / Reason 不自动跳页
5. `REQUEST_CHALLENGE` 要求 Call + 1–2 Reasons
6. `CHALLENGE_RESOLVED` → `challenge`
7. `KEEP_INITIAL` → `preview`
8. `ACCEPT_ALTERNATIVE` → `preview`
9. `SHOW_REFERENCE` → `reference`
10. `SHOW_REVIEW` → `review`
11. `COMPLETE_ROUND` append RoundResult
12. round 1–2 → 下一个 `situation`
13. round 3 → `summary`
14. `RESET` 清空
15. `HYDRATE` 恢复合法 session

- [ ] **Step 2：运行并确认失败**

```bash
pnpm test -- reducer.test.ts
```

- [ ] **Step 3：实现 reducer**

使用 discriminated union action。

普通非法 UI action：

> 返回 unchanged state，不抛异常。

- [ ] **Step 4：创建 `PersistedSessionSchema`**

`sessionSchema.ts`：

```ts
import { z } from "zod";
import {
  CallIdSchema,
  ChallengeOutputSchema,
  ExperiencePhaseSchema,
  ReasonIdSchema,
  RoundResultSchema,
} from "@/domain/schemas";

export const PersistedSessionSchema = z.object({
  phase: ExperiencePhaseSchema,
  scenarioIndex: z.number().int().min(0).max(2),
  initialCall: CallIdSchema.nullable(),
  reasonIds: z.array(ReasonIdSchema).max(2),
  challenge: ChallengeOutputSchema.nullable(),
  finalCall: CallIdSchema.nullable(),
  completedRounds: z.array(RoundResultSchema).max(3),
});
```

- [ ] **Step 5：写 storage 测试**

使用 localStorage mock。

测试：

- 合法 session 可 hydrate；
- malformed JSON → null；
- schema invalid → null；
- clear 后 key 不存在。

Storage key 固定：

```text
connected-decisions:v1:session
```

- [ ] **Step 6：实现 storage**

只存必要状态。

- [ ] **Step 7：运行**

```bash
pnpm test -- reducer.test.ts storage.test.ts
pnpm typecheck
```

- [ ] **Step 8：Commit**

```bash
git add web/src/domain/experienceReducer.ts web/src/domain/sessionSchema.ts web/src/lib/storage.ts web/src/test
git commit -m "feat: add experience state machine"
```

---

# Task 6 — 构建 Mobile-first 主体验骨架 [P0]

**交付结果：** 在 AI 接入前，Intro → Situation → Decision 可用。

**文件：**

- Create: `ExperienceShell.tsx`
- Create: `IntroScreen.tsx`
- Create: `SituationScreen.tsx`
- Create: `DecisionScreen.tsx`
- Modify: `page.tsx`
- Modify: `globals.css`
- Modify: `layout.tsx`

- [ ] **Step 1：`page.tsx` 只负责挂载 Shell**

```tsx
import { ExperienceShell } from "@/components/experience/ExperienceShell";

export default function Home() {
  return <ExperienceShell />;
}
```

- [ ] **Step 2：建立视觉 Token**

在 `globals.css` 建 CSS Variables：

```text
background
surface
surface-elevated
text
text-muted
border
accent
accent-secondary
danger
```

并加入：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3：实现 IntroScreen**

必须有：

- 项目标题；
- 一句话 thesis；
- “职业路径不是标准答案”提示；
- `开始训练`。

- [ ] **Step 4：实现 SituationScreen**

显示：

- 场景名称；
- 时间；
- 存活人数；
- Objective；
- 事实；
- 地图；
- `开始判断`。

Fixture 必须显示：

> Practice Fixture

- [ ] **Step 5：实现 DecisionScreen**

必须有：

- 3 个 Call；
- Reason Chips；
- 只允许 1–2 个 Reason；
- 选中态；
- 44px 最小触控；
- 条件不满足时 submit disabled。

禁止在这里提前展示 AI。

- [ ] **Step 6：正确处理 hydration**

使用：

```ts
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  const saved = loadSession();
  if (saved) dispatch({ type: "HYDRATE", payload: saved });
  setHydrated(true);
}, []);

useEffect(() => {
  if (hydrated) saveSession(state);
}, [hydrated, state]);
```

避免初始空 state 把已保存 session 覆盖。

- [ ] **Step 7：Mobile 手测**

约：

```text
430 x 932
```

检查：

- 无横向滚动；
- 主按钮可点击；
- Reason 可读；
- Call 不错误截断。

- [ ] **Step 8：检查**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

- [ ] **Step 9：Commit**

```bash
git add web/src/app web/src/components/experience
git commit -m "feat: build independent decision flow"
```

---

# Task 7 — 接入 live AI Challenge + fallback [P0]

**交付结果：** 用户锁定判断后，服务端请求 AI；任何失败都回 fallback。

**文件：**

- Create: `web/src/lib/aiClient.ts`
- Create: `web/src/lib/aiParsing.ts`
- Create: `web/src/app/api/challenge/route.ts`
- Create: `ChallengeScreen.tsx`
- Test: `aiParsing.test.ts`
- Modify: `ExperienceShell.tsx`

**Request：**

```ts
{
  scenarioId: string;
  initialCall: CallId;
  reasonIds: ReasonId[];
}
```

**Response：**

```ts
ChallengeOutput
```

- [ ] **Step 1：先写 AI parsing 测试**

测试：

- 纯 JSON；
- Markdown code fence 包裹 JSON；
- malformed JSON；
- schema-invalid alternative Call。

- [ ] **Step 2：实现 parser**

```ts
export function parseChallengeContent(
  raw: string,
): Omit<ChallengeOutput, "source"> | null
```

处理一层外部 code fence。

必须经过 Zod。

- [ ] **Step 3：实现通用 server AI client**

```ts
export async function requestChatCompletion(args: {
  messages: { role: "system" | "user"; content: string }[];
  timeoutMs: number;
  maxTokens: number;
}): Promise<string>
```

行为：

- 读取 `AI_BASE_URL`
- 读取 `AI_API_KEY`
- 读取 `AI_MODEL`
- POST `${AI_BASE_URL}/chat/completions`
- `AbortController`
- temperature 约 0.2
- 非 2xx 抛出
- 返回 `choices[0].message.content`
- 禁止 log key

- [ ] **Step 4：实现 challenge route**

先验证输入。

再按 scenarioId 读取 Scenario。

System Prompt 必须包含：

```text
你是“第二意见”生成器，不是裁判。
只能使用提供的场景事实。
必须引用用户的初始 Call 或理由。
不得新增选手位置、道具、经济、比分或其他比赛事实。
不得使用“正确答案”“答错”“必然”“唯一最优”等措辞。
输出简短 JSON。
```

模型输出字段固定：

```text
stance
acknowledge
blindspot
question
alternativeCall
```

任何异常：

```ts
return Response.json(
  buildFallbackChallenge(...),
  { status: 200 },
);
```

fallback 对产品来说是正常成功响应。

- [ ] **Step 5：实现 ChallengeScreen**

展示：

- acknowledge；
- blindspot；
- question；
- development 环境可显示 source；
- `坚持我的判断`
- `采纳 AI：<Call>`
- 无 alternative 时 `继续`

禁止显示“得分”。

- [ ] **Step 6：处理 loading**

用户提交后立即显示：

> AI 正在读取你的判断……

route 内部负责 timeout。

禁止自动无限重试。

- [ ] **Step 7：手动测失败情况**

测试：

- 错 key；
- 空 key；
- 错 base URL；
- 正常 provider。

都必须走到 Challenge 或 fallback。

- [ ] **Step 8：检查**

```bash
pnpm test -- aiParsing.test.ts fallback.test.ts
pnpm typecheck
pnpm lint
```

- [ ] **Step 9：Commit**

```bash
git add web/src/app/api/challenge web/src/lib web/src/components/experience
git commit -m "feat: add resilient ai challenge"
```

---

# Task 8 — 实现可复用 Tactical Preview [P0]

**交付结果：** 同一个组件根据 Scenario Data 渲染 A/B/C 的空间预览。

**文件：**

- Create: `web/src/components/tactical/TacticalPreview.tsx`
- Create: `TacticalPreviewScreen.tsx`
- Modify: `ExperienceShell.tsx`

**Props：**

```ts
{
  scenario: Scenario;
  call: CallId;
  animate?: boolean;
}
```

- [ ] **Step 1：SVG 统一使用 normalized coordinate**

```tsx
<svg viewBox="0 0 100 100">
```

渲染：

- map image；
- player markers；
- routes；
- zones；
- metrics。

- [ ] **Step 2：动画只展示 authored spatial data**

Framer Motion 只用于：

- path draw；
- marker movement；
- zone opacity。

目标：

```text
1–2 秒
```

禁止：

- 击杀；
- 枪线；
- 预测反应；
- 胜负。

- [ ] **Step 3：固定提示**

必须显示：

> 战术空间预览 · 非比赛结果预测

- [ ] **Step 4：实现 TacticalPreviewScreen**

显示：

- Final Call；
- TacticalPreview；
- 最多 3 个 qualitative metrics；
- `查看真实职业路径`。

- [ ] **Step 5：验证 A/B/C 都由同一组件渲染**

禁止 scenario-specific preview component。

- [ ] **Step 6：Reduced Motion**

Reduced motion 下：

> 直接显示最终状态。

- [ ] **Step 7：检查**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

- [ ] **Step 8：Commit**

```bash
git add web/src/components/tactical web/src/components/experience/TacticalPreviewScreen.tsx
git commit -m "feat: add tactical preview"
```

---

# Task 9 — 职业路径参考与单局复盘 [P0]

**交付结果：** 用户方案和职业路径并列但不做对错判断。

**文件：**

- Create: `ProfessionalReferenceScreen.tsx`
- Create: `RoundReviewScreen.tsx`
- Modify: `ExperienceShell.tsx`
- Create: `web/public/media/scenarios/`
- Create: `web/public/maps/`

- [ ] **Step 1：实现 ProfessionalReferenceScreen**

有 clip 时：

```tsx
<video
  src={clipSrc}
  controls
  playsInline
  preload="metadata"
/>
```

必须：

- 不 autoplay audio；
- 视频失败不阻断；
- 文字 Reference 始终存在。

固定显示：

```text
真实职业路径
历史结果
观察点
```

固定说明：

> 这是历史上真实发生的一条职业路径，不是唯一正确答案。

- [ ] **Step 2：实现 RoundReviewScreen**

左右/上下两个区域：

```text
你的最终方案
职业路径参考
```

你的方案：

- final Call
- strengths
- risks

职业路径：

- actual path
- observations
- historical outcome

禁止红绿对错视觉。

- [ ] **Step 3：生成 RoundResult**

点击“完成本局”：

```ts
{
  scenarioId,
  initialCall,
  reasonIds,
  aiStance,
  aiAlternativeCall,
  aiResponseSource,
  finalCall,
  changedAfterAI: finalCall !== initialCall,
  professionalCall,
  completedAt: new Date().toISOString(),
}
```

- [ ] **Step 4：验证三局推进**

```text
Round 1 → Situation 2
Round 2 → Situation 3
Round 3 → Summary
```

- [ ] **Step 5：Commit**

```bash
git add web/src/components/experience web/public
git commit -m "feat: add professional reference flow"
```

---

# Task 10 — Connection Report 与 Trajectory [P0]

**交付结果：** 三局结束后立即显示 deterministic Connection Report。

**文件：**

- Create: `ConnectionTrajectory.tsx`
- Create: `DonutMetric.tsx`
- Create: `MetricCard.tsx`
- Create: `ConnectionReportScreen.tsx`
- Modify: `ExperienceShell.tsx`

- [ ] **Step 1：实现 ConnectionTrajectory**

四列：

```text
初始判断 | AI 挑战 | 最终判断 | 职业路径
```

每局一行。

状态标签：

- `采纳`
- `坚持`
- `一致`

禁止判断输赢。

Trajectory 必须是整页最大视觉。

- [ ] **Step 2：不用图表库实现 Donut**

使用 CSS：

```text
conic-gradient
```

Props：

```ts
type DonutMetricProps = {
  label: string;
  numerator: number;
  denominator: number;
};
```

当 denominator 为 0：

- 显示 `0 / 0`
- 使用中性 ring
- 禁止 NaN

- [ ] **Step 3：最终指标**

必须有：

1. AI 分歧
2. 分歧后采纳
3. 独立坚持
4. 职业路径趋同：
   - initial
   - final

禁止 Accuracy。

- [ ] **Step 4：固定小样本声明**

> 以下分析仅基于本次 3 个案例，用于观察当前体验中的决策变化，不代表稳定人格或能力评估。

- [ ] **Step 5：Reset**

`重新体验`：

- clear localStorage；
- reducer RESET；
- 回 Intro。

- [ ] **Step 6：检查**

```bash
pnpm test -- stats.test.ts reducer.test.ts
pnpm typecheck
pnpm lint
```

- [ ] **Step 7：Commit**

```bash
git add web/src/components/report web/src/components/experience/ConnectionReportScreen.tsx
git commit -m "feat: visualize connection trajectory"
```

---

# Task 11 — 跨局 AI 行为观察 [P0]

**交付结果：** 结果页先立即显示确定性数据，再异步补一段 AI 行为观察。

**文件：**

- Create: `web/src/app/api/report/route.ts`
- Modify: `ConnectionReportScreen.tsx`
- Modify: `web/src/lib/aiParsing.ts`

**Request：**

```ts
{
  rounds: RoundResult[];
}
```

**Response：**

```ts
{
  observation: string;
  source: "live" | "fallback";
}
```

- [ ] **Step 1：新增 report parser**

固定接口：

```ts
export function parseReportContent(
  raw: string,
): { observation: string } | null
```

接受：

```json
{"observation":"..."}
```

拒绝：

- 空 observation；
- 非 JSON；
- 超出 schema max length。

- [ ] **Step 2：实现 deterministic report fallback**

必须提到：

1. disagreement 数；
2. acceptance / persistence；
3. 如果有，最高频 Reason；
4. 小样本限定。

示例：

> 基于本次 3 个案例，你在 2 次 AI 分歧中采纳了 1 次、坚持了 1 次；你最常使用「已知位置」作为判断依据。当前样本呈现的是选择性接受第二意见，而不是持续服从或持续拒绝。

禁止人格分类。

- [ ] **Step 3：实现 `/api/report`**

正常流程要求三局 RoundResult。

服务端再次计算 stats。

Prompt 约束：

```text
只描述当前三个案例中的行为。
不得做人格诊断。
不得说“你就是/你属于”。
不得把职业路径当正确答案。
不得自己计算或修改提供的数字。
输出一段简洁中文行为观察。
```

timeout：

```text
AI_REPORT_TIMEOUT_MS
```

任何错误：

> status 200 + deterministic fallback。

- [ ] **Step 4：结果页 loading**

Trajectory 和指标立即出现。

AI 区显示：

> 正在生成本次连接行为观察……

返回后再替换。

禁止等待 AI 时整页空白。

- [ ] **Step 5：关闭 AI 测试**

不配 AI 时：

- Trajectory 正常；
- stats 正常；
- fallback observation 正常。

- [ ] **Step 6：检查**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

- [ ] **Step 7：Commit**

```bash
git add web/src/app/api/report web/src/components/experience/ConnectionReportScreen.tsx web/src/lib
git commit -m "feat: add cross-round ai observation"
```

---

# Task 12 — 接入真实职业比赛 Scenario 与素材 [P1]

**交付结果：** Fixture 不再作为正式运行内容，3 个正式 Scenario 均经过事实核验。

**文件：**

- Modify: `web/src/data/scenarios.ts`
- Add: `web/public/maps/...`
- Add: `web/public/media/scenarios/<scenario-id>/pro.mp4`
- Modify: `AI_COLLAB_LOG.md`
- Modify: `README.md`

- [ ] **Step 1：优先选择低内容成本素材来源**

优先：

- 同一 BO3；
- 同一场 Match；
- 同一批 Demo；
- 可复用地图资产。

单个 clip 搜索/处理不得超过：

```text
45 分钟
```

- [ ] **Step 2：人工核验 Hero**

记录：

```text
event
match
map
round
sourceLabel
sourceUrl
```

逐项确认所有 UI 会展示的事实。

只有确认后：

```ts
verified: true
```

- [ ] **Step 3：检查 Hero 是否真的有决策冲突**

至少满足：

- 两个 Call 都合理；
- AI 有可挑战的 blind spot；
- 职业路径明确；
- 10–15 秒内能看懂。

否则：

> 换 Scenario，不要靠长文案补救。

- [ ] **Step 4：准备 Hero Clip**

目标：

```text
8–20 秒
```

浏览器安全 MP4。

保留足够小地图/HUD 信息。

路径：

```text
/public/media/scenarios/<hero-id>/pro.mp4
```

- [ ] **Step 5：接入 Lite 2**

复用同一 Schema / UI。

Tactical Preview 可简化。

如果视频拖进度：

> 用 verified keyframe / text reference。

- [ ] **Step 6：接入 Lite 3**

同上。

冲突类型必须和前两局不同。

- [ ] **Step 7：runtime 切换到正式 Scenario**

保留 fixture 测试，但产品 runtime 使用正式 Scenario。

- [ ] **Step 8：完整检查**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

- [ ] **Step 9：更新文档**

README：

- 记录高层来源信息。

AI log：

- 记录 AI 如何帮助结构化 Scenario；
- 不得说 AI 完成事实核验。

- [ ] **Step 10：Commit**

```bash
git add web/src/data web/public README.md AI_COLLAB_LOG.md
git commit -m "feat: integrate verified professional scenarios"
```

---

# Task 13 — Mobile Polish + 容错审计 [P1]

**交付结果：** 不扩功能，只让当前版本稳定、成熟、可演示。

**文件：**

- 仅修改已有 component/style
- 不新建功能子系统

- [ ] **Step 1：重审视觉主次**

整套产品两个视觉重点必须是：

1. Tactical Preview
2. Connection Trajectory

其他东西都不能抢。

- [ ] **Step 2：删除幼稚电竞模板感**

删除：

- 过多 glow；
- 无意义 gradient；
- 特战人物壁纸；
- 过密 HUD；
- 与决策无关装饰。

- [ ] **Step 3：Touch / Accessibility**

确认：

- 44px；
- focus；
- keyboard；
- contrast；
- reduced motion；
- icon-only control 有 aria-label。

- [ ] **Step 4：Responsive**

测试：

```text
390px
430px
440px
768px
1280px
```

无横向滚动。

- [ ] **Step 5：Failure Matrix**

逐个跑：

```text
AI success
AI challenge timeout
AI report timeout
invalid AI response
missing video
refresh during round
refresh on report
reset
all 3 scenarios
```

- [ ] **Step 6：只修 release blocker**

不新增功能。

- [ ] **Step 7：Full Check**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

- [ ] **Step 8：Commit**

```bash
git add web
git commit -m "fix: harden mobile game jam flow"
```

---

# Task 14 — 提交打包与 Release Gate [P1]

**交付结果：** 任何拿到工程的人，不依赖口头说明即可运行。

**文件：**

- Modify: `README.md`
- Modify: `AI_COLLAB_LOG.md`
- Optional: `SUBMISSION_CHECKLIST.md`

- [ ] **Step 1：完善 README**

精确写：

```bash
cd web
pnpm install
cp .env.example .env.local
pnpm dev
```

同时解释 AI 环境变量。

必须明确：

> 即使没有 AI Credential，fallback 仍可运行核心流程。

生产运行：

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm start
```

- [ ] **Step 2：完善 AI Collaboration Log**

至少有：

- Connection 概念压力测试；
- Scope 收缩；
- UI 视觉探索；
- coding assistance；
- AI Challenge 设计；
- 测试 / debug。

不得伪造未实际发生的 AI 使用。

- [ ] **Step 3：Cold Start Test**

从干净环境：

```bash
cd web
pnpm install
pnpm build
pnpm start
```

验收：

- Intro 加载；
- Hero 完成；
- Lite 2/3 完成；
- Report 出现。

- [ ] **Step 4：Offline AI Test**

不提供：

```text
AI_API_KEY
```

仍必须：

- 完成三局；
- fallback Challenge 正常；
- fallback Report 正常；
- 无未处理错误。

- [ ] **Step 5：实际手机测试**

如有真机：

- Hero；
- reference video；
- 三局；
- report；
- reset。

- [ ] **Step 6：录制 Demo Video**

至少展示：

1. 独立 Call
2. Reason 选择
3. AI Challenge
4. 坚持 / 改判
5. Tactical Preview
6. Professional Reference
7. Connection Trajectory
8. Behavior Observation

不要做复杂视频后期。

- [ ] **Step 7：制作提交压缩包**

包含：

```text
AGENTS.md
PRODUCTION.md
TASKS.md
README.md
AI_COLLAB_LOG.md
web/
演示视频（如要求/已有）
```

排除：

```text
web/node_modules/
web/.next/
.env
.env.local
无用 raw demo
```

- [ ] **Step 8：最终命令**

```bash
cd web
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

全部 PASS。

- [ ] **Step 9：Release Commit**

```bash
git add .
git commit -m "chore: prepare game jam submission"
```

---

# P2 Polish Backlog

只有全部 P0/P1 通过后才允许做：

- 微动效优化；
- 路线动画节奏；
- loading copy；
- typography spacing；
- 一个简单 hero transition；
- 已经本地稳定后再考虑公网部署。

依旧禁止：

- 数据库；
- 登录；
- 排行榜；
- Agent；
- Replay Engine；
- 比赛模拟；
- 人格系统；
- Scenario > 3。

---

# 最终验收矩阵

只有全部满足，agent 才能宣布 MVP 完成。

## 产品

- [ ] Hero 证明完整 Connection Loop；
- [ ] Scenario 2/3 复用架构；
- [ ] AI 只在用户独立判断后出现；
- [ ] AI Challenge 依赖 Call / Reasons；
- [ ] 用户可以接受或拒绝；
- [ ] Professional Reference 不是 Correct Answer；
- [ ] Tactical Preview 明确非预测；
- [ ] 最终报告使用小样本措辞。

## 数据

- [ ] 保存 3 个 RoundResult；
- [ ] disagreement deterministic；
- [ ] acceptance deterministic；
- [ ] persistence deterministic；
- [ ] alignment deterministic；
- [ ] reason frequency deterministic。

## 容错

- [ ] live AI fail → fallback；
- [ ] report AI fail → fallback；
- [ ] video fail 不阻断；
- [ ] refresh 可恢复；
- [ ] reset 可清空。

## 工程

- [ ] API Key 不在客户端；
- [ ] 无数据库；
- [ ] 无 `any`；
- [ ] Scenario 全部通过 schema；
- [ ] tests 通过；
- [ ] typecheck 通过；
- [ ] lint 通过；
- [ ] build 通过。

## 提交

- [ ] README 可独立运行；
- [ ] AI Collaboration Log 有真实内容；
- [ ] 正式 Scenario 事实已核验；
- [ ] 手机尺寸完整跑通过。
