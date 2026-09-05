# PRODUCTION.md

# Connected Decisions / 连接判断 — 产品规格说明

**项目暂名：** 连接判断 / Connected Decisions  
**作品形式：** Mobile-first 交互式 Web 原型  
**主题：** Connection / 连接  
**开发条件：** 24 小时单人 Game Jam  
**专业表达：** 数字媒体技术  
**当前阶段：** MVP Specification

---

## 1. 产品核心

### 核心问题

> 当人的独立判断连接 AI 的第二意见以后，判断会发生什么变化？

### 核心表达

> 我们关注的不是 AI 给出了什么答案，而是人的判断在连接 AI 之后发生了什么。

### 对“连接”的定义

> 连接让不同判断主体进入同一个决策过程，使信息能够被理解、采纳、拒绝，并在反馈中被重新判断。

因此，本项目里的 Connection 不是文案主题，而必须表现为：

- 数据依赖；
- 状态变化；
- 用户判断变化；
- 可视化轨迹；
- 跨局行为分析。

---

## 2. 为什么选择电竞作为实验场

电竞不是皮肤。

职业电竞适合做人机决策 Connection 的实验场，是因为它同时具有：

1. **信息不完整**  
   玩家永远无法看到完整世界状态。

2. **时间压力**  
   Call 不能无限思考。

3. **空间结果清晰**  
   一个决策可以直接表现为路线、控制区域、接触风险。

4. **存在真实职业实践记录**  
   Demo / Replay 可以提供历史参照。

5. **短时间内决策密度高**  
   一个 20–30 秒的关键局面就能形成完整决策闭环。

6. **现实风险低**  
   可以讨论人机协作，而不会触及医疗、金融、法律等高风险实际后果。

因此，本项目使用职业战术 FPS 的关键局面，作为一个受控的人机决策实验空间。

---

## 3. 目标用户

主要目标用户：

> 对战术 FPS / 电竞赛事有基础理解的普通玩家或观众。

产品不定位为职业教练系统。

用户价值在于：

- 主动说出自己的判断；
- 明确为什么这样判断；
- 接触 AI 的第二意见；
- 主动决定接受或拒绝；
- 与真实职业路径进行对照；
- 看见自己在三次交互中如何发生判断变化。

---

## 4. 核心体验承诺

三局体验形成一个短闭环：

```text
读取局势
  ↓
独立 Call
  ↓
选择 1–2 个理由
  ↓
AI Challenge
  ↓
坚持 / 改判
  ↓
Tactical Preview
  ↓
职业路径参考
  ↓
单局复盘
  ↓
Connection 分析
```

即使评委只玩 Hero Scenario，也必须理解本作品核心机制。

---

## 5. MVP 内容结构

### 5.1 Hero Scenario

Hero 是作品最重要的一局。

必须包含：

- 已验证比赛背景；
- 10–15 秒内可理解的决策局面；
- 至少两个合理 Call；
- 至少一个真实冲突；
- live AI Challenge；
- fallback Challenge；
- Tactical Preview；
- 有条件时提供真实职业比赛短视频；
- 职业路径说明；
- 单局复盘。

目标单局完整体验：

```text
60–90 秒
```

### 5.2 Lite Scenario 2

目的：

- 证明系统可以复用；
- 提供第二类决策冲突；
- 为最终跨局分析增加行为数据。

可以简化：

- Tactical Preview；
- 职业路径说明；
- 单局文字复盘。

### 5.3 Lite Scenario 3

目的：

- 证明机制可重复；
- 提供第三类决策冲突；
- 完成三局 Connection Trajectory。

与 Scenario 2 同规格即可。

---

## 6. Scenario 设计原则

好的 Scenario 不是“残局很帅”，而是“决策真的有权衡”。

建议三类冲突：

### Hero
**确定信息 vs 未知机会**

例如：

- A 区信息更明确；
- B 区不确定；
- 用户需要判断：确定性到底是优势，还是一种诱导？

### Lite 2
**人数优势 vs 时间压力**

例如：

- 人数领先；
- 时间持续减少；
- 继续获取信息可能更安全，但也可能压缩执行窗口。

### Lite 3
**资源安全 vs 主动创造机会**

例如：

- 保资源/保位置更安全；
- 主动操作可能创造更大收益；
- 两者都不能被包装成唯一真值。

以上只是“冲突模板”，不是比赛事实。

正式 Scenario 必须映射到真实可核验比赛。

---

## 7. 页面/阶段结构

MVP 使用一条线性的 Mobile-first 主流程。

### Phase 0 — Intro

目标：

- 建立主题；
- 解释职业路径不是标准答案。

推荐核心文案：

> 先做出你的判断，再让 AI 进入你的决策过程。

主按钮：

`开始训练`

---

### Phase 1 — Situation

只展示决策必要信息：

- 地图；
- 时间；
- 存活人数；
- Bomb / Objective；
- 少量已验证事实；
- 比赛来源信息。

不要做 HLTV 风格信息堆叠。

主按钮：

`开始判断`

---

### Phase 2 — Decision

用户必须完成：

1. 选择一个 Call；
2. 选择 1–2 个理由标签。

Call 固定使用 A/B/C 编号，但必须有明确语义。

Reason 可使用：

- 人数优势
- 已知位置
- 时间压力
- 道具优势
- 未知区域
- 资源保存

禁止：

- 没选 Call 就提交；
- 没选 Reason 就提交；
- 超过两个 Reason。

主按钮：

`锁定初始判断`

---

### Phase 3 — AI Challenge

AI 输入：

- 场景事实；
- Initial Call；
- Reason Tags。

AI 输出结构：

1. 承接用户当前逻辑；
2. 指出一个盲点；
3. 提出一个 Challenge Question；
4. 可选提供 Alternative Call。

用户选择：

- `坚持我的判断`
- `采纳 AI：<Call>`

如果 AI 与用户一致：

- 显示 `继续`

AI 不能给“正确/错误”评价。

---

### Phase 4 — Tactical Preview

目的：

> 把用户最终 Call 的空间意义可视化。

不是比赛模拟。

允许：

- 地图底图；
- 玩家点；
- 路线；
- 压力/信息区；
- 2–3 个定性标签。

例如：

```text
正面接触：高
信息确定性：高
转点空间：低
```

动画约：

```text
1–2 秒
```

禁止模拟击杀和结果。

主按钮：

`查看真实职业路径`

---

### Phase 5 — Professional Reference

Hero Scenario 优先展示真实短视频。

展示：

- 真实职业路径；
- 历史结果；
- 2–3 个观察点。

固定提示：

> 这是历史上真实发生的一条职业路径，不是唯一正确答案。

禁止红绿对错视觉。

主按钮：

`查看本局复盘`

---

### Phase 6 — Round Review

展示两个视角。

#### 你的最终方案

展示：

- Final Call；
- 可能优势；
- 可能风险；
- 关键条件。

#### 职业路径

展示：

- 当时实际执行；
- 为什么在当时有吸引力；
- 真实历史结果。

禁止推断：

> “如果你选 A，你一定会输。”

主按钮：

- 前两局：`下一局`
- 第三局：`查看连接报告`

---

### Phase 7 — Connection Report

这是：

> **本次三局体验中的行为观察**

不是人格测试。

---

## 8. Connection Trajectory

这是结果页最重要的视觉模块。

结构固定：

```text
ROUND | INITIAL | AI | FINAL | PROFESSIONAL
```

示例：

```text
R1      A ------ B ------ B ------ B
                       采纳

R2      B ------ C ------ B ------ A
                       坚持

R3      C ------ C ------ C ------ C
                       一致
```

它回答的问题是：

> AI 进入之后，用户判断到底发生了什么？

它必须比辅助指标更显眼。

---

## 9. 最终指标定义

所有指标必须由程序计算。

### 9.1 AI 分歧

定义：

```text
AI alternative Call 存在
且
AI alternative Call != initialCall
```

显示：

```text
AI 分歧
2 / 3
```

### 9.2 分歧后采纳

定义：

```text
存在分歧
且
finalCall == AI alternativeCall
```

分母是：

> 分歧次数

不是总局数。

### 9.3 独立坚持

定义：

```text
存在分歧
且
finalCall == initialCall
```

展示：

```text
独立坚持
1 次
```

坚持不是好坏评价。

### 9.4 与职业路径趋同

展示两个数字：

```text
初始趋同
最终趋同
```

示例：

```text
初始：1 / 3
最终：2 / 3
```

禁止命名为：

> Accuracy / 正确率

### 9.5 理由频率

统计 Reason Tags 的出现次数。

只作为：

- 小型辅助信息；
- AI 跨局观察输入。

不能被包装成统计显著结论。

---

## 10. AI 行为观察

最终模型接收：

- 三个 RoundResult；
- 程序计算好的统计；
- Reason Frequency。

模型只输出一段短观察，例如：

> 基于本次三个案例，你在信息较不完整的两次情境中更愿意接受 AI 的第二意见；当你认为已有信息较明确时，你保持了自己的初始判断。

必须遵守：

- 使用“本次体验 / 当前样本 / 这三个案例”；
- 只描述已发生行为；
- 不做人格诊断；
- 不给心理学式置信度；
- 不说“AI 让你更正确”。

---

## 11. AI 架构

只有两个生产级 AI 节点。

### Node A — Live AI Challenge

输入：

```text
Scenario Facts
+ Initial Call
+ Reason Tags
```

输出：

```text
acknowledgement
+ blind spot
+ challenge question
+ optional alternative Call
```

特点：

- 短；
- 快；
- 受事实约束；
- 失败后可 fallback。

### Node B — Cross-round Observation

输入：

```text
RoundResult[3]
+ ConnectionStats
+ ReasonFrequency
```

输出：

```text
一段小样本行为观察
```

数值计算永远不交给模型。

---

## 12. Fallback 机制

AI 不得成为单点故障。

### Challenge 失败

如果模型：

- 超时；
- 返回非法 JSON；
- schema 不合法；
- 请求失败；

立即用 deterministic fallback：

- 读取用户 Reason；
- 读取 Scenario 中预设 Challenge Guidance；
- 生成承接 + 盲点 + 反问；
- 给出配置好的 Alternative Call。

用户仍可继续。

### 最终报告失败

如果 report AI 失败：

- Connection Trajectory 正常显示；
- 所有统计正常显示；
- 使用 deterministic 行为观察。

---

## 13. Tactical Preview 数据结构

统一标准化坐标：

```ts
type Point = {
  x: number; // 0..100
  y: number; // 0..100
};

type PreviewRoute = {
  playerId: string;
  points: Point[];
};

type PreviewZone = {
  x: number;
  y: number;
  radius: number;
  kind: "pressure" | "information" | "risk";
  label: string;
};
```

必须只有一个 renderer。

禁止为不同 Scenario 写三套预览组件。

---

## 14. 职业比赛视频素材

Hero 推荐：

```text
8–20 秒 MP4
```

要求：

- 本地打包；
- 浏览器稳定播放；
- `playsInline`；
- 不自动播放声音；
- 足够压缩；
- Scenario 数据中保存素材来源。

Lite Scenario 可以：

- 用更短 clip；
- 或用已验证关键帧。

禁止开发 Replay Engine。

---

## 15. 数据模型

### Scenario

包含：

```text
基本身份
来源信息
已验证事实
Call 选项
Reason 选项
Tactical Preview 数据
fallback guidance
职业路径参考
单局 review 信息
```

### RoundResult

包含：

```text
scenarioId
initialCall
reasonIds
AI stance
AI alternativeCall
AI response source
finalCall
changedAfterAI
professionalCall
completedAt
```

### Session

浏览器只存：

```text
RoundResult[]
```

运行态：

- React state

持久化：

- localStorage

不使用数据库。

---

## 16. 视觉方向

目标：

> **成熟的决策分析产品 + 克制电竞表达**

### 可以用

- 深色中性面；
- 一个主强调色；
- 一个次强调色；
- 清晰排版；
- 细线；
- 干净地图；
- 大留白；
- subtle motion。

### 禁止堆叠

- 重 Cyberpunk；
- 军事人物海报；
- 每张卡发光；
- 幼稚 Scoreboard；
- 过量渐变；
- 过量 Dashboard；
- 装饰压过内容。

两大视觉主角：

1. Tactical Preview；
2. Connection Trajectory。

---

## 17. Mobile-first 行为

主要目标：

```text
430–440 CSS px 宽
930–960 CSS px 高
```

核心流程必须单手可操作。

桌面端：

- 中心保持主要交互；
- 可以利用额外宽度显示辅助说明；
- 不能另做一套 IA。

---

## 18. 性能与容错

目标：

- 本地交互立即响应；
- Phase 切换 < ~300ms 体感；
- Tactical Preview 1–2 秒；
- Challenge timeout 默认 3500ms；
- Report timeout 默认 6500ms；
- timeout 后 fallback；
- 视频失败时文本参考仍可继续。

即使 live AI 失败，产品仍可完整运行。

---

## 19. MVP 验收标准

### 核心体验

- [ ] Hero Scenario 完整；
- [ ] Scenario 2、3 复用同一组件；
- [ ] 用户先判断，AI 后出现；
- [ ] 用户选择 1–2 个 Reasons；
- [ ] AI Challenge 明确引用用户 Call / Reasons；
- [ ] 用户可坚持或改判；
- [ ] Tactical Preview 对应 Final Call；
- [ ] 职业路径被表达为历史参考；
- [ ] 三局全部可完成。

### Connection 证据

- [ ] Initial Call 被记录；
- [ ] AI alternative 被记录；
- [ ] Final Call 被记录；
- [ ] 分歧被计算；
- [ ] 采纳/坚持被计算；
- [ ] Professional Alignment 被计算；
- [ ] Connection Trajectory 显示三局。

### AI 稳定性

- [ ] live AI 正常；
- [ ] timeout fallback 正常；
- [ ] 非法 JSON fallback 正常；
- [ ] report AI 失败时结果页不崩。

### 技术质量

- [ ] ~430px 宽可用；
- [ ] 桌面可用；
- [ ] 刷新后 session 恢复；
- [ ] reset 清空；
- [ ] tests 通过；
- [ ] typecheck 通过；
- [ ] lint 通过；
- [ ] build 通过。

---

## 20. 提交物

### 必交

- 多媒体作品实体：
  - 代码工程；
  - 运行说明；
  - 演示视频（如采用）。
- AI 使用说明与协作日志。

### 推荐

- 有时间再做短版 Concept Pitch Deck。

README 必须写清：

- 环境；
- 安装；
- AI 环境变量；
- 开发运行；
- 生产构建；
- fallback；
- 内容来源说明。

---

## 21. AI 协作日志

从开发开始就维护：

```text
AI_COLLAB_LOG.md
```

推荐格式：

```markdown
## 2026-09-05 11:20 — Connection 机制压力测试

- 工具 / 模型：
- 任务：
- AI 介入前的人类判断：
- AI 提供了什么：
- 最终采纳：
- 最终舍弃：
- 原因：
- 影响到的代码/文档/视觉：
```

只记录真正影响作品的 AI 使用：

- 概念压力测试；
- Scope 收缩；
- 架构设计；
- 代码生成；
- 视觉探索；
- AI 功能构建；
- Debug / 验证。

---

## 22. 产品最终自检

评委只玩 Hero Scenario 后，应该能回答：

1. **AI 出现前，我做了什么判断？**
2. **AI 具体挑战了我的哪一部分理由？**
3. **连接 AI 后，我的判断有没有改变？**

如果这三件事无法一眼看懂，就说明 Connection 机制表达失败。
