# TASKS.md

# Connected Decisions — 当前执行计划

周期：**2026-09-09 → 2026-09-19**

当前最高优先级：**Gate 1 — Real Match Vertical Slice**。

产品主线仍是 Second Coach；真实 `.dem` 数据生产链是当前优先验证的内容生产能力，不是产品核心卖点。

统一流程：

`Implementer → Reviewer → Integrator → Gate 总控 → 上级总控`

只有总控确认 PASS 后才进入下一 Gate。每个 Round 单独 Git 留痕，尽量可审查、可回滚。

---

## Gate 0 — Trust & Reliability — CLOSED

Gate 0A / 0B / 0B-S / 0C 已结束。

结论：

- 20 files / 121 tests PASS；
- typecheck PASS；
- lint PASS；
- build PASS；
- NEW BLOCKER = 0；
- 已接受 waiver 作为 technical debt；
- 无明确回归证据不得重新打开 Gate 0。

不再保留 Gate 0 已完成工作的逐项 checkbox；后续工作只处理新的 Gate 目标或有证据的回归。

---

## Gate 1 — Real Match Vertical Slice — 当前最高优先级

### 目标

让真实训练赛中的一个比赛节点进入现有 Connected Decisions：

```text
真实 .dem
→ 真实比赛状态
→ TacticalPreviewData
→ ScenarioDraft
→ Human QA
→ Existing Connected Decisions
```

Gate 1 PASS 的最低标准：至少一个来自自己真实训练赛的节点真正进入现有 Connected Decisions，并能完成现有 Second Coach 流程。

Candidate 自动发现和 Observable Knowledge 全自动化不是 Gate 1 硬要求。

### Phase R — GitHub Wheel Survey — 当前执行

先调查现有成熟轮子，不写 production code。重点包括：

- `demoparser2`；
- `Awpy`；
- `demoinfocs-golang`；
- `csgo-2d-demo-viewer`；
- `cs2-map-icons`；
- `cs-demo-highlights`；
- 实际发现的高质量替代项目。

对每个候选比较：

- CS2 当前支持；
- 维护状态；
- License；
- API 能力；
- 集成难度；
- 与当前仓库的适配程度。

结论必须标注为：

- `DIRECT DEPENDENCY`；
- `PARTIAL REUSE`；
- `REFERENCE ONLY`；
- `NOT RECOMMENDED`。

Phase R 完成后必须交总控审批。未批准前禁止进入正式施工、依赖引入或 Pipeline 实现。

### Phase S — Minimum Spike

仅在 Phase R 获批后验证最小链：

```text
一个真实 .dem
→ 指定 Round
→ 指定 Tick
→ 时间 / 存活 / 玩家位置 / 武器 / 道具 / Bomb / 必要事件
→ NormalizedMatchState
→ TacticalPreviewData
→ 当前 Tactical Preview
```

不建设完整 Pipeline、上传平台、Dataset Platform、FastAPI、数据库、Worker、Queue 或 Replay Engine。

### Phase I — ScenarioDraft Integration

真实比赛节点 → `ScenarioDraft` → 人工 / 教练 QA → 现有 Second Coach 完整跑通。

解析结果和 Draft 不得自动进入 `verified`。Gate 1 只要求最小可验证链，不要求自动化整场比赛、Candidate 自动筛选或 Observable Knowledge 全自动化。

---

## Gate 2 — Second Coach Enhancement

### 目标

从“记录改没改”升级为“记录为什么这么判断、为什么坚持或改判、下一次学什么”。

重点：

- initial reasoning；
- AI Challenge；
- live / fallback source；
- keep / revise reason；
- Round Review reasoning chain；
- training takeaway / next check。

不做人格评分、正确率、复杂能力模型，也不把 Professional Alignment 当作标准答案分数。

---

## Gate 3 — Real Content Pack / Scenario QA

### 目标

形成少量真实、可信、可重复使用的 Scenario，优先来自真实训练赛。

关注：

- provenance；
- Round / timestamp；
- perspective；
- Known / Unknown；
- Call trade-off；
- Tactical correctness；
- coach / professional reference；
- verification status。

不以数量作为主要 KPI。每个正式 Scenario 必须经过人工核验；`draft / practice / verified` 必须保持语义隔离。

---

## Gate 4 — Candidate / Production Automation — Stretch

只有 Gate 1–3 状态良好才进入：

```text
整场 .dem
→ event / state windows
→ rule-based candidate
→ Top-N
→ Human Accept / Reject
```

第一版使用规则，不做复杂模型。优先保存：

- candidate accepted / rejected；
- why interesting；
- reject reason。

这些记录为未来 Decision Value 数据积累基础。时间不足可以直接砍掉 Gate 4，不影响课堂目标。

---

## Gate 5 — Integration / Freeze / Demo

### 9 月 17–18 日

只做：

- main 集成；
- regression；
- 公网验证；
- classroom fresh entry；
- mobile / desktop；
- live / fallback；
- 演示流程；
- 备份录屏；
- blocker 修复。

禁止新大功能、大重构和新基础设施。9 月 18 日必须 Freeze。

### 9 月 19 日课堂演示

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

如果 Gate 1 的 `.dem` Spike 已完成，只作为技术升级加分项展示，不把 Demo Parser 当主卖点。AI Second Coach 是演示主角。

---

## 当前明确不做

除 Gate 1 已批准的最小 `.dem` Vertical Slice 外，不主动建设：

- 完整 Team SaaS；
- 登录 / 权限 / Team Account；
- PostgreSQL / 云数据库迁移；
- FastAPI 服务化；
- Redis / Celery / Queue / Worker；
- WebSocket；
- Coach CMS；
- 完整 Replay Engine；
- 自动 Verified Dataset；
- MP4 CV / OCR；
- HLAE 自动录制系统；
- Transformer / 胜率预测；
- 复杂 AI Candidate 模型；
- 多模型 / 多 Agent 产品架构；
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
