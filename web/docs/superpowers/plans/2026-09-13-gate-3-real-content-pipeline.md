# Gate 3 — Real Content Pipeline

## Objective

让真实 CS2 demo 通过一个可配置、可批量复用的离线提取核心进入内容生产，减少重复解析、回合定位、时间换算、roster 归属、Bomb fold 和事实 QA 摘录；不自动生成 Call、Reason、trade-off、Tactical Preview 或 Professional 判断。

## Scope

- 在现有 `demoparser2==0.42.0` 解析核心上增加 `ExtractionSpec`，将地图、目标回合、时间、roster、team number 和 overview 元数据变为配置。
- 保留 `extract_lite2_demo` 作为 Gate 1 兼容适配，不复制 parser、清图或 calibration。
- 增加真实 Overpass / Dust2 demo 的 manifest 与离线批量入口，产出 draft `NormalizedMatchState`，原始 `.dem` 不入库。
- 让 NormalizedMatchState 允许不同地图、队伍名和没有已核验 raster 的机器快照；缺少人工空间标定时不进入 Tactical Preview。
- 增加 Real Content Pack QA contract / screen，显式区分 machine-extracted facts 与必须由 Human QA 完成的 known/unknown、Call/Reason trade-off、Tactical Preview 和 Professional Reference。

## Non-goals

不引入数据库、登录、FastAPI、Worker/Queue、Replay Engine、Dataset CMS、Candidate/Decision Value Engine，不重写 Second Coach、reducer 或 TacticalPreview 核心，不自动把 draft 提升为 practice/verified。

## Verification

- Python unit tests and real demo batch extraction against the external Overpass/Dust2/Mirage `.dem` files.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Browser verification of the Gate 3 content QA page and the existing Gate 1 flow.
- Inspect diff, ensure no raw demos/secrets/build output are staged, commit only the Gate 3 changes.
