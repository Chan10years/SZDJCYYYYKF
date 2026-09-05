import { describe, expect, it } from "vitest";
import { buildFallbackChallenge, buildFallbackReport } from "@/domain/fallback";
import { OBSERVATION_CANDIDATES } from "@/domain/reportObservation";
import { calculateConnectionStats } from "@/domain/stats";
import { fixtureScenarios } from "@/data/scenarios.fixture";
import type { CallId, ReasonId, RoundResult } from "@/domain/types";

const scenario = fixtureScenarios[0];

const reasonLabel = (id: ReasonId) =>
  scenario.reasonOptions.find((option) => option.id === id)?.label ?? "";

function makeRounds(): RoundResult[] {
  return [
    {
      scenarioId: "fixture-hero",
      initialCall: "A",
      reasonIds: ["known_position"],
      aiStance: "challenge",
      aiAlternativeCall: "B",
      aiResponseSource: "live",
      finalCall: "B",
      changedAfterAI: true,
      professionalCall: "A",
      completedAt: "2026-09-05T12:00:00.000Z",
    },
    {
      scenarioId: "fixture-lite-2",
      initialCall: "B",
      reasonIds: ["numbers_advantage", "time_pressure"],
      aiStance: "challenge",
      aiAlternativeCall: "C",
      aiResponseSource: "fallback",
      finalCall: "B",
      changedAfterAI: false,
      professionalCall: "B",
      completedAt: "2026-09-05T12:01:00.000Z",
    },
    {
      scenarioId: "fixture-lite-3",
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
}

describe("buildFallbackChallenge", () => {
  it("acknowledges a single selected reason label", () => {
    const output = buildFallbackChallenge(scenario, "A", ["known_position"]);
    expect(output.acknowledge).toContain(reasonLabel("known_position"));
    expect(output.acknowledge).toContain(reasonLabel("known_position"));
  });

  it("acknowledges two selected reason labels", () => {
    const output = buildFallbackChallenge(scenario, "B", [
      "numbers_advantage",
      "time_pressure",
    ]);
    expect(output.acknowledge).toContain(reasonLabel("numbers_advantage"));
    expect(output.acknowledge).toContain(reasonLabel("time_pressure"));
  });

  it("uses scenario-specific guidance for the initial call", () => {
    const output = buildFallbackChallenge(scenario, "A", ["known_position"]);
    expect(output.blindspot).toBe(scenario.challengeGuidance.A.blindspot);
    expect(output.question).toBe(scenario.challengeGuidance.A.question);
    expect(output.alternativeCall).toBe(scenario.challengeGuidance.A.alternativeCall);
  });

  it("marks the response source as fallback", () => {
    const output = buildFallbackChallenge(scenario, "A", ["known_position"]);
    expect(output.source).toBe("fallback");
  });

  it("does not emit judge-like vocabulary", () => {
    const output = buildFallbackChallenge(scenario, "A", ["known_position"]);
    const text = JSON.stringify(output);
    expect(text).not.toContain("正确答案");
    expect(text).not.toContain("答错");
    expect(text).not.toContain("必然");
  });
});

describe("buildFallbackReport", () => {
  const rounds = makeRounds();
  const safeTexts = Object.values(OBSERVATION_CANDIDATES);

  it("always returns a program-defined safe candidate", () => {
    const text = buildFallbackReport(calculateConnectionStats(rounds));
    expect(safeTexts).toContain(text);
  });

  it("returns the acceptance candidate when every disagreement was accepted", () => {
    const allAccept = [
      makeAccepted("A", "B"),
      makeAccepted("B", "C"),
      makeAccepted("C", "A"),
    ];
    const text = buildFallbackReport(calculateConnectionStats(allAccept));
    expect(text).toBe(OBSERVATION_CANDIDATES.acceptance);
  });

  it("returns the persistence candidate when every disagreement was persisted", () => {
    const allPersist = [
      makePersisted("A", "B"),
      makePersisted("B", "C"),
      makePersisted("C", "A"),
    ];
    const text = buildFallbackReport(calculateConnectionStats(allPersist));
    expect(text).toBe(OBSERVATION_CANDIDATES.persistence);
  });

  it("returns the no-disagreement candidate when there was no disagreement", () => {
    const noDisagreement = [
      makeAgreeing("A"),
      makeAgreeing("B"),
      makeAgreeing("C"),
    ];
    const text = buildFallbackReport(calculateConnectionStats(noDisagreement));
    expect(text).toBe(OBSERVATION_CANDIDATES.no_disagreement);
  });
});

function disagreementRound(initialCall: RoundResult["initialCall"]) {
  return {
    scenarioId: "fixture-lite-3",
    reasonIds: ["resource_preservation"] as ReasonId[],
    aiStance: "challenge" as const,
    aiResponseSource: "live" as const,
    professionalCall: "C" as const,
    completedAt: "2026-09-05T12:00:00.000Z",
    initialCall,
  };
}

function makeAccepted(
  initialCall: CallId,
  alternativeCall: CallId,
): RoundResult {
  return {
    ...disagreementRound(initialCall),
    aiAlternativeCall: alternativeCall,
    finalCall: alternativeCall,
    changedAfterAI: true,
  };
}

function makePersisted(
  initialCall: CallId,
  alternativeCall: CallId,
): RoundResult {
  return {
    ...disagreementRound(initialCall),
    aiAlternativeCall: alternativeCall,
    finalCall: initialCall,
    changedAfterAI: false,
  };
}

function makeAgreeing(initialCall: CallId): RoundResult {
  return {
    ...disagreementRound(initialCall),
    aiAlternativeCall: null,
    finalCall: initialCall,
    changedAfterAI: false,
    aiStance: "agree",
  };
}