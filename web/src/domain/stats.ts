import type { ConnectionStats, ReasonId, RoundResult } from "./types";
import { ReasonIdSchema } from "./schemas";

const ALL_REASON_IDS = ReasonIdSchema.options as readonly ReasonId[];

function emptyReasonFrequency(): Record<ReasonId, number> {
  return Object.fromEntries(
    ALL_REASON_IDS.map((id) => [id, 0]),
  ) as Record<ReasonId, number>;
}

export function calculateConnectionStats(
  rounds: RoundResult[],
): ConnectionStats {
  const reasonFrequency = emptyReasonFrequency();

  let disagreementCount = 0;
  let acceptanceCount = 0;
  let persistenceCount = 0;
  let initialProfessionalAlignmentCount = 0;
  let finalProfessionalAlignmentCount = 0;

  for (const round of rounds) {
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

    if (round.initialCall === round.professionalCall) {
      initialProfessionalAlignmentCount += 1;
    }
    if (round.finalCall === round.professionalCall) {
      finalProfessionalAlignmentCount += 1;
    }

    for (const reasonId of round.reasonIds) {
      reasonFrequency[reasonId] += 1;
    }
  }

  return {
    totalRounds: rounds.length,
    disagreementCount,
    acceptanceCount,
    persistenceCount,
    initialProfessionalAlignmentCount,
    finalProfessionalAlignmentCount,
    reasonFrequency,
  };
}