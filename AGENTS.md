# AGENTS.md
## 1. 用途
本文件只定义 coding agent 的工作规则。产品需求看 `PRODUCTION.md`，开发步骤看 `TASKS.md`。
开发前按顺序阅读：`AGENTS.md` → `PRODUCTION.md` → `TASKS.md`。
若三者与已有代码冲突，以三份文档为准。

## 2. 项目目标
这是一个 24 小时单人 Game Jam 原型。
核心链路固定为：
`初始判断 → AI 第二意见 → 最终判断 → 职业路径参考 → Connection 分析`
目标不是证明“AI 会给正确答案”，而是证明：
> 用户在连接 AI 后，判断是否发生变化，以及这种变化如何被记录和呈现。

## 3. 不可改变的产品原则
1. 用户必须先完成 Initial Call 和理由选择，AI 才能出现。
2. AI 是第二意见，不是裁判。
3. AI 可以承接用户理由、指出盲点、提出 Challenge、给出可选 Alternative Call。
4. AI 不得宣布正确答案、编造比赛事实、预测具体击杀、编造胜率或做人格诊断。
5. 职业路径只能作为 Professional Reference，不能作为标准答案。
6. 禁止“答对/答错/正确率”；使用“职业路径/Alignment/趋同”。
7. 三个 Scenario 只能支持“小样本行为观察”，不得输出稳定人格或能力结论。
8. 最终报告优先使用“本次体验中”“当前三个案例中”“当前样本呈现”等措辞。

## 4. Scope
### 必做
- 1 个 Hero Scenario
- 2 个 Lite Scenario
- Call 选择
- 1–2 个 Reason
- live AI Challenge
- deterministic fallback
- 坚持 / 改判
- Tactical Preview
- Professional Reference
- RoundResult
- localStorage
- Connection Trajectory
- disagreement / acceptance / persistence / alignment
- 一段跨局 AI 行为观察
- Mobile-first
- README
- AI Collaboration Log
### 不做
- 登录、数据库、排行榜
- 多人、WebSocket
- Agent 框架、多模型 Agent
- Replay Engine、运行时 Demo Parser
- 比赛模拟、击杀预测、胜率模型
- 人格系统、复杂雷达图
- 多主题、CMS
除非用户明确修改 Scope，否则不得添加。

## 5. 技术约束
默认技术栈：
- Next.js App Router
- React
- TypeScript strict
- Tailwind CSS
- Zod
- Framer Motion
- Vitest
- React Testing Library
- pnpm
约束：
- 不引入数据库。
- 不引入额外状态管理库。
- MVP 不引入图表库。
- 禁止 `any`。
- AI Key 只能存在服务端。
- 所有模型请求走 Next.js API Route。
- Scenario、API 输入输出、localStorage 数据必须经 Zod 校验。

## 6. 代码设计规则
1. 主流程使用显式 `ExperiencePhase` + reducer，不用大量 `isXxx` 布尔值拼状态。
2. Scenario 2/3 必须复用 Hero 组件；如果新 Scenario 需要新架构，先缩 Scope。
3. stats、fallback、state transition、data transform 优先写纯函数。
4. live AI 必须有 fallback。
5. timeout、network error、invalid JSON、schema failure 都直接 fallback。
6. AI 失败不能阻断用户完成体验。
7. 内容数据与 UI 逻辑分离，Scenario 主要通过配置驱动。
8. 不做与当前需求无关的重构。

## 7. Tactical Preview 边界
Tactical Preview 只展示 Final Call 的空间意义。
允许：标记点、路线、区域、风险标签、1–2 秒轻动画。
禁止：模拟击杀、预测敌方反应、预测胜负、胜率输出。
必须显示：
> 战术空间预览 · 非比赛结果预测
地图坐标统一使用 `0..100` 标准化坐标，同一 renderer 支持全部 Scenario。

## 8. Scenario 事实规则
正式 Scenario 只有人工核验后才可 `verified: true`。
至少核验：赛事、队伍、地图、回合、时间、存活人数、Bomb / Objective、用户可见 Facts、实际职业路径、历史结果、素材来源。
开发 Fixture 必须明确标记，不能冒充真实职业比赛。
AI 可以帮助整理 Scenario，但不能被当作事实核验来源。

## 9. AI Contract
Challenge 必须依赖：
- Scenario Facts
- Initial Call
- 1–2 Reason
Challenge 输出固定语义：
```ts
{
  stance: "agree" | "challenge";
  acknowledge: string;
  blindspot: string;
  question: string;
  alternativeCall: "A" | "B" | "C" | null;
  source: "live" | "fallback";
}
```
模型只能使用提供事实，不得使用“正确答案”“答错”“必然”“唯一最优”等措辞。
最终报告的数字由程序计算，模型只负责一段短行为观察。

## 10. UI 原则
方向：
> 成熟数据产品 × 克制电竞语言
避免：满屏 Glow、过度 Cyberpunk、军事人物海报、幼稚 Scoreboard、无意义 Dashboard。
视觉重点只保留：
1. Tactical Preview
2. Connection Trajectory
Mobile-first 基准：`430–440 CSS px`。
最小触控区域：`44px`。
支持 `prefers-reduced-motion`，视频使用 `playsInline`，禁止 autoplay audio。

## 11. 测试与质量门
每个 Domain Task：
1. 先写失败测试。
2. 确认失败。
3. 实现最小代码。
4. 确认测试通过。
5. 再进入下一 Task。
每个任务结束至少运行：
```bash
cd web
pnpm test
pnpm typecheck
pnpm lint
```
Release 前额外运行：
```bash
pnpm build
```

## 12. Stop Rules
出现任一情况立即降级：
- 单个动画 > 60 分钟
- 单个视频素材 > 45 分钟
- AI 联调 > 45 分钟仍不稳定
- Scenario 2/3 需要新架构
- 功能无法直接帮助解释 Connection
- 功能只是为了“显得更技术”
始终优先保证 Hero 完整，而不是扩功能。

## 13. Agent 行为
无需询问文档中已经明确的内容。
只有以下情况可向用户提问：缺 API Key；缺真实比赛素材且无法继续验证；必须执行破坏性仓库操作；文档要求直接冲突。
其他情况：选择满足需求的最小实现并继续。
禁止静默扩 Scope，禁止擅自改产品核心 thesis。

## 14. Git 规范
建议 commit：
`chore:` `test:` `feat:` `fix:` `refactor:` `docs:`
禁止提交：`.env`、API Key / Secret、`node_modules`、`.next`、无必要的大型原始 Demo。
Commit 保持小、可审查、可回滚。

## 15. Definition of Done
只有以下全部满足才可宣布 MVP 完成：
- Hero 完整跑通
- 两个 Lite 复用同一系统
- live AI + fallback 都可用
- 用户可坚持或改判
- Tactical Preview 不预测结果
- Professional Reference 不做对错判断
- 三个 RoundResult 正确记录
- Connection Trajectory 正确显示
- stats 全部由程序计算
- report 使用小样本措辞
- refresh 可恢复，reset 可清空
- Mobile 可用
- `test / typecheck / lint / build` 全部通过
- README 可让别人直接运行
- `AI_COLLAB_LOG.md` 已维护
- 正式 Scenario 已完成人工核验
