import { z } from "zod";
import { RoundResultSchema } from "@/domain/schemas";
import { calculateConnectionStats } from "@/domain/stats";
import { buildFallbackReport } from "@/domain/fallback";
import {
  eligibleObservationIds,
  OBSERVATION_CHOICE_OPTIONS,
  resolveReportObservation,
} from "@/domain/reportObservation";
import { parseReportChooseContent } from "@/lib/aiParsing";
import { requestChatCompletion } from "@/lib/aiClient";
import { readAiTimeoutMs } from "@/lib/aiConfig";
import { consumeAiBudget, getAiRequestKey } from "@/lib/aiBudget";

export const dynamic = "force-dynamic";

const ReportRequestSchema = z.object({
  rounds: z.array(RoundResultSchema).length(3),
});

const SYSTEM_PROMPT = [
  "你是一个观察角度选择器，不是裁判。",
  "只能从候选列表中选择一个要强调的角度，输出对应的候选 id。",
  "不得输出候选以外的自由文本或自行改写字句。",
  "不得做人格诊断。",
  "不得使用“正确答案”“答错”“必然”“唯一最优”等措辞。",
  "输出 JSON，字段：choose（候选 id 字符串）。",
].join("\n");

function buildUserPrompt(rounds: z.infer<typeof ReportRequestSchema>["rounds"]) {
  const stats = calculateConnectionStats(rounds);
  const options = eligibleObservationIds(stats)
    .map((id) => `- ${id}：${OBSERVATION_CHOICE_OPTIONS[id]}`)
    .join("\n");
  return [
    "以下为本次 3 个案例由程序计算的统计，数字只作参考，不要修改。",
    `总局数：${stats.totalRounds}`,
    `AI 分歧：${stats.disagreementCount}`,
    `分歧后采纳：${stats.acceptanceCount}`,
    `独立坚持：${stats.persistenceCount}`,
    `初始职业趋同：${stats.initialProfessionalAlignmentCount}`,
    `最终职业趋同：${stats.finalProfessionalAlignmentCount}`,
    "",
    "从候选中选择一个本次要强调的角度：",
    options,
    "",
    '只输出 JSON：{"choose":"<候选 id>"}',
  ].join("\n");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const parsed = ReportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const rounds = parsed.data.rounds;
  // 程序计算好的统计，模型不得改动。
  const stats = calculateConnectionStats(rounds);

  if (!consumeAiBudget("report", getAiRequestKey(request))) {
    return Response.json(
      { observation: buildFallbackReport(stats), source: "fallback" },
      { status: 200 },
    );
  }

  // 任何 AI 相关异常都回退到 deterministic fallback，fallback 对产品是正常成功响应。
  try {
    const timeoutMs = readAiTimeoutMs("AI_REPORT_TIMEOUT_MS", 8_000);
    const content = await requestChatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(rounds) },
      ],
      timeoutMs,
      maxTokens: 128,
    });
    const parsedContent = parseReportChooseContent(content);
    // AI 只能选候选 id；未知 id / 不符合当前统计的候选 / 自由文本一律回退。
    const observation =
      parsedContent === null
        ? null
        : resolveReportObservation(parsedContent.choose, stats);
    if (observation === null) {
      return Response.json(
        { observation: buildFallbackReport(stats), source: "fallback" },
        { status: 200 },
      );
    }
    return Response.json(
      { observation, source: "live" },
      { status: 200 },
    );
  } catch {
    return Response.json(
      { observation: buildFallbackReport(stats), source: "fallback" },
      { status: 200 },
    );
  }
}
