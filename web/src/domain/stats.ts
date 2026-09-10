import { scenarios } from "@/data/scenarios";
import type {
  ConnectionStats,
  ReasonFrequencyEntry,
  RoundResult,
} from "./types";

export function calculateConnectionStats(
  rounds: RoundResult[],
): ConnectionStats {
  const reasonFrequency = new Map<string, ReasonFrequencyEntry>();

  let disagreementCount = 0;
  let acceptanceCount = 0;
  let persistenceCount = 0;
  let verifiedReferenceRounds = 0;
  let initialProfessionalAlignmentCount = 0;
  let finalProfessionalAlignmentCount = 0;

  for (const round of rounds) {
    const scenario = scenarios.find((candidate) => candidate.id === round.scenarioId);
    const hasDisagreement =
      round.aiAlternativeCall !== null &&
      round.aiAlternativeCall !== round.initialCall;

    if (hasDisagreement) {
      disagreementCount += 1;
      if (round.finalCall === round.aiAlternativeCall) {
        acceptanceCount += 1;
      }
      if (round.finalCall === round.initialCall) {
        persistenceCount += 1;
      }
    }

    if (scenario?.verificationStatus === "verified") {
      verifiedReferenceRounds += 1;
      if (round.initialCall === round.professionalCall) {
        initialProfessionalAlignmentCount += 1;
      }
      if (round.finalCall === round.professionalCall) {
        finalProfessionalAlignmentCount += 1;
      }
    }

    for (const reasonId of round.reasonIds) {
      const key = `${round.scenarioId}:${reasonId}`;
      const current = reasonFrequency.get(key);
      reasonFrequency.set(
        key,
        current
          ? { ...current, count: current.count + 1 }
          : { scenarioId: round.scenarioId, reasonId, count: 1 },
      );
    }
  }

  return {
    totalRounds: rounds.length,
    disagreementCount,
    acceptanceCount,
    persistenceCount,
    verifiedReferenceRounds,
    initialProfessionalAlignmentCount,
    finalProfessionalAlignmentCount,
    reasonFrequency: [...reasonFrequency.values()],
  };
}
