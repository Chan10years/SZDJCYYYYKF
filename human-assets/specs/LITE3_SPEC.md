# Lite 3 Scenario — Real Asset Integration Spec

> 状态：**CONTENT LOCKED / 待最终人工核验后 `verified: true`**
>
> 本文只负责 Lite 3 的真实内容与素材接入规格。  
> 不修改现有产品 thesis、Domain Contract、AI Contract、Connection Trajectory 或 TacticalPreview 架构。  
> 三张手绘路线图仅作为**战术语义参考**，不要求固定命名，也不作为运行时必须读取的多模态输入。

---

## 1. Scenario Identity

**Scenario role:** Lite 3

**Event:** IEM Cologne Major 2026

**Match:** Team Spirit vs Falcons

**Stage:** Semifinal

**Map:** Dust2

**Round:** Round 20

**Decision timestamp:** `0:32`

**Score at decision:** Team Spirit `9` : `10` Falcons

**State:** Team Spirit 5 alive vs Falcons 4 alive

**Side:** Falcons 为 CT

**Objective:** Bomb **尚未下包**

**Decision context:** Spirit 主力已经进入 / 占据 B 包点区域；Falcons 已经确认 B 区存在大量进攻方。karrigan 位于 B Doors 附近，面对烟雾与已经进入 B 区的进攻方，需要决定是守住枪位、主动穿烟抢节奏，还是后撤与队友重组。

---

## 2. Scenario Thesis

核心冲突：

> **资源与站位安全 vs 主动创造机会**

这里不是典型“已经放弃回合的纯保枪局”。

在 `0:32`、Bomb 尚未下包、Falcons 仍有 4 人存活的情况下，CT 仍然存在争夺本回合的现实空间。

真正的取舍是：

- 保住当前 B Doors 枪位和 M4A1-S，等待更稳的协同；
- 主动穿烟承担第一接触风险，抢在下包前创造人数机会；
- 放弃当前前沿接触点，向队友靠拢后以更完整阵型重新处理 B 区。

三个 Call 都必须被表达为合理的风险结构，不能因为历史上 karrigan 的主动操作成功，就把它包装成唯一正确答案。

---

## 3. User-visible Facts

用户在决策时可以确认：

- 当前为 Dust2，Round 20；
- 剩余时间 `0:32`；
- 比分为 Team Spirit `9` : `10` Falcons；
- Team Spirit 5 人存活，Falcons 4 人存活；
- Bomb 尚未下包；
- Falcons 已明确知道 Spirit 的主要兵力已经进入 / 占据 B 包点区域；
- karrigan 位于 B Doors 附近；
- karrigan 当前 `99 HP`；
- karrigan 使用 `M4A1-S`；
- karrigan 手中仍有可用道具，其中至少包含烟雾弹（按人工观看核验）；
- 其余三名 CT 距离并不远：两人在中门附近，一人在警家 / CT 后场一侧；
- 这些队友具备在极短时间内向 B 门外形成协同的条件；
- 当前 B Doors 附近存在烟雾，直接穿烟意味着主动承担短时间的视野与暴露风险。

### Utility boundary

道具状态以用户提供的 HUD 截图作为人工核验依据。

除已经人工确认的 karrigan 关键道具外，**不要仅凭低分辨率图标由 AI 擅自补写其他队员具体投掷物名称或数量**。

### Information boundary

只展示 Falcons 当时已经可以合理确认的进攻信息。

允许：
- 表达 B 区已经有多名 Spirit 进攻方；
- 在 Tactical Preview 中用黄色进攻方 Marker 表示已确认进入 B 区的进攻压力；
- 显示 Falcons 自方四名存活 CT 的位置。

禁止：
- 补写未被 Falcons 确认的精确 T 方站位；
- 预测 Spirit 下一步移动；
- 把“穿烟后会拿到双杀”提前展示；
- 在首次决策画面显示历史结果。

---

## 4. Marker Mapping

### Falcons / CT — 天蓝色

- `8` = karrigan
- `7` = kyousuke
- `9` = m0NESY
- `0` = NiKo

### Team Spirit / T — 黄色

B 区中的 `1 / 2 / 3 / 4`：

> 表示 Falcons 已确认进入 / 占据 B 区域的四名进攻方。

如具体编号与真实选手姓名未逐一核验：

> UI 只使用编号，不擅自绑定姓名。

### Visual rule

- `8 / 7 / 9 / 0` 统一使用天蓝色；
- `1 / 2 / 3 / 4` 统一使用黄色；
- karrigan 的 `8` 号周围**不加红圈**；
- 不使用“正确答案”颜色；
- 不使用绿色对勾或胜负暗示。

---

## 5. Call Options

### CALL A

**名称：守住 B 门位置**

**用户界面短标签：**

> A · 守住 B 门位置

**语义：**

karrigan 不主动穿过 B Doors 烟雾，保留当前 M4A1-S、枪位与生存状态，等待烟雾变化或等待正在靠近的队友形成更稳的协同，再处理 B 区。

**Tactical Preview：**

- `8` 号基本保持 B Doors 当前枪位；
- 不绘制 `8` 号穿烟箭头；
- `0 / 7 / 9` 可以表现为向 B 门外围形成协同，但不要立即冲入 B 点；
- B 区黄色进攻方保持为已知压力来源；
- 烟雾继续表达视线阻断。

**决策收益：**

- 保留 M4A1-S 与当前位置；
- 避免单人承担烟内第一接触；
- 给队友更多时间形成同步协同。

**主要风险：**

- Spirit 可能利用这几秒完成下包或建立更稳固的 B 区站位；
- 等待会把主动权交给进攻方；
- 烟雾消散前后的处理窗口可能迅速缩小。

**Qualitative metrics：**

- 资源安全：高
- 第一接触风险：低
- 主动性：低
- 协同等待：高

**描述：**

> “守住 B Doors 的枪位与步枪资源，等待更完整的队友协同后再处理 B 区。”

---

### CALL B

**名称：主动穿烟反清**

**用户界面短标签：**

> B · 主动穿烟反清

**语义：**

karrigan 主动穿过 B Doors 烟雾，承担最初数秒的视野与暴露风险，抢在 Spirit 稳定下包和重组站位前制造人数机会。

这一 Call **不是孤立的个人英雄主义操作**。

根据人工观看：

> karrigan 先手进入后，约 `2–3 秒` 内 Falcons 队友迅速跟进补枪 / 协同进入 B 区。

因此它的结构是：

> **先手承担风险 → 打开极短协同窗口 → 队友快速跟进**

**Tactical Preview：**

- `8` 号从 B Doors 穿过烟雾向 B 区主动前压；
- `0 / 7 / 9` 在后方快速向 B 门外围 / B 区协同方向靠近；
- 必须表现 `8` 先动、队友稍后跟进的节奏差；
- 不模拟任何击杀；
- 不显示 Spirit 因此如何反应。

**决策收益：**

- 抢在 Bomb 下包前制造接触；
- 有机会打乱 T 方站位与下包节奏；
- 第一接触若创造窗口，队友可以在 2–3 秒内把它转化为团队协同。

**主要风险：**

- karrigan 首先承担穿烟后的最大暴露风险；
- 一旦首接触失败，会同时失去 M4A1-S 与 B Doors 前沿位置；
- 队友的补枪存在短暂时间差，并非同步瞬间发生。

**Qualitative metrics：**

- 主动性：高
- 第一接触风险：高
- 节奏创造：高
- 后续协同速度：高

**描述：**

> “先手穿烟抢在下包前制造机会，再由快速跟进的队友把第一接触转化为团队反清。”

---

### CALL C

**名称：后撤重组**

**用户界面短标签：**

> C · 后撤重组

**语义：**

karrigan 放弃当前 B Doors 前沿接触点，不继续单独贴烟处理，而是向中门 / CT 后场队友方向收缩。Falcons 先形成更完整的四人结构，再重新组织 B 区处理。

**Tactical Preview：**

- `8` 号从当前 B Doors 前沿向队友方向后撤；
- `0 / 7 / 9` 向同一协同区域收拢；
- 动画必须先表现“收缩 / 重组”，不要直接画成四人同时冲 B；
- B 区黄色进攻方继续作为已知压力；
- 不预测重组后的具体击杀或回防结果。

**决策收益：**

- 降低 karrigan 被单独处理的风险；
- 提高后续交易与补枪完整性；
- 把四名 CT 重新组织成更清晰的团队结构。

**主要风险：**

- 主动放弃 B Doors 当前前沿位置；
- Spirit 获得额外时间下包、补烟或建立交叉火力；
- 重新组织会消耗本就有限的回合时间。

**Qualitative metrics：**

- 阵型完整性：高
- 单点风险：低
- 时间成本：中 / 高
- 前沿控制：低

**描述：**

> “放弃当前孤立前点，先与队友重组成更完整的四人结构，再处理 B 区。”

---

## 6. Three-call Distinction

| Call | karrigan 第一动作 | 是否穿烟 | 是否先与队友重组 | 核心取舍 |
|---|---|---:|---:|---|
| A | 守住当前枪位 | 否 | 等待协同靠近 | 保存枪位 / 资源 vs 失去主动窗口 |
| B | 主动前压 | 是 | 否，先手后跟进 | 第一接触风险 vs 主动创造机会 |
| C | 主动后撤 | 否 | 是 | 阵型完整性 vs 时间和前沿控制 |

A 与 C 不能合并：

- A 是**保留 B Doors 当前枪位**；
- C 是**主动放弃该前沿位置并重新组织阵型**。

---

## 7. Reason Options

不要新增 Domain ReasonId。

优先复用当前冻结 Schema：

### `resource_preservation`

可见文案：

> 保留 M4A1-S 与当前枪位

适用于：
Call A / Call C。

### `known_position`

可见文案：

> 已确认多名进攻方进入 B 区

适用于：
三种 Call。

### `time_pressure`

可见文案：

> Bomb 尚未下包，但只剩 0:32

适用于：
Call B，也可以挑战 A / C 的等待成本。

### `utility_advantage`

可见文案：

> B Doors 烟雾改变了双方的接触方式

适用于：
Call A / B。

可选：

### `numbers_advantage`

当前 Falcons 为 4v5，**不是人数优势**，因此不要把它作为正向理由。

### `unknown_space`

本局主信息并非“完全不知道敌人在哪”，因为 Falcons 已确认大量 T 已进入 B。除非具体文案只指烟后微观站位，否则不建议作为主要 Reason。

---

## 8. AI Challenge Guidance

AI 只能挑战用户方案中的结构性假设，不能引用历史结果。

### 若用户选择 Call A

优先挑战：

- 你在保存 M4A1-S 与 B Doors 枪位，但 Bomb 尚未下包；等待是否会主动让出阻止下包的最后窗口？
- 队友确实正在靠近，但你是否假设了 Spirit 会在这几秒内保持静止？
- 烟雾提供安全边界的同时，是否也让你失去了主动改变回合节奏的机会？

### 若用户选择 Call B

优先挑战：

- 穿烟意味着 karrigan 首先承担最大暴露风险；你是否高估了 2–3 秒后队友跟进对第一接触的保护？
- 如果第一接触立即失败，M4A1-S 和 B Doors 前沿控制会同时丢失。
- “敌人已经进入 B”是否足以证明现在必须主动穿烟，而不是守住烟边等待协同？

### 若用户选择 Call C

优先挑战：

- 后撤能提高阵型完整性，但是否会直接让 Spirit 获得下包时间？
- 你是否为了追求更完整的协同，放弃了当前唯一能立即干扰 B 区节奏的前沿枪位？
- 0:32 的时间是否允许一次明显后撤再重新组织？

固定边界：

- 不得说哪一个 Call 是“正确答案”；
- 不得引用 karrigan 最终拿到双杀来诱导用户；
- 不得输出胜率；
- 不得模拟穿烟后的具体敌方反应；
- 不得把职业路径当作最优解证明。

---

## 9. Professional Reference

**Professional Call:** B — 主动穿烟反清

**历史职业路径：**

在 Bomb 尚未下包、Spirit 已经大量进入 B 区的情况下，karrigan 没有选择守住 B Doors，也没有先后撤重组。

他主动穿过 B Doors 烟雾，以 M4A1-S 承担第一接触风险，并取得两次关键击杀。

约 `2–3 秒` 后，Falcons 队友迅速跟进补枪 / 协同进入 B 区，把这次先手创造的窗口转化为团队反清。

随后 Falcons 完成协同清场，Spirit 未能完成下包。

### 必须表达

> “这是历史上真实发生的一条职业路径，不是唯一正确答案。”

同时强调：

> “这次主动操作成功制造了团队窗口，不代表穿烟在决策时刻属于低风险或唯一合理选择。”

### 禁止表达

- karrigan 的穿烟是标准答案；
- Call A / C 是错误选择；
- 双杀结果证明穿烟必然合理；
- 职业选手的个人枪法结果可以反向证明决策本身无风险。

---

## 10. Tactical Preview Rules

使用统一 Dust2 map base。

允许表现：

- Falcons 四名存活 CT Marker；
- 已确认进入 B 区的黄色 T 方压力 Marker；
- B Doors 烟雾；
- 当前 Call 对应的 authored movement；
- information / pressure / risk zones；
- qualitative metrics。

严格禁止：

- 模拟 karrigan 双杀；
- 模拟后续击杀；
- 模拟 Spirit 下一步反应；
- 下包成功 / 失败动画；
- 胜率；
- “最佳方案”视觉；
- 绿色对勾；
- 任何把 Call B 暗示成正确路线的颜色或动效。

固定显示：

> “战术空间预览 · 非比赛结果预测”

---

## 11. Route Reference Handling

用户已经提供 A / B / C 三张手绘路线参考。

这些图片的用途是：

> **确认战术语义与空间方向。**

不要求：

- 为三张图强制建立特殊文件命名规范；
- 让 DeepSeek 等纯文本模型理解图片；
- 把手绘箭头直接作为正式 UI；
- 提前单独维护额外坐标 JSON。

Stage 5 / Task 12 接入时：

> 由 Implementer 根据本 SPEC 的文字语义与现有统一 TacticalPreview renderer，将路线适配为现有 `0..100` normalized coordinates。

若现有 Agent 无法可靠完成坐标映射，再单独补一次人工坐标标定，不提前制造额外工作。

---

## 12. Utility / HUD Reference

当前 HUD 人工核验素材包含：

- karrigan：`99 HP`，`M4A1-S`；
- Falcons 其余存活队员的 HP / 武器 / 可见道具状态；
- B Doors 附近烟雾；
- 当前 money 信息。

页面首次决策只展示真正影响 Call 的必要信息。

不要做完整 HLTV 式 HUD 数据堆叠。

推荐第一层只显示：

- 5v4；
- 0:32；
- Bomb 尚未下包；
- 已确认大量 T 在 B；
- karrigan：99 HP + M4A1-S；
- B Doors 烟雾；
- 三名 CT 队友能够快速靠近。

其他 money / utility 只在确实影响决策时补充。

---

## 13. Sources

**HLTV match:**  
https://www.hltv.org/matches/2395001/spirit-vs-falcons-iem-cologne-major-2026

**BO3.gg match / economy:**  
https://bo3.gg/matches/spirit-vs-falcons-esports-20-06-2026

**BLAST.tv match:**  
https://blast.tv/cs/tournaments/iem-cologne-major-2026/match/c5faedd3/spirit-falcons

**ESL Archives VOD:**  
https://www.youtube.com/watch?v=fmHU01rVThM

**VOD map start reference:**  
Dust2 从约 `01:59:01` 开始。

**HLTV highlight marker:**  
`M3R20`

人工核验优先级：

> 原始 VOD / Demo > HUD 截图 > HLTV metadata / highlight > 二手文字复盘

---

## 14. Integration Boundary

这是 Lite 3 的真实 Scenario 内容接入。

目标：

- 替换对应 Lite 3 Fixture；
- 复用现有 Situation、Decision、AI Challenge、Tactical Preview、Professional Reference、Round Review 与 Connection Report；
- 不增加任何新的 Domain 架构。

不要：

- 新增 ReasonId；
- 新写 TacticalPreview renderer；
- 新增 Replay Engine；
- 修改统计定义；
- 修改 AI Contract；
- 因 Professional Path 成功而修改 A/B/C 的中性表达；
- 让模型自行推断未核验道具或经济事实。

只有赛事、回合、时间、人数、Objective、用户可见 Facts、Professional Path 与素材来源全部完成最终人工核验后：

```ts
verified: true
```

---

## 15. Acceptance Checklist

- [ ] 显示 Spirit vs Falcons、Dust2、Round 20、0:32、9:10；
- [ ] 显示 Spirit 5 人、Falcons 4 人存活；
- [ ] 明确 Bomb 尚未下包；
- [ ] karrigan 显示 99 HP + M4A1-S；
- [ ] CT Marker 8 / 7 / 9 / 0 使用统一天蓝色；
- [ ] 已确认的 B 区 T 方压力使用黄色；
- [ ] 8 号不使用红色 Bomb Carrier 外圈；
- [ ] Call A = 守住 B Doors；
- [ ] Call B = 主动穿烟反清；
- [ ] Call C = 后撤重组；
- [ ] Call A 与 Call C 不被合并；
- [ ] Call B 动画表现 karrigan 先手，队友随后快速跟进；
- [ ] 不模拟历史双杀；
- [ ] Professional Call 为 B；
- [ ] 明确 Professional Reference 不是标准答案；
- [ ] 不新增 ReasonId；
- [ ] test / typecheck / lint / build 全部通过。
