# Implementation Plan: Web Demo Import roster contract closure

**Goal:** 收口 Web Demo Import 在 10/11/12 个 parser identities、合法 spectator/observer/coach、身份重连与用户确认场景下的 roster recovery / round-side validation 契约；保持原始 `.dem` 只在浏览器 Worker 本地解析，不触碰 Ancient 地图支持及其他 Pipeline。

**Architecture:** 保留现有 `Worker → parser facts → adapter → inspection → normalized state` 链路，但把 parser observation、logical player identity、competitive match roster、round-specific CT/T assignment 明确拆开。自动恢复只消费可审计的 parser evidence；用户确认只选择本次导入的 10 个已存在身份，不产生或改写 parser fact。

**Tech Stack:** Next.js App Router, React, strict TypeScript, Zod, browser Worker/WASM parser, Vitest/React Testing Library, pnpm。

## 当前实现状态（截至本轮 targeted fix）

当前 HEAD 仍为 `8cbcf67`（Ancient support checkpoint）。本轮只在现有 Web Demo Import roster recovery 半成品上收口，未修改 Worker evidence schema、Ancient 地图支持或 reconnect / observer detection。

当前实现已经避免了最危险的数组裁剪：

- `public/workers/demoParserWorker.js` 从 parser header 生成 `playerIdentities`，从 Round `economy` 生成 CT/T side rows，并从非 warmup 回合内的 `kills/damage/shots/grenades/blinds/plants/defuses` 事件引用生成 direct evidence；economy、track、spawn、movement、inventory 没有被当作 direct roster evidence。
- `src/domain/demoImportAdapter.ts` 只有在没有 unresolved identity、direct candidate 的 logical SteamID 恰好为 10 个时才自动选择；11/12 identities 即使 direct candidate 恰好为 10 个也进入 confirmation。不按事件数量、slot 顺序或数组顺序裁成 10；确认后的 roster 仍必须在所有可选 Round 的冻结结束 side snapshot 中形成 5 CT / 5 T。
- `roundSideSnapshots` 允许包含额外 identity，再只对 canonical roster 做 5/5 校验；header `finalSide` 不参与 roster 或 round-side truth；halftime 的 side switch 可以正常发生。
- 用户确认使用 `rosterConfirmation.matchRosterIds`，只接受 10 个唯一、已存在且格式有效的 SteamID；确认后仍重新运行 inspection 和 round-side 校验，并在 exact tick 重新检查 10 个 parser rows。
- 当自动恢复存在 unresolved identity 或 direct candidate 不是恰好 10 个时，adapter 抛出带有 `canConfirm`、candidate IDs、unresolved IDs 和 identity evidence 摘要的 `DemoRosterRecoveryError`；不会把 11/12 个 parser identities 裁剪成 roster。
- `DemoImportClient` 在该 recovery error 可确认时保留同一个 browser Worker 和 parser base input；`confirmRoster()` 只对当前 import 提供显式选择，成功后把确认结果放入当前 `LoadedDemo`，失败可重试。
- `DemoImportScreen` 已提供最小 checkbox confirmation UI；确认成功后继续现有 Round / tick 选择流程。

当前仍需通过完整验证闭环，不能仅凭定向测试宣布完成：

1. `competitiveParticipationEvidence` 现在是按 identity 聚合的 `count + kinds`，它能表达“parser 在竞争回合内把该 slot 作为事件 actor/victim 引用过”，但不能单独表达事件的 round、tick、引用角色、来源完整性，也不等同于“官方 match roster 成员”。当前自动规则因此依赖 parser event 表的语义保证；若 parser 或 wrapper 把 observer/coach 产生的 activity 也放进同一引用空间，恰好 10 个 candidate 会有过拟合风险。
2. `(SteamID, slot)` 目前在代码中被正确注释为 parser-instance join key，但数据模型仍把单个 slot 放进 canonical roster，而且 inspection 全局拒绝重复 SteamID 或重复 slot。它对没有 connection epoch 的当前 parser 是安全的 fail-closed 行为，却不是一个可处理 reconnect / slot reuse / substitute 的完整 identity contract。
3. confirmation 现在已经有 API、client 和最小 UI；roster / validation 分支的错误文字已移除“原始文件未上传”，但仍需用真实 Ancient Demo 验证浏览器 Worker 保留和确认后的 normalized state。

官方 demoparser 文档把 `parsePlayerInfo` 描述为 player-info 表、把 `parseTicks` 描述为每 tick 的 player rows，并没有把二者定义成 canonical match roster；官方 issue 也记录过 `parsePlayerInfo` 返回 12 rows 的 Demo。因此 parser identity count 不能直接充当 roster count。[demoparser JS documentation](https://github.com/LaihoE/demoparser/blob/main/documentation/js/README.md) · [demoparser issue #339](https://github.com/LaihoE/demoparser/issues/339)

## 建议的产品契约

### 1. 四层数据边界

| 层 | 含义 | 可否直接进入下一层 |
| --- | --- | --- |
| Parser observation | parser 在某个 slot / parser instance 上观察到的 SteamID、name、track row、economy row、event reference | 只能作为原始事实，不能因 count 或 name 自动变成 roster |
| Logical player identity | 一个格式有效且稳定的 SteamID；只有在当前 import 内无冲突时才建立 | 允许参与候选集合；仍不是 roster truth |
| Competitive match roster | 本场固定 10 个 logical player IDs | 必须满足选择来源、identity integrity、所有 round side snapshot 和后续 exact tick 校验 |
| Round-specific side | 某个 Round freeze-end 的 CT/T assignment | 只从该 Round 的明确 CT/T side evidence 得出；不得回退 header finalSide 或 stale row |

`slot` 只绑定 parser observation。当前 parser 没有 connection epoch / reconnect continuity evidence，因此同一 SteamID 出现在多个 slot、同一 slot 出现多个 SteamID，都必须保持 ambiguity 并 fail closed；不能静默合并，也不能把 slot 当逻辑玩家 ID。

### 2. Automatic recovery 的边界

定义 `C` 为“具有至少一个合格 direct event reference 的唯一 logical SteamID 集合”，不是事件数量排名，也不是 `competitiveEventKinds` 数量排名。

自动恢复必须同时满足：

1. 所有 parser identities 都有有效字符串 SteamID；identity 与 evidence 的 parser-instance join 无歧义；没有重复 logical SteamID、slot reuse 或未经 connection evidence 的 identity transition。
2. direct reference 有可验证的 event kind、tick、已知非 warmup competitive Round 和合法 actor/victim/thrower/planter/defuser slot；world-only damage、self-damage、warmup、Round 外 event、未知 slot、缺失 SteamID 不计入 C。
3. 当前 parser 支持的 direct event family 仍只包括 `kills`、`damage`、`shots`、`grenades`、`blinds`、`plants`、`defuses`。其中它们证明的是“parser 将此 identity 归因到 competition-scoped event”，不是官方 lineup membership；movement、spawn、weapon/inventory、economy、track presence、name、slot 连续性、header finalSide 都不能单独提升 identity 级别。
4. 严格默认自动路径要求没有 unresolved identity 且 `C` 恰好包含 10 个 logical IDs；每个 candidate 在所有被纳入 inspection 的 Round side snapshot 中都有同一个 parser instance 的 CT/T evidence；每个 snapshot 过滤 canonical candidates 后恰好为 5 CT / 5 T。11/12 identities 即使 `C = 10` 也必须先 confirmation。
5. 任何多于 10 个 direct candidates 都是 ambiguity，禁止裁剪；任何少于 10 个 candidate 都不能因总 identity 数为 10/11/12 而补齐。

这是一条**充分条件**，不是对 parser 角色语义的绝对证明。若未来 parser version 无法保证 event actor refs 只来自游戏参与实体，应把该 parser capability 降级为“只能提供候选 / 需要 confirmation”，而不是增加阈值或猜测。

### 3. 10 / 11 / 12 identity 决策表

| parser identities | direct candidates C | 默认结果 | 说明 |
| ---: | ---: | --- | --- |
| 10 | 10 | automatic，前提是所有 Round 5/5 且 parser-instance 无冲突 | “10 个 identity”本身不是理由，direct + round coherence 才是理由 |
| 10 | <10 | recovery ambiguity | 可进入 confirmation；不能按缺失事件猜玩家 |
| 11/12 | 10 | confirmation，额外 identity 与 candidate 一起保持可审计但未决 | 当前 parser 没有独立 role / lifecycle evidence；即使恰好有 10 个 direct candidates，也不在默认路径直接写 canonical roster |
| 11/12 | <10 | recovery ambiguity | 允许 confirmation 选择已有且可验证的 10 人；不能由 count 补齐 |
| 11/12 | >10 | recovery ambiguity | 不得按 slot、名字、事件数、数组位置裁掉多余 candidate |
| 任意 | Round side 缺失或非 5/5 | validation failure | roster candidate 已有不代表 round side 已可信；错误应指出具体 Round |
| 任意 | identity / evidence / tick row join 冲突 | integrity / validation failure | 不能用 user confirmation 绕过 parser integrity |

对当前 Ancient Demo，已确认的可复现事实是：12 个 parser identities；slot 0 的 first-round economy team 为 `null`，因此它不进入 CT/T side snapshot；slot 11 有 CT/T economy 且 track row，但没有 direct competitive evidence；slots 1–10 形成 10 个 direct candidates，所有 24 个 Round 的 filtered side 都支持 5/5。当前严格默认路径应进入 confirmation，而不是直接产生 automatic roster；slot 0 和 slot 11 仍不能仅凭现有 parser facts 被可靠命名为 spectator、observer 或 coach。

### 4. Direct competitive evidence 的最终语义

推荐把 evidence 从“count + kinds 的身份摘要”收口为带 provenance 的 event reference 摘要，至少保留：`parserInstanceId`、`logicalSteamId`、`eventKind`、`roundNumber`、`tick`、引用角色和通过的过滤原因。聚合 count 可以继续作为诊断字段，但不能作为自动恢复依据。

最低接受条件：

- event tick 位于已识别的非 warmup Round `[startTick, endTick)` 内；Round 不明、tick 不明或未来 event 不接受；
- actor/victim/thrower/objective actor 的 slot 能回溯到同一个 parser observation；`kills/damage` 做现有的 non-world / non-self 过滤；
- event kind 在显式 allowlist 内；unknown / economy / movement / spawn / inventory / track rows 一律不是 direct evidence；
- 至少一条 reference 即可成为 candidate，但不能用 reference 数量或 kind 数量对身份排序；“一个玩家没有事件”只能表示 unresolved，不能表示非选手；
- 如果 parser 只给 event summary 而不能提供上述 provenance，自动恢复只能依赖 parser capability 的已验证保证；否则降级到 confirmation。

### 5. Identity、reconnect、slot 和 substitute

- `SteamID` 是 logical identity；`(SteamID, slot[, connectionEpoch])` 是 parser observation identity。
- 当前 browser parser 没有 connection epoch，重复 SteamID 跨 slot、slot reuse、同一 slot 的身份更替都保持 fail closed；错误归类为 roster recovery / identity validation，不包装成 parser runtime failure。
- 只有 parser 明确提供 connect/disconnect epoch、无重叠占用和 round-level continuity 后，未来才允许一个 logical player 绑定多个 parser observations；round side 与 exact tick 必须按 observation 绑定，不能按 SteamID 全局硬连。
- substitute 是新的 logical SteamID。当前固定“一个 import = 一个 10 人 match roster”的模型不能把换人前后静默并入同一个 roster；没有时间分段 roster contract 时应拒绝或要求显式人工范围选择，不能猜测。
- 缺失、非字符串、非稳定 numeric SteamID 不能被 confirmation 修复；name 只用于展示，不能用于 dedupe。

### 6. User confirmation 的最小 contract

`rosterConfirmation.matchRosterIds` 是本次 import 的显式 roster selection，不是 parser fact，也不是证据生成器。

允许条件：

- 恰好 10 个唯一、格式有效、存在于 parser identity 集合中的 logical SteamID；
- 选中的 identity 可以原本没有 direct event，但必须有独立的 round-side evidence，并在所有纳入 inspection 的 Round 中各出现一次；
- 每个 selected Round 继续独立验证 5 CT / 5 T；exact tick 继续验证 10 个唯一 parser rows、时间边界、side 一致性和位置字段；
- confirmation 只存于当前 `LoadedDemo` / 当前 import，不修改 raw worker output，不写未来 import，不把 unresolved 自动改写成 parser role。

拒绝条件：unknown / duplicate / stale ID、重复或冲突 parser instance、Round snapshot 缺失、exact tick 缺人、side 不是 5/5、parser runtime / Demo parse / malformed identity failure。用户“确认了”不能越过任何 parser integrity 或 normalized-state validation。

产品上若要开放 fallback，最小 UI 只需展示 parser identity table（name、SteamID、slot/instance、direct event provenance、round-side coverage、unresolved 状态），要求用户选择 10 人后重新提交；不提供 spectator/coach 自动标签，不保存为全局 roster。若当前阶段不做 UI，API contract 仍应保持上述边界，ambiguity 明确停在 recovery error。

### 7. Round-side 和错误语义

- economy entry 是该 Round 的 side-row source，不是 active-player / competitive-role 证明；额外 economy identity 可以保留在 raw snapshot，但不能通过它进入 roster。
- canonical roster 过滤后，每个 Round 必须为每个 selected logical identity 提供唯一 observation 和 CT/T side，恰好 5/5；halftime side switch 是合法事实；header finalSide 永不回退。
- exact tick 只接受 selected Round 的 validated side snapshot + exact parser rows；缺 row、wrong slot、future sample 或 side conflict 直接 `roster-validation`。
- `parser-runtime`、`demo-parse`、`roster-recovery`、`roster-validation`、`map-metadata` 保持独立；roster 已成功而地图 overview 缺失时，错误必须明确是 map metadata boundary，不覆盖前面结果。roster/validation 文案应移除“原始文件未上传”尾巴。

## 建议的实现顺序（用户批准后才执行）

### Task 1 — 先把 evidence / identity contract 变成可校验纯数据

Files:

- `src/domain/demoImport.ts`
- `src/domain/demoImportAdapter.ts`
- `public/workers/demoParserWorker.js`

Actions:

1. 为 parser observation、logical identity、direct event reference、round-side observation 明确类型和 provenance；保留向 normalized state 需要的最小兼容字段。
2. Worker 逐条生成经过 Round/tick/warmup/actor-slot 校验的 direct references；adapter 只按唯一 logical ID 集合恢复 candidate，不使用 count/kind 数量排序。
3. 把 parser capability / 缺失 provenance 作为显式的“自动不可用”条件，避免把 parser 中间字段升级为 canonical truth。
4. 保持当前 parser 没有 lifecycle evidence 时的 fail-closed 行为，并把错误归类为 identity/roster boundary。

### Task 2 — 独立 canonical roster 和 round-side validation

Files:

- `src/domain/demoImportAdapter.ts`
- `src/domain/demoImport.ts`
- `src/domain/demoImportErrors.ts`

Actions:

1. automatic path 只接受没有 unresolved identity 且唯一的 10 个 candidate；11/12 identities 中的 extras 保持 unresolved 并进入 confirmation。
2. confirmation path 只接受已有 logical IDs；无 direct event 的选手可由用户选择，但仍必须通过 round-side 和 exact-tick validation。
3. 将 static logical roster 与 per-round parser observation 解耦；在当前无 connection epoch 时明确拒绝 reconnect / slot reuse，而不是隐式合并。
4. 让 recovery ambiguity、selected-roster validation、map metadata error 在消息和 failure kind 上保持稳定且互不覆盖。

### Task 3 — 最小 fallback UI（已实现，待验证）

Files:

- `src/lib/demoImportClient.ts`
- `src/components/import/DemoImportScreen.tsx`
- `src/test/demoImportClient.test.ts`
- `src/test/demoImportScreen.test.tsx`

Actions:

1. 将 `DemoRosterRecoveryError` 的 candidate/unresolved 结构传到当前页面；不把它显示成 parser unsupported。
2. 提供 per-import 的 10 人选择并明确“这是人工确认，不是 parser 自动角色判断”；提交后重新执行全量 inspection/validation。
3. 不持久化 confirmation，不添加 spectator/coach 标签系统，不改其他复盘流程。

当前实现状态：上述 client 保留 Worker、per-import confirmation 和页面 checkbox 已完成；`src/test/demoImportClient.test.ts` 覆盖歧义、错误确认重试、同一 Worker 保留和确认后 exact-tick selection；仍需真实浏览器回归。

### Task 4 — 反例测试和真实 Demo 回归

Files:

- `src/test/demoImportAdapter.test.ts`
- `src/test/demoImport.test.ts`
- `src/test/demoImportClient.test.ts`
- `src/test/demoImportScreen.test.tsx`

Required fixtures:

1. 10 players；10 players + 1 spectator；10 players + coach + observer。
2. 10/11/12 identities with `C=10`、`C<10`、`C>10`，验证不依赖 identity order、slot 连续性、名字或 event count。
3. 真实玩家没有 direct event；extra identity 有 economy side；extra identity 有 direct-looking event 而另一名真实玩家没有 direct event，必须阻止自动选择。
4. warmup / Round 外 / world-only / self-damage / unknown-slot / unsupported event 不计 direct candidate；玩家只有一次合法 event 也不能被数量排序放大。
5. duplicate SteamID across slots、slot reuse、缺失/数值 SteamID、未来或重复 tick row、缺 Round side、halftime side switch、exact tick 缺人。
6. user confirmation 的 unknown/duplicate/stale/wrong-round/非 5/5 反例；确认不能绕过 parser integrity，成功后仍只生成 10 人 normalized state。
7. failure kind matrix：parser runtime、Demo parse、roster recovery、roster validation、map metadata 各自保持可观测。

Verification after implementation:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

再用真实 `D:\CodeLibrary\SZDJWZY\demo\bgp2_cs-57888-25f47_2026-09-11_21-45-31_de_ancient.dem` 在浏览器 Worker 路径验证：12 identities 的 evidence/provenance、10 automatic 或明确进入 confirmation、24 Round 的 5/5、R1/R2 的 exact tick，以及地图已成功生成 normalized state。不能用 Ancient 特判掩盖 roster 失败，也不使用本地离线 Pipeline 代替浏览器验证。

## 当前决定与验证边界

本轮采用严格默认 policy：当前 browser parser 没有独立 role / lifecycle evidence 时，任何 unresolved identity 或非恰好 10 个 direct candidates 都进入 per-import confirmation；不按 slot、名字、数组位置或事件数量裁剪。Worker evidence schema 保持不变。

已完成：domain error contract、adapter strict recovery、client confirmation retention、最小 confirmation UI、adapter/screen/client 定向测试夹具。

待完成：使用真实 Ancient Demo 验证 12 identities 自动进入 confirmation、选择 10 人、confirmation 后重新 validation 并生成 normalized state；随后执行 full tests、typecheck、lint、build。当前分支保持未提交，不进入 Independent Review。
