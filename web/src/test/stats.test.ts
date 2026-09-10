import { describe, expect, it } from "vitest";
import { calculateConnectionStats } from "@/domain/stats";
import type { RoundResult } from "@/domain/types";
import { scenarios } from "@/data/scenarios";

const rounds: RoundResult[] = [
  {
    scenarioId: scenarios[0].id,
    initialCall: "A",
    reasonIds: ["known_position"],
    aiStance: "challenge",
    aiAlternativeCall: "B",
    aiResponseSource: "live",
    finalCall: "B",
    changedAfterAI: true,
    professionalCall: "B",
    completedAt: "2026-09-05T12:00:00.000Z",
  },
  {
    scenarioId: scenarios[1].id,
    initialCall: "B",
    reasonIds: ["numbers_advantage", "time_pressure"],
    aiStance: "challenge",
    aiAlternativeCall: "C",
    aiResponseSource: "fallback",
    finalCall: "B",
    changedAfterAI: false,
    professionalCall: "A",
    completedAt: "2026-09-05T12:01:00.000Z",
  },
  {
    scenarioId: scenarios[2].id,
    initialCall: "C",
    reasonIds: ["resource_preservation"],
    aiStance: "agree",
    aiAlternativeCall: null,
    aiResponseSource: "live",
    finalCall: "C",
    changedAfterAI: false,
    professionalCall: "C",
    completedAt: "2026-09-05T12:02:00.000Z",
  },
];

describe("calculateConnectionStats", () => {
  it("calculates disagreement, acceptance, persistence and alignment correctly", () => {
    expect(calculateConnectionStats(rounds)).toMatchObject({
      totalRounds: 3,
      disagreementCount: 2,
      acceptanceCount: 1,
      persistenceCount: 1,
      verifiedReferenceRounds: 2,
      initialProfessionalAlignmentCount: 0,
      finalProfessionalAlignmentCount: 1,
    });
  });

  it("counts selected reasons", () => {
    const stats = calculateConnectionStats(rounds);
    expect(stats.reasonFrequency).toEqual(
      expect.arrayContaining([
        { scenarioId: scenarios[0].id, reasonId: "known_position", count: 1 },
        { scenarioId: scenarios[1].id, reasonId: "numbers_advantage", count: 1 },
        { scenarioId: scenarios[1].id, reasonId: "time_pressure", count: 1 },
        {
          scenarioId: scenarios[2].id,
          reasonId: "resource_preservation",
          count: 1,
        },
      ]),
    );
  });
});
