import { z } from "zod";
import { CallIdSchema, ReasonIdSchema } from "@/domain/schemas";
import { scenarios } from "@/data/scenarios";
import { buildFallbackChallenge } from "@/domain/fallback";
import {
  normalizeChallengeContent,
  parseChallengeContent,
  type ParsedChallengeContent,
} from "@/lib/aiParsing";
import { requestChatCompletion } from "@/lib/aiClient";
import { readAiTimeoutMs } from "@/lib/aiConfig";
import { consumeAiBudget, getAiRequestKey } from "@/lib/aiBudget";
import { isSafeChallengeContent } from "@/lib/aiSafety";
import type { CallId, ChallengeOutput, ReasonId, Scenario } from "@/domain/types";

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
  "第三步（第二意见）：此时才读取用户的判断依据，并从给定的引用中选择要承接的理由与要复盘的事实。",
  "模型不得输出 acknowledge、blindspot、question 自由文本，也不得新增选手位置、道具、经济、比分或其他比赛事实。",
  "输出只能是封闭 JSON：stance、acknowledgeReasonIds、blindspotFactIndex、questionFactIndex、alternativeCall。",
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
    .map((fact, index) => `- Fact ${index}（${fact.label}）：${fact.detail}`)
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
    "请只输出 JSON，字段：stance(“agree”或“challenge”)、acknowledgeReasonIds(只能从用户判断依据的 id 中选 1-2 个)、blindspotFactIndex(只能填 Fact 编号)、questionFactIndex(只能填 Fact 编号)、alternativeCall(null 或 “A”/“B”/“C”)。alternativeCall 只能来自你的独立首选，不得直接复述用户选择。",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderLiveChallenge(
  content: ParsedChallengeContent,
  scenario: Scenario,
  initialCall: CallId,
): Omit<ChallengeOutput, "source"> {
  const normalized = normalizeChallengeContent(content, initialCall);
  const reasonLabels = normalized.acknowledgeReasonIds
    .map((reasonId) =>
      scenario.reasonOptions.find((reason) => reason.id === reasonId)?.label,
    )
    .filter((label): label is string => Boolean(label));
  const blindspotFact = scenario.situation.facts[normalized.blindspotFactIndex];
  const questionFact = scenario.situation.facts[normalized.questionFactIndex];
  const comparison = normalized.alternativeCall
    ? `Call ${initialCall} 与 Call ${normalized.alternativeCall}`
    : "继续保持原判断";

  return {
    stance: normalized.stance,
    acknowledge:
      reasonLabels.length === 1
        ? `你把「${reasonLabels[0]}」作为主要依据。`
        : `你主要依据「${reasonLabels[0]}」和「${reasonLabels[1]}」做出判断。`,
    blindspot: `已知事实「${blindspotFact.label}」：${blindspotFact.detail}。这项信息本身不等于原判断没有其他风险。`,
    question: `基于「${questionFact.label}」这一已知事实，你会如何重新评估${comparison}？`,
    alternativeCall: normalized.alternativeCall,
  };
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

  if (!consumeAiBudget("challenge", getAiRequestKey(request))) {
    return Response.json(
      buildFallbackChallenge(scenario, initialCall, reasonIds),
      { status: 200 },
    );
  }

  // 任何 AI 相关异常都回退到 deterministic fallback，fallback 对产品是正常成功响应。
  try {
    const timeoutMs = readAiTimeoutMs("AI_CHALLENGE_TIMEOUT_MS", 5_000);
    const content = await requestChatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(scenarioId, initialCall, reasonIds) },
      ],
      timeoutMs,
      maxTokens: 384,
    });
    const parsedContent = parseChallengeContent(content);
    if (
      parsedContent === null ||
      !isSafeChallengeContent(parsedContent, scenario, reasonIds)
    ) {
      return Response.json(
        buildFallbackChallenge(scenario, initialCall, reasonIds),
        { status: 200 },
      );
    }
    return Response.json(
      { ...renderLiveChallenge(parsedContent, scenario, initialCall), source: "live" },
      { status: 200 },
    );
  } catch {
    return Response.json(
      buildFallbackChallenge(scenario, initialCall, reasonIds),
      { status: 200 },
    );
  }
}
