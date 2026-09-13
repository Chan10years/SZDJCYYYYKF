# PRODUCTION.md

# Connected Decisions — 当前产品基线

## 1. 产品定位

Connected Decisions 是一个面向 CS2 决策分析与复盘的 **AI Second Coach / 第二教练系统**。

长期主要服务：

- 民间战队；
- 校队；
- 教练 / 分析师；
- 同时保留个人玩家训练模式。

当前阶段不建设完整 Team SaaS，第一目标是把 Second Coach 核心链做可信、做完整。

## 2. 当前阶段：Gate 1 — Real Match Vertical Slice

Gate 0 — Trust & Reliability 已完成并关闭。当前重点从“修旧 Demo”进入真实训练内容验证：

```text
真实训练赛
→ 真实 .dem
→ 真实比赛状态
→ ScenarioDraft
→ Human QA
→ Existing Connected Decisions
```

由于现在有真实训练赛数据窗口，当前允许优先验证这条链。`.dem` Pipeline 是内容生产能力，不是产品核心卖点；AI Second Coach 仍然是 2026-09-19 演示的主角。

Gate 1 只允许最小 Vertical Slice，不顺势建设完整 Dataset Platform、FastAPI、数据库、Worker 或其他新基础设施。自动 Candidate 和 Observable Knowledge 全自动化不是 Gate 1 硬要求。

## 3. 核心问题

> 玩家先完成独立判断，再接入 AI 的第二视角后，他的判断过程发生了什么变化？

产品重点观察：

- 用户为什么做出这个 Call；
- AI 挑战了哪一个假设；
- 用户为什么坚持或改判；
- Professional Reference 提供了什么参考；
- 下一次类似局面应该注意什么。

AI 不是答案机器。

## 4. 核心训练链路

```text
Situation
→ Initial Call
→ Reasons
→ AI Second Coach / Challenge
→ Keep / Revise
→ Tactical Preview
→ Professional Reference
→ Round Review
→ Session / Connection Review
```

必须保持：

1. AI 晚于用户独立判断出现；
2. 多个 Call 可以同时合理；
3. Professional Reference 不等于唯一正确答案；
4. 决策前不泄漏未来或未知信息；
5. 系统忠实保存用户实际判断和 Reasons；
6. Review 要帮助用户形成可迁移的判断经验。

## 5. AI Second Coach

AI 的角色是 **Pressure Test**。

应该：

- 承接用户当前逻辑；
- 找遗漏信息；
- 指出风险条件；
- 提供另一种合理视角；
- 提出 Challenge。

不应该：

- 宣布唯一正确答案；
- 为了“挑战”而强行反对；
- 编造地图上不存在的事实；
- 把职业队成功结果等同于决策必然正确；
- 输出人格或能力诊断。

AI Adoption、Professional Alignment 可以记录，但不得直接当作“能力分数”。

## 6. 用户模式

### Team / Coach — 长期主方向

未来可形成：

```text
训练赛 / 比赛
→ 选取值得复盘的 Scenario
→ 队员独立判断
→ AI Second Coach 压力测试
→ 教练查看分歧
→ 集体复盘
→ 留下下一次训练目标
```

当前升级周期不要求实现战队账号、教练后台、实时多人或 Team 数据模型。

### Individual Mode — 保留

个人模式继续复用同一个 Decision Review Engine：

`Scenario → Independent Decision → AI Challenge → Review`

Team 与 Individual 共享训练内核，不做两套产品。

## 7. Scenario 与可信度

Scenario 是核心内容单元。

可发布 Scenario 至少应包含：

- 比赛来源；
- 地图 / 回合 / 决策时间点；
- 玩家视角；
- 已知 / 未知信息；
- Call / Reason 选项；
- Tactical Preview；
- Professional / Tactical Reference；
- verification status；
- source provenance。

状态至少区分：`draft / practice / verified`。

未核验内容不得作为 verified professional evidence。

## 8. 信息公平

决策页只能展示该决策时刻应该知道的信息。

应区分：

- `decisionEvidence`：当前判断依据；
- `contextMedia`：背景 / 装饰；
- `referenceMedia`：决策完成后揭示的参考。

禁止：未来时刻截图、隐藏敌方位置、错地图 / 错回合素材、结果暗示。

## 9. Tactical Preview

职责：清楚表达用户 Final Call 的空间意义。

允许：玩家位置、路线、区域、Bomb / Objective、少量风险 / 信息标签、轻动画。

禁止：未来击杀、敌方反应预测、胜负 / 胜率预测、错误空间关系。

近期优先继续复用现有 Tactical Preview，不因未来 `.dem` Pipeline 提前重写。

## 10. Review 要留下什么

产品需要从“记录改没改”升级为“记录为什么这么判断”。

记录能力逐步支持：

```text
initialCall
initialReasons
optionalReasoning
aiChallenge
aiSource
finalCall
changeReason
professionalReference
postRoundReflection
nextTrainingHypothesis
```

Review 最终应能回答：

1. 我一开始为什么这么选？
2. AI 挑战了什么？
3. 我为什么坚持 / 改判？
4. 职业路径给了什么参考？
5. 下一次类似情况我要检查什么？

## 11. `.dem` 内容生产能力

`.dem` 自动化是重要生产力升级，但不是核心卖点。

长期方向：

```text
真实 .dem
→ 结构化比赛状态
→ 候选决策节点
→ Observable Knowledge
→ TacticalPreviewData
→ ScenarioDraft
→ Human QA
→ Verified Scenario
→ Connected Decisions
```

它解决的是降低真实比赛 → 复盘内容的生产成本。

当前原则：

- 高质量 Scenario 可以继续人工制作；
- 自动 Candidate 不是 9 月 19 日演示硬要求；
- Gate 1 当前允许优先验证最小 Vertical Slice；Phase R 审批前不写 production code；
- 自动候选永远不直接等于 Verified Scenario。

## 12. 2026-09-19 演示目标

课堂演示优先证明：

> Connected Decisions 已经是一个可信、完整、明显更像“电竞第二教练”的决策复盘原型。

最低要求：

- 当前 Scenario 可信；
- Tactical Preview 正确；
- 决策前无信息泄漏；
- Reasons / Review 记录忠实；
- AI Challenge 有事实边界；
- 网络 / storage 故障不阻断主流程；
- Second Coach 角色清晰；
- Review 能留下训练结论。

加分项：

- Gate 1 成功后优先展示至少一个来自自己真实训练赛的 Scenario；
- 新增少量高质量 Scenario；
- `.dem → Round → Tick → Normalized State → TacticalPreview` Vertical Spike。

## 13. 当前明确不做

除 Gate 1 已授权的最小 `.dem` Vertical Slice 外，本周期不主动建设：

- 完整 Team SaaS；
- 登录 / 权限；
- PostgreSQL / 云数据库迁移；
- WebSocket 实时多人；
- Coach CMS；
- FastAPI / Redis / Celery；
- 完整 Replay Engine；
- MP4 OCR / CV；
- HLAE 自动录制系统；
- Transformer / 胜率预测；
- Personality / Ability Score；
- 多模型 / 多 Agent 产品架构；
- 大型 UI 重做。

## 14. 视觉方向

> 成熟数据产品 × 克制电竞语言。

地图 / 战术信息优先，Mobile 基本可用，桌面端适合复盘。

避免满屏 Glow、重 Cyberpunk、军事海报、无意义 Dashboard 和装饰压过内容。

## 15. 当前成功标准

### Trust
- Tactical Preview 空间正确；
- 决策时刻信息可信；
- verified / practice 语义正确；
- Reason / Review 不串数据。

### Second Coach
- AI 只在独立判断后出现；
- AI 不编造事实、不宣布标准答案；
- 用户可以坚持或改判；
- Review 能解释判断过程。

### Reliability
- live AI 失败可恢复；
- storage 失败可降级；
- 正式公网前有 AI 调用成本边界；
- test / typecheck / lint / build 通过。

最终用户应该理解：

> 这是帮助玩家和队伍复盘决策过程的 AI Second Coach，不是“AI 告诉你怎么打”的标准答案系统。
