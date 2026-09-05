import type {
  CallId,
  ChallengeOutput,
  ConnectionStats,
  ReasonId,
  RoundResult,
  Scenario,
} from "./types";

const REASON_LABELS: Record<ReasonId, string> = {
  numbers_advantage: "人数优势",
  known_position: "已知位置",
  time_pressure: "时间压力",
  utility_advantage: "道具优势",
  unknown_space: "未知区域",
  resource_preservation: "资源保存",
};

export function buildFallbackChallenge(
  scenario: Scenario,
  initialCall: CallId,
  reasonIds: ReasonId[],
): ChallengeOutput {
  const labels = reasonIds
    .map((id) => scenario.reasonOptions.find((option) => option.id === id)?.label)
    .filter((label): label is string => Boolean(label));

  let acknowledge: string;
  if (labels.length === 0) {
    acknowledge = "你基于当前局面做出了判断。";
  } else if (labels.length === 1) {
    acknowledge = `你把「${labels[0]}」作为主要依据。`;
  } else {
    acknowledge = `你主要依据「${labels[0]}」和「${labels[1]}」做出判断。`;
  }

  const guidance = scenario.challengeGuidance[initialCall];
  const alternativeCall = guidance.alternativeCall;
  const stance: ChallengeOutput["stance"] =
    alternativeCall !== null && alternativeCall !== initialCall
      ? "challenge"
      : "agree";

  return {
    stance,
    acknowledge,
    blindspot: guidance.blindspot,
    question: guidance.question,
    alternativeCall,
    source: "fallback",
  };
}

function highestFrequencyReason(stats: ConnectionStats): ReasonId | null {
  let best: ReasonId | null = null;
  let bestCount = 0;
  for (const [id, count] of Object.entries(stats.reasonFrequency) as [
    ReasonId,
    number,
  ][]) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

/**
 * 跨局报表的 deterministic fallback。
 * 必须提到：分歧数、采纳/坚持、高频理由（如有）、小样本限定。
 * 措辞按“全采纳 / 全坚持 / 混合 / 无分歧”区分，保持准确；禁止人格归类。
 */
export function buildFallbackReport(
  rounds: RoundResult[],
  stats: ConnectionStats,
): string {
  const topReason = highestFrequencyReason(stats);
  const reasonNote =
    topReason !== null
      ? `你最常使用「${REASON_LABELS[topReason]}」作为判断依据。`
      : "";

  const { disagreementCount, acceptanceCount, persistenceCount } = stats;

  let outcomeNote: string;
  if (disagreementCount === 0) {
    outcomeNote =
      "当前三个案例中 AI 均未给出与你的初始判断不同的建议，无法据此观察你在分歧下的行为倾向。";
  } else {
    outcomeNote =
      acceptanceCount > 0 && persistenceCount > 0
        ? "当前样本呈现的是选择性接受第二意见，而不是持续服从或持续拒绝。"
        : acceptanceCount === disagreementCount
          ? "当前样本中你在遇到 AI 分歧时均采纳了第二意见，该倾向仅反映本次体验。"
          : "当前样本中你在遇到 AI 分歧时均坚持了自己的初始判断，该倾向仅反映本次体验。";
  }

  const disagreementNote =
    disagreementCount > 0
      ? `你在 ${disagreementCount} 次 AI 分歧中采纳了 ${acceptanceCount} 次、坚持了 ${persistenceCount} 次。`
      : "三局均未出现 AI 分歧。";

  return [
    `基于本次 ${rounds.length} 个案例，${disagreementNote}`,
    reasonNote,
    outcomeNote,
  ]
    .filter(Boolean)
    .join(" ");
}