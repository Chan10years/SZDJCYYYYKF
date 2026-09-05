import { describe, expect, it } from "vitest";
import { calculateConnectionStats } from "@/domain/stats";
import type { RoundResult } from "@/domain/types";

const rounds: RoundResult[] = [
  {
    scenarioId: "s1",
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
    scenarioId: "s2",
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
    scenarioId: "s3",
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
      initialProfessionalAlignmentCount: 1,
      finalProfessionalAlignmentCount: 2,
    });
  });

  it("counts selected reasons", () => {
    const stats = calculateConnectionStats(rounds);
    expect(stats.reasonFrequency.known_position).toBe(1);
    expect(stats.reasonFrequency.numbers_advantage).toBe(1);
    expect(stats.reasonFrequency.time_pressure).toBe(1);
    expect(stats.reasonFrequency.resource_preservation).toBe(1);
  });
});