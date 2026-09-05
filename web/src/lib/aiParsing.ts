import { z } from "zod";
import { CallIdSchema } from "@/domain/schemas";
import type { ChallengeOutput } from "@/domain/types";

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

/** 跨局报表观察的最大长度上限，用于拒绝过长的模型输出。 */
export const REPORT_OBSERVATION_MAX = 600;

/** Report 模型输出：一段中文行为观察。 */
const ReportContentSchema = z.object({
  observation: z.string().min(1).max(REPORT_OBSERVATION_MAX),
});

/** /api/report 的对外响应结构，客户端与服务端共享校验。 */
export const ReportResponseSchema = z.object({
  observation: z.string().min(1).max(REPORT_OBSERVATION_MAX),
  source: z.enum(["live", "fallback"]),
});

/**
 * 解析模型返回的跨局行为观察。
 * 接受 { observation } 的纯 JSON，必须经过 Zod 校验。
 * 空 observation / 非 JSON / 超长均返回 null。
 */
export function parseReportContent(
  raw: string,
): { observation: string } | null {
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
  const result = ReportContentSchema.safeParse(json);
  return result.success ? result.data : null;
}