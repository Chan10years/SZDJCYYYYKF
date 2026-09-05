import { z } from "zod";
import { CallIdSchema, ReasonIdSchema } from "@/domain/schemas";
import { scenarios } from "@/data/scenarios";
import { buildFallbackChallenge } from "@/domain/fallback";
import { parseChallengeContent } from "@/lib/aiParsing";
import { requestChatCompletion } from "@/lib/aiClient";
import type { CallId, ReasonId } from "@/domain/types";

export const dynamic = "force-dynamic";

const ChallengeRequestSchema = z.object({
  scenarioId: z.string(),
  initialCall: CallIdSchema,
  reasonIds: z.array(ReasonIdSchema).min(1).max(2),
});

const SYSTEM_PROMPT = [
  "你是“第二意见”生成器，不是裁判。",
  "只能使用提供的场景事实。",
  "必须引用用户的初始 Call 或理由。",
  "不得新增选手位置、道具、经济、比分或其他比赛事实。",
  "不得使用“正确答案”“答错”“必然”“唯一最优”等措辞。",
  "输出简短 JSON。",
].join("\n");

function buildUserPrompt(
  scenarioId: string,
  initialCall: CallId,
  reasonIds: ReasonId[],
): string {
  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }
  const call = scenario.calls.find((c) => c.id === initialCall);
  const reasonLabels = reasonIds
    .map((id) => scenario.reasonOptions.find((r) => r.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  const facts = scenario.situation.facts
    .map((fact) => `- ${fact.label}：${fact.detail}`)
    .join("\n");

  return [
    `局面：${scenario.title}`,
    `目标：${scenario.situation.objective}（时间 ${scenario.situation.time}，存活 ${scenario.situation.alive}）`,
    "事实：",
    facts,
    call
      ? `你的初始判断：Call ${call.id}（${call.label}）。${call.description}`
      : "",
    reasonLabels.length > 0
      ? `你的判断依据：${reasonLabels.join("、")}`
      : "",
    "",
    "请输出 JSON，字段：stance(“agree”或“challenge”)、acknowledge、blindspot、question、alternativeCall(null 或 “A”/“B”/“C”)。",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const parsed = ChallengeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const { scenarioId, initialCall, reasonIds } = parsed.data;
  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) {
    return Response.json({ error: "unknown scenario" }, { status: 400 });
  }

  // 任何 AI 相关异常都回退到 deterministic fallback，fallback 对产品是正常成功响应。
  try {
    const timeoutMs = Number(process.env.AI_CHALLENGE_TIMEOUT_MS ?? 3500);
    const content = await requestChatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(scenarioId, initialCall, reasonIds) },
      ],
      timeoutMs,
      maxTokens: 512,
    });
    const parsedContent = parseChallengeContent(content);
    if (parsedContent === null) {
      return Response.json(
        buildFallbackChallenge(scenario, initialCall, reasonIds),
        { status: 200 },
      );
    }
    return Response.json({ ...parsedContent, source: "live" }, { status: 200 });
  } catch {
    return Response.json(
      buildFallbackChallenge(scenario, initialCall, reasonIds),
      { status: 200 },
    );
  }
}