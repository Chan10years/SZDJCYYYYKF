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