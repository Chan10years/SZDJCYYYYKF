import { z } from "zod";
import { RoundResultSchema } from "@/domain/schemas";
import { calculateConnectionStats } from "@/domain/stats";
import { buildFallbackReport } from "@/domain/fallback";
import {
  isValidReportObservation,
  parseReportContent,
} from "@/lib/aiParsing";
import { requestChatCompletion } from "@/lib/aiClient";

export const dynamic = "force-dynamic";

const ReportRequestSchema = z.object({
  rounds: z.array(RoundResultSchema).length(3),
});

const SYSTEM_PROMPT = [
  "只描述当前三个案例中的行为。",
  "不得做人格诊断。",
  "不得说“你就是/你属于”。",
  "不得把职业路径当正确答案。",
  "不得自己计算或修改提供的数字。",
  "输出一段简洁中文行为观察。",
  "输出 JSON，字段：observation（一段简洁中文行为观察）。",
].join("\n");

function buildUserPrompt(rounds: z.infer<typeof ReportRequestSchema>["rounds"]) {
  const stats = calculateConnectionStats(rounds);
  return [
    "以下数据由程序计算，请不要改动或重新计算，只据此写一段简短中文行为观察。",
    `总局数：${stats.totalRounds}`,
    `AI 分歧：${stats.disagreementCount}`,
    `分歧后采纳：${stats.acceptanceCount}`,
    `独立坚持：${stats.persistenceCount}`,
    `初始职业趋同：${stats.initialProfessionalAlignmentCount}`,
    `最终职业趋同：${stats.finalProfessionalAlignmentCount}`,
    `理由频率：${JSON.stringify(stats.reasonFrequency)}`,
    "",
    `各局记录：${JSON.stringify(rounds)}`,
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

  // 任何 AI 相关异常都回退到 deterministic fallback，fallback 对产品是正常成功响应。
  try {
    const timeoutMs = Number(process.env.AI_REPORT_TIMEOUT_MS ?? 6500);
    const content = await requestChatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(rounds) },
      ],
      timeoutMs,
      maxTokens: 512,
    });
    const parsedContent = parseReportContent(content);
    // JSON/schema 通过后仍需程序侧边界检查：违规措辞不允许作为 live observation。
    if (
      parsedContent === null ||
      !isValidReportObservation(parsedContent.observation)
    ) {
      return Response.json(
        { observation: buildFallbackReport(rounds, stats), source: "fallback" },
        { status: 200 },
      );
    }
    return Response.json(
      { observation: parsedContent.observation, source: "live" },
      { status: 200 },
    );
  } catch {
    return Response.json(
      { observation: buildFallbackReport(rounds, stats), source: "fallback" },
      { status: 200 },
    );
  }
}