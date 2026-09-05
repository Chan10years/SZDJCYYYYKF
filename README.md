# Connected Decisions

**项目暂名：** 连接判断 / Connected Decisions
**产品规格：** `PRODUCTION.md` · **开发计划：** `TASKS.md`

## 项目目标

> 当人的独立判断连接 AI 的第二意见以后，判断会发生什么变化？

本项目不是证明「AI 会给正确答案」，而是可视化并记录：用户在连接 AI 之后，判断是否发生变化，以及这种变化如何被记录和呈现。

- App directory: `web`
- Package manager: `pnpm`

## 开发运行

```bash
cd web
pnpm install
cp .env.example .env.local
pnpm dev
```

## 检查命令

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## AI 环境变量

| 变量 | 说明 |
| --- | --- |
| `AI_BASE_URL` | OpenAI 兼容的 API Base URL |
| `AI_API_KEY` | 服务端 AI Key，禁止放在客户端 |
| `AI_MODEL` | 模型名 |
| `AI_CHALLENGE_TIMEOUT_MS` | Challenge 超时（默认 3500ms） |
| `AI_REPORT_TIMEOUT_MS` | 结果报告超时（默认 6500ms） |

> 即使未配置 AI Key，fallback 也应该能跑完整核心流程。