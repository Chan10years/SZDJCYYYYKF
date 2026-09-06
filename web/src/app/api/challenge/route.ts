import { z } from "zod";
import { CallIdSchema, ReasonIdSchema } from "@/domain/schemas";
import { scenarios } from "@/data/scenarios";
import { buildFallbackChallenge } from "@/domain/fallback";
import { normalizeChallengeContent, parseChallengeContent } from "@/lib/aiParsing";
import { requestChatCompletion } from "@/lib/aiClient";
import type { CallId, ReasonId } from "@/domain/types";

export const dynamic = "force-dynamic";

const ChallengeRequestSchema = z.object({
  scenarioId: z.string(),
  initialCall: CallIdSchema,
  reasonIds: z.array(ReasonIdSchema).min(1).max(2),
});

/**
 * 独立第二意见 Prompt：先独立判断，再看用户答案。
 * 用户选择不是先验；只有独立首选确实不同才给出 alternativeCall。
 * 职业路径 / 历史结果 / 后续击杀 / 比赛结果不得进入本 Prompt。
 */
const SYSTEM_PROMPT = [
  "你是战术 FPS 局面的“独立第二意见”生成器。按以下三步工作，顺序不可颠倒：",
  "第一步（独立判断）：只根据局面事实与三个可选方案的真实语义，独立比较 A/B/C，形成你自己最倾向的 Call。此步不要考虑用户选择了什么，不要从“用户为什么合理”开始推理。",
  "第二步（比较）：若你的独立首选与用户初始判断不同，alternativeCall 填你的独立首选；若相同，alternativeCall 填 null。用户选择不是先验正确答案；不要因为另一个方案“也合理”就制造分歧，也不要附和用户，只有独立首选确实不同才给出 alternativeCall。",
  "第三步（第二意见）：此时才读取用户的判断依据，写出其合理部分（acknowledge）、其可能忽略的风险或信息（blindspot）、以及一个真正要求用户重新判断的问题（question）。",
  "只能使用提供的场景事实；不得新增选手位置、道具、经济、比分或其他比赛事实。",
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
  // 三个 Call 的真实语义必须全部提供，否则模型无法独立比较，只能复述用户选择。
  const calls = scenario.calls
    .map((c) => `- Call ${c.id}（${c.label}）：${c.description}`)
    .join("\n");

  return [
    `局面：${scenario.title}`,
    `目标：${scenario.situation.objective}（时间 ${scenario.situation.time}，存活 ${scenario.situation.alive}）`,
    "事实：",
    facts,
    "可选方案：",
    calls,
    "",
    "先独立完成第一步与第二步，再阅读以下内容：",
    call
      ? `用户初始判断：Call ${call.id}（${call.label}）。`
      : "",
    reasonLabels.length > 0
      ? `用户判断依据：${reasonLabels.join("、")}`
      : "",
    "",
    "请输出 JSON，字段：stance(“agree”或“challenge”)、acknowledge、blindspot、question、alternativeCall(null 或 “A”/“B”/“C”)。alternativeCall 只能来自你的独立首选，不得直接复述用户选择。",
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
    // 归一化：alternativeCall 必须不同于用户 Initial Call（独立首选相同 → null）。
    return Response.json(
      { ...normalizeChallengeContent(parsedContent, initialCall), source: "live" },
      { status: 200 },
    );
  } catch {
    return Response.json(
      buildFallbackChallenge(scenario, initialCall, reasonIds),
      { status: 200 },
    );
  }
}