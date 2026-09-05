import { ChallengeOutputSchema } from "@/domain/schemas";
import type { CallId, ChallengeOutput, ReasonId } from "@/domain/types";

type RequestChallengeArgs = {
  scenarioId: string;
  initialCall: CallId;
  reasonIds: ReasonId[];
};

/**
 * 客户端向 /api/challenge 发起请求。
 * 服务端在 AI 失败时也会返回 200 + fallback，因此这里通常只会拿到合法 Challenge。
 */
export async function requestChallengeOnClient(
  args: RequestChallengeArgs,
): Promise<ChallengeOutput> {
  const response = await fetch("/api/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    throw new Error(`Challenge request failed with status ${response.status}`);
  }
  const data: unknown = await response.json();
  const result = ChallengeOutputSchema.safeParse(data);
  if (!result.success) {
    throw new Error("Challenge response failed schema validation");
  }
  return result.data;
}