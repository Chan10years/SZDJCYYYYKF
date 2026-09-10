# AGENTS.md

## 1. 用途与阅读顺序

本文件只定义 coding agent 的执行规则。

开发前依次阅读：

`AGENTS.md` → `docs/architecture/CONNECTED_DECISIONS_ARCHITECTURE_UPGRADE_PLAYBOOK.md` → `PRODUCTION.md` → `TASKS.md`

- Playbook：长期架构与升级边界；
- `PRODUCTION.md`：当前产品基线；
- `TASKS.md`：当前 10 天升级任务。

只执行当前明确指定的 Gate / Task，不得提前实现后续阶段。

## 2. 产品核心

Connected Decisions 的核心定位：

> 面向 CS2 决策分析与复盘的 AI Second Coach / 第二教练系统。

核心链路保持：

`Situation → Initial Call → Reasons → AI Challenge → Keep / Revise → Tactical Preview → Professional Reference → Review`

不可擅自改变：

1. 用户先独立判断，AI 后出现；
2. AI 是第二意见 / 压力测试，不是裁判；
3. Professional Reference 是参考，不是唯一正确答案；
4. 不泄漏决策时刻之后或用户未知的信息；
5. 不静默改写用户判断、Reasons 或历史记录；
6. 产品训练的是判断过程，不是“猜中职业答案”。

## 3. 当前优先级

固定顺序：

`训练事实可信 → 核心流程稳定 → Second Coach 复盘完整 → 内容生产效率 → 团队能力 → 规模化`

`.dem` 自动解析、Candidate、Team Mode 等都不能抢占当前 Second Coach 主线。

## 4. 当前技术边界

现有主产品继续使用：

- Next.js App Router
- React
- TypeScript strict
- Tailwind CSS
- Zod
- Vitest / React Testing Library
- pnpm

除非当前 Gate 明确要求，否则不引入：

- 数据库 / 登录 / Team Domain；
- 新状态管理库；
- 新后端服务；
- Worker / Queue；
- `.dem` Parser Service；
- 大规模 Scenario Schema Migration；
- 核心 reducer / 训练流程替换；
- Tactical Preview 核心替换。

## 5. 代码规则

1. 优先最小修复已验证问题，不做无关重构。
2. 主流程继续使用显式 phase / reducer。
3. 内容数据与 UI 分离。
4. Scenario、API 输入输出、持久化数据必须校验。
5. AI Key 只能存在服务端。
6. AI 失败不能阻断核心训练流程。
7. stats、fallback、状态转换、数据变换优先写可测试纯函数。
8. 不因“更现代 / 更可扩展”替换稳定代码。
9. 若局部修复不足以解决问题，先报告再做结构调整。

## 6. Scenario 与 Tactical 事实规则

正式 Scenario 只有人工核验后才能进入 `verified`。

至少核验：赛事、队伍、地图、回合、决策时刻、存活人数、Bomb / Objective、用户可知 Facts、Tactical Preview、Professional Reference、素材来源。

`draft / practice / verified` 必须保持语义隔离。

Tactical Preview：

- 只表达已定义的战术空间意义；
- 不预测击杀、敌方反应、胜负或胜率；
- 地图、玩家、路线、区域必须与 Scenario 一致；
- 自动测试不能替代人工战术视觉检查。

## 7. AI Contract

AI Second Coach 应：

- 承接用户当前逻辑；
- 指出一个遗漏条件或风险；
- 提出 Challenge；
- 必要时给出一个合理替代视角。

AI 不得：

- 宣布唯一正确答案；
- 编造 Scenario 外的精确事实；
- 编造位置、道具、经济、比分；
- 把职业路径包装成标准答案；
- 做人格或稳定能力诊断。

live AI 必须有可验证 fallback / recovery。

## 8. 三 Agent 协作

### Implementer
负责当前 Gate 的实现、必要测试和自测；不得扩大 Scope。

### Reviewer
默认只读；检查 diff、复现原 Bug、运行测试 / 浏览器验证、检查回归与 Scope Drift。原则上不替 Implementer 修代码。

### Integrator
确认实现与审查结论对齐，处理必要的小型集成问题并跑完整回归。需要大范围返工时返回 `INTEGRATION BLOCKED`。

## 9. 大型变更控制

普通任务如涉及以下任一项，停止并报告：

- 数据库 / 登录 / Team / Organization Domain；
- 新后端服务 / Worker / Queue；
- `.dem` Parser Service；
- Scenario 大规模 Schema Migration；
- AI Provider / Model Routing；
- Public API 大改；
- reducer / 状态机替换；
- 核心训练流程替换；
- Tactical Preview 核心替换。

统一标记：

`ARCHITECTURE DECISION REQUIRED`

等待总控确认。

## 10. 测试与验收

普通任务至少运行：

```bash
cd web
pnpm test
pnpm typecheck
pnpm lint
```

集成 / Release Gate 额外运行：

```bash
pnpm build
```

涉及用户流程时必须浏览器验证；涉及 Scenario / Tactical 时必须人工核对事实与空间语义。

不能因为“代码能编译”就宣布完成。

## 11. Stop Rules

出现以下情况立即停止扩展并报告：

- 当前任务需要跨 Gate；
- 修 Bug 需要大规模重构；
- 文档与真实代码直接冲突；
- 需要当前 Stage 未授权的基础设施；
- 修改可能改变 Second Coach 核心逻辑；
- 缺少真实素材导致无法继续事实验证；
- 需要破坏性 Git / 数据操作。

## 12. Git 与安全

建议 commit 前缀：`chore:` `test:` `feat:` `fix:` `refactor:` `docs:`

禁止提交：`.env`、API Key / Secret、`node_modules`、`.next`、无必要的大型原始 Demo / 视频。

Commit 保持小、可审查、可回滚。

## 13. 返回报告

每个实现任务结束至少说明：

1. 解决了什么；
2. 修改了哪些文件；
3. 为什么这样改；
4. 明确没有改什么；
5. 新增 / 更新了哪些测试；
6. 实际验证结果；
7. 剩余风险 / 技术债；
8. 当前 HEAD 与工作区状态；
9. 是否建议进入下一 Gate。

普通施工任务结束后，不重新生成完整产品审查报告。
