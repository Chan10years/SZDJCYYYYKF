import type {
  CallId,
  ChallengeOutput,
  ReasonId,
  Scenario,
} from "./types";

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