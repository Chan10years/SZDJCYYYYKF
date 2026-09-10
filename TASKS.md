# TASKS.md

# Connected Decisions — 10 天升级执行计划

周期：**2026-09-09 → 2026-09-19**

目标：先修复现有产品可信度，再增强 Second Coach；`.dem` 自动化是加分项，不得抢主线。

统一流程：

`Implementer → Reviewer → Integrator → GPT 总控验收`

只有总控确认 PASS 后才进入下一 Gate。

## Gate 0A — 训练事实可信度

### 目标
修复真实 Audit 已复现的内容正确性问题。

### 必修
- [ ] Tactical Preview 地图 / 路线 / 区域 / 玩家位置正确；
- [ ] 修复 Situation 错配素材和未来信息泄漏；
- [ ] 修复 Connection Report Reason ID / Label 串数据；
- [ ] `draft / practice / verified` 全链路语义一致；
- [ ] 修复直接相关内容错误（回合描述、图例等）。

### 验收
- [ ] 当前三个 Scenario 全流程可完成；
- [ ] 人工核对地图 / Call / Reasons / Reference / Report；
- [ ] practice 不进入 verified professional 统计；
- [ ] 相关回归测试已补；
- [ ] test / typecheck / lint PASS。

### 不做
Demo Pipeline、Team Mode、数据库、Second Coach 大改、大型 UI 重构。

---

## Gate 0B — 运行可靠性与 AI 边界

### 必修
- [ ] Challenge 客户端请求有明确 timeout；
- [ ] hang / timeout 可 fallback 或 retry，不永久阻塞；
- [ ] localStorage 异常可降级为临时会话；
- [ ] quota / security denial 不导致页面崩溃；
- [ ] AI Challenge 不输出 Scenario 外精确事实；
- [ ] AI 不使用“唯一正确 / 必然”等裁判式措辞；
- [ ] live / fallback source 可追踪；
- [ ] 正式公网前明确 AI 调用成本 / 滥用边界。

### 验收
- [ ] AI success / timeout / invalid response / no-key fallback PASS；
- [ ] storage failure injection PASS；
- [ ] refresh / recovery PASS；
- [ ] test / typecheck / lint / build PASS。

---

## Gate 0C — Focused Re-audit

不重新做完整产品审查，只验证原 blocking issues 是否关闭。

检查：

- [ ] 原 P0/P1 逐项 RESOLVED / OPEN；
- [ ] agree / challenge+keep / challenge+revise；
- [ ] 三个 Scenario 全流程；
- [ ] mobile 基本可用；
- [ ] failure injection；
- [ ] 无明显 Scope Drift；
- [ ] 无新 release blocker。

只有总控给出 `PASS` 或 `PASS WITH WARNING` 才进入 Gate 1。

---

## Gate 1 — Second Coach 核心复盘增强

### 目标
从“记录改没改”升级为“记录为什么这样判断、为什么坚持或改判”。

### 优先工作
- [ ] 保存用户初始判断依据；
- [ ] 保留 AI Challenge 内容与 source；
- [ ] 坚持 / 改判时记录原因或关键条件；
- [ ] Round Review 展示：初始逻辑、AI 挑战点、最终判断、Professional Reference、本局训练点；
- [ ] Professional Alignment 不当作“正确率”；
- [ ] fallback 不为了制造 Challenge 而永远反对用户。

### 可选
- [ ] freeform reasoning；
- [ ] post-round reflection；
- [ ] next-training hypothesis；
- [ ] deterministic next-training suggestion。

### 验收
每个 Round Review 能回答：

1. 我为什么这么选？
2. AI 挑战了什么？
3. 我为什么坚持 / 改判？
4. 职业路径给了什么参考？
5. 下一次类似情况我要检查什么？

---

## Gate 2 — 内容补充与人工 QA

### 目标
减少固定三题的一次性 Demo 感，但不追求数量。

- [ ] 评估是否新增 2–5 个高质量 Scenario；
- [ ] 允许继续人工找比赛 / 回合 / 截点；
- [ ] 可以由同学协作做素材和初步标注；
- [ ] 新 Scenario 必须人工核验；
- [ ] Known / Unknown 明确；
- [ ] Tactical Preview 正确；
- [ ] Call 之间存在真实 trade-off。

如果 Gate 1 已足够支撑演示，可只补少量内容。

---

## Gate 3 — `.dem` Vertical Spike（加分项）

前提：Gate 0 完成且不影响 Second Coach 主线。

### 最小链路

```text
一个真实 .dem
→ 一个 Round
→ 一个 Tick
→ 玩家 / Bomb / Event 状态
→ NormalizedMatchState
→ TacticalPreviewData
→ 当前 TacticalPreview 正确显示
```

### 工作
- [ ] 用真实 `.dem` 验证解析；
- [ ] 比较 `demoparser2` / `Awpy`，选最小主路径；
- [ ] 定义最小 `NormalizedMatchState`；
- [ ] 完成真实坐标 → Tactical Preview 坐标转换。

### 不做
FastAPI、Redis、Worker、数据库、完整上传平台。

PASS 标准：真实比赛某个 Tick 可稳定、正确进入当前 Tactical Preview。

---

## Gate 4 — Candidate 预生产实验（Stretch）

仅在 Gate 3 PASS 且时间充足时做。

```text
整场 .dem
→ Event / State windows
→ rule-based Decision Value Score
→ Top-N 候选
→ 人工 Accept / Reject
```

允许复用开源 detector / scoring 思路；第一版使用规则即可。

不要求：完整 Knowledge Engine、自动 Verified Scenario、MP4 CV、HLAE、模型训练。

时间不足时直接放弃 Gate 4，不影响课堂目标。

---

## 9 月 18 日 — Freeze

当天不新增功能，只修演示阻断问题。

- [ ] 固定课堂演示路径；
- [ ] 完整跑至少 2 次；
- [ ] test / typecheck / lint / build 全 PASS；
- [ ] 公网地址可用（如需要）；
- [ ] fallback 可演示；
- [ ] 准备备份录屏；
- [ ] 关键素材本地可用；
- [ ] 晚上禁止架构重构。

---

## 9 月 19 日 — 课堂演示

主叙事：

```text
真实 CS2 决策场景
→ 玩家先独立判断
→ Reasons
→ AI Second Coach 压力测试
→ 坚持 / 改判
→ Tactical / Professional Reference
→ 决策复盘
```

核心表达：

> Connected Decisions 不是让 AI 替玩家做决定，而是给玩家和教练一个第二视角，帮助复盘判断过程。

如果 `.dem` Spike 已完成，只作为技术升级加分项展示，不把 Demo Parser 当主卖点。

---

## 当前不做

除非总控明确批准：

- 登录 / Team Account；
- PostgreSQL；
- FastAPI 服务化；
- Redis / Celery / Queue；
- WebSocket；
- Coach CMS；
- 完整 Replay Engine；
- MP4 CV；
- HLAE 自动录制系统；
- Transformer / 胜率预测；
- 大型 UI 重写。

---

## 每个 Gate 的统一返回格式

```text
STATUS: PASS / WARNING / FAIL / BLOCKED

RESOLVED:
- ...

OPEN:
- ...

TEST:
TYPECHECK:
LINT:
BUILD:

HEAD:
WORKSPACE:

SCOPE DRIFT:
NEXT GATE RECOMMENDATION:
```

总控负责最终决定是否进入下一 Gate。
