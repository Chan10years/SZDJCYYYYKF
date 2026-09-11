import { ChallengeOutputSchema } from "@/domain/schemas";
import { buildFallbackChallenge } from "@/domain/fallback";
import { scenarios } from "@/data/scenarios";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import type { CallId, ChallengeOutput, ReasonId } from "@/domain/types";

type RequestChallengeArgs = {
  scenarioId: string;
  initialCall: CallId;
  reasonIds: ReasonId[];
};

export const CHALLENGE_CLIENT_TIMEOUT_MS = 5_000;

/**
 * 客户端向 /api/challenge 发起请求。
 * 服务端在 AI 失败时也会返回 200 + fallback，因此这里通常只会拿到合法 Challenge。
 */
export async function requestChallengeOnClient(
  args: RequestChallengeArgs,
): Promise<ChallengeOutput> {
  const scenario = scenarios.find((candidate) => candidate.id === args.scenarioId);
  if (!scenario) {
    throw new Error(`Scenario not found: ${args.scenarioId}`);
  }

  try {
    const data = await fetchWithTimeout(
      "/api/challenge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      },
      CHALLENGE_CLIENT_TIMEOUT_MS,
      async (response) => {
        if (!response.ok) {
          throw new Error(
            `Challenge request failed with status ${response.status}`,
          );
        }
        return (await response.json()) as unknown;
      },
    );
    const result = ChallengeOutputSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Challenge response failed schema validation");
    }
    return result.data;
  } catch {
    return buildFallbackChallenge(scenario, args.initialCall, args.reasonIds);
  }
}
