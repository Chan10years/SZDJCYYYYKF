import { z } from "zod";
import { CallIdSchema } from "@/domain/schemas";
import type { CallId, ChallengeOutput } from "@/domain/types";

/**
 * Challenge 模型输出，不含 source（source 由响应路径决定）。
 * 与 ChallengeOutputSchema 一致，仅省略 source 字段。
 */
const ChallengeContentSchema = z.object({
  stance: z.enum(["agree", "challenge"]),
  acknowledge: z.string(),
  blindspot: z.string(),
  question: z.string(),
  alternativeCall: CallIdSchema.nullable(),
});

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

/**
 * 解析模型返回的 Challenge 文本。
 * 接受纯 JSON 或单层 markdown code fence，必须经过 Zod 校验。
 * 任何非法情况返回 null。
 */
export function parseChallengeContent(
  raw: string,
): Omit<ChallengeOutput, "source"> | null {
  const body = stripCodeFence(raw).trim();
  if (body.length === 0) {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    return null;
  }
  const result = ChallengeContentSchema.safeParse(json);
  return result.success ? result.data : null;
}

/**
 * Challenge 语义归一化（与 buildFallbackChallenge 同一规则）：
 * alternativeCall 是“AI 独立首选”，必须不同于用户 Initial Call；
 * 模型若把用户选择复述为 alternativeCall，视为独立首选相同 → null。
 * stance 由 alternativeCall 派生，避免模型输出自相矛盾。
 */
export function normalizeChallengeContent(
  content: Omit<ChallengeOutput, "source">,
  initialCall: CallId,
): Omit<ChallengeOutput, "source"> {
  const alternativeCall =
    content.alternativeCall !== null && content.alternativeCall !== initialCall
      ? content.alternativeCall
      : null;
  return {
    ...content,
    alternativeCall,
    stance: alternativeCall === null ? "agree" : "challenge",
  };
}

/**
 * Report 模型输出：只允许选择要强调的候选 id，不生成自由文本。
 * 展示文案一律来自程序定义的安全候选，模型输出不直接进入 UI。
 */
const ChooseContentSchema = z.object({
  choose: z.string().min(1).max(32),
});

/** /api/report 的对外响应结构，客户端与服务端共享校验。 */
export const ReportResponseSchema = z.object({
  observation: z.string().min(1),
  source: z.enum(["live", "fallback"]),
});

/**
 * 解析模型返回的候选选择。
 * 接受 { choose } 的纯 JSON，必须经过 Zod 校验。
 * 空输入 / 非 JSON / 缺失 choose 均返回 null。
 */
export function parseReportChooseContent(
  raw: string,
): { choose: string } | null {
  const body = stripCodeFence(raw).trim();
  if (body.length === 0) {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    return null;
  }
  const result = ChooseContentSchema.safeParse(json);
  return result.success ? result.data : null;
}