【Hero Scenario — Real Asset Integration Spec】

请将下面这个已经人工筛选的真实职业比赛 Scenario 接入现有 Connected Decisions 架构。

不要修改现有产品 thesis、Domain Contract 或 TacticalPreview 架构。
不要为该 Scenario 新写一套 renderer。
继续使用现有统一 TacticalPreview + 0..100 normalized coordinates。

==================================================

1. # Scenario Identity

Event:
IEM Cologne Major 2026

Match:
Team Spirit vs Falcons

Map:
Mirage

Round:
Round 5

Decision timestamp:
0:47

Score at decision:
Spirit 0 : 4 Falcons

State:
Team Spirit 3v2

Bomb:
zont1x 携带 C4

Alive Spirit players:

- tN1R
- zont1x
- sh1ro

================================================== 2. User-visible Facts
==================================================

决策截点发生在 tN1R 刚刚于 A1 清除 m0NESY 的 AWP 之后。

用户在该时刻可以确认：

- 当前为 3v2
- 剩余时间 0:47
- A 侧的 AWP / m0NESY 刚被击杀
- zont1x 携带 C4
- tN1R 位于 A 侧前沿
- zont1x 与 sh1ro 保持中路 / 下水道区域控制
- 剩余两名 Falcons 防守者位置未知
- Spirit 不存在明显枪械劣势

重要：
转播画面的 X-Ray 可以看到剩余 CT 的真实位置，
但这些属于 spectator information。

Situation Screen 与 Tactical Preview 中：
禁止显示剩余两名 Falcons 的实时位置。
不得通过 Zone、文字或箭头暗示 B 实际为空或某 CT 正在 rotation。

只允许保留：

- 三名 Spirit 玩家
- A1 已被击杀防守者的 X 标记
- 已验证的用户可见信息

================================================== 3. Marker Mapping
==================================================

当前地图素材中的编号：

1 = tN1R
4 = zont1x
5 = sh1ro

4 号外圈红色标记表示：
zont1x 当前携带 C4。

A1 附近的 X 表示：
刚刚被 tN1R 击杀的 m0NESY。

================================================== 4. Call Options
==================================================

CALL A
名称：
立即兑现 A 区优势

语义：
A1 AWP 刚被清除，利用当前确定信息，
让中路 / 下水道双人向 A 收缩，
与已经在 A 侧的 tN1R 汇合并执行 A。

Tactical Preview：

- tN1R 保持 A 侧压力，只做小幅向 A Site 收缩
- zont1x 与 sh1ro 从当前中路 / 下水道位置出发
- 经 Connector / 拱门方向向 A Site 汇合
- 最终表现为三名进攻队员向 A 收缩

视觉重点：
三人收缩至 A。

Metrics 建议：

- 信息确定性：高
- 兵力集中：高
- 转点空间：低

描述：
“兑现已确认的 A 区缺口，将三人快速集中到同一执行方向。”

---

CALL B
名称：
利用现有控制转向 B

语义：
不立即兑现 A 区击杀，
利用当前展开的空间结构，从两条路线向 B 形成压力。

Tactical Preview：

路线 1：
zont1x + sh1ro
从中路 / 下水道当前控制区域出发，
沿可通行的 B 侧路线进入 B Apartments / B 二楼体系，
最终进入 B Site。

路线 2：
tN1R
从 A 侧撤出，
沿后场 / CT rotation 路线向 Market（超市）侧移动，
最终从另一方向参与 B 区进攻。

注意：
必须沿 Mirage 实际可通行结构绘制路线，
禁止为了视觉效果画穿墙直线。

视觉重点：
两条不同路线最终同时指向 B，
形成多向 B 区压力。

Metrics 建议：

- 信息确定性：低
- 多向压力：高
- 转点成本：中 / 高

描述：
“放弃立即兑现 A，让现有分布转换成两条 B 侧进攻路线。”

---

CALL C
名称：
保持控图，继续获取信息

语义：
暂不锁定 A 或 B，
保持当前一人 A 侧、两人中路 / 下水道的展开结构，
继续使用剩余时间确认防守信息，
之后再决定最终执行方向。

Tactical Preview：

- 不绘制明确的进攻路线
- 三名玩家 Marker 基本保持当前区域
- 只允许轻微 pulse / position movement
- 可以表现少量 information / unknown zone
- 可使用非常淡的 A/B 分叉虚线表示两个执行方向仍然开放
- 不要让任何一条路线看起来已经 commit

视觉重点：
保持地图展开，不立即收缩。

Metrics 建议：

- 信息获取：高
- 路线灵活性：高
- 时间消耗：高

描述：
“暂不锁定 A/B，维持现有空间控制，用时间交换更多防守信息。”

================================================== 5. Professional Reference
==================================================

Professional Call:
C — 保持控图，继续获取信息

实际职业路径：

Spirit 在 A1 AWP 被清除后，
没有立即执行 A，
也没有立即转向 B。

三人继续维持地图控制。

随后 Spirit 在 VIP 再取得一次击杀，
局面进一步发展后，
最终转向 B 区完成执行。

必须表达为：
“历史上真实发生的一条职业路径。”

禁止表达为：

- 正确答案
- 最优解
- A/B 选择错误
- Spirit 的选择证明其他方案不成立

固定保留产品说明：
“这是历史上真实发生的一条职业路径，不是唯一正确答案。”

================================================== 6. Professional Video
==================================================

当前提供约 40 秒 Professional Reference 视频。

本次先直接使用该视频，不要求重新剪辑。
不要因为规格推荐 8–20 秒而擅自修改素材。

要求：

- controls
- playsInline
- preload="metadata"
- 禁止 autoplay audio
- 视频播放失败不得阻断流程

后续如 Release 阶段确认 40 秒严重影响体验节奏，
再单独决定是否压缩。

================================================== 7. Tactical Preview Rules
==================================================

使用同一张 Mirage map base。

只允许表现：

- Spirit 玩家 Marker
- A1 已击杀 X
- authored routes
- information / pressure / risk zones
- qualitative metrics

动画总长度约 1–2 秒。

严格禁止：

- 模拟后续击杀
- 模拟敌方 rotation
- 显示 Falcons 剩余玩家真实位置
- 枪线
- 下包模拟
- 胜负预测
- 胜率
- 任何“正确路线”视觉

固定显示：
“战术空间预览 · 非比赛结果预测”

================================================== 8. Asset Source
==================================================

Visual VOD:
Bilibili
BV1GpjW6YEnv
P3

VOD timestamp around:
11:33

Decision in-game timestamp:
0:47

同时保留 HLTV Match Page 作为赛事 / 比赛 / 地图 / Round
等 metadata 的交叉核验来源。

================================================== 9. Assets I will provide
==================================================

请等待我提供并使用：

1. Hero map base PNG
2. 0:47 decision full-HUD screenshot
3. Call A handwritten route reference
4. Call B handwritten route reference
5. Professional Reference MP4 (~40s)

Call C 不需要单独路线图，按照上述“保持控图”规则实现即可。

================================================== 10. Integration Boundary
==================================================

这是 Task 12 的真实 Scenario 内容接入。

目标：
用该真实 Hero Scenario 替换对应 Fixture 内容。

不要：

- 重构 TacticalPreview renderer
- 修改统计定义
- 修改 AI Contract
- 新增 Replay Engine
- 根据 VOD 猜测未验证比赛事实
- 擅自改变 A/B/C 战术语义

如果发现素材坐标需要适配：
仅把提供的手绘路线转换成 0..100 normalized coordinates。

接入完成后保持：
test / typecheck / lint / build 全部通过。
