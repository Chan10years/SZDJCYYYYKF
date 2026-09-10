import { describe, expect, it } from "vitest";
import {
  eligibleObservationIds,
  OBSERVATION_CANDIDATES,
  resolveReportObservation,
} from "@/domain/reportObservation";
import { calculateConnectionStats } from "@/domain/stats";
import { realScenarios } from "@/data/scenarios.real";
import type { CallId, RoundResult } from "@/domain/types";

// 会话 1：2 次分歧，1 采纳 1 坚持（mixed），使用已核验 Scenario。
function makeMixedRounds(): RoundResult[] {
  return [
    makeRound("A", "B", true), // 采纳
    makeRound("B", null, true), // 一致
    makeRound("C", "A", false), // 坚持
  ];
}

// 会话 2：3 次分歧全采纳 → 可选 acceptance + alignment_stable。
function makeAllAcceptRounds(): RoundResult[] {
  return [
    makeRound("A", "B", true),
    makeRound("B", "C", true),
    makeRound("C", "A", true),
  ];
}

function makeRound(
  initialCall: CallId,
  alternativeCall: CallId | null,
  accepted: boolean,
  professionalCall: CallId = "A",
): RoundResult {
  const finalCall =
    alternativeCall === null
      ? initialCall
      : accepted
        ? alternativeCall
        : initialCall;
  return {
    scenarioId: realScenarios[0].id,
    initialCall,
    reasonIds: ["resource_preservation"],
    aiStance: alternativeCall === null ? "agree" : "challenge",
    aiAlternativeCall: alternativeCall,
    aiResponseSource: "live",
    finalCall,
    changedAfterAI: accepted && alternativeCall !== null,
    professionalCall,
    completedAt: "2026-09-05T12:00:00.000Z",
  };
}

describe("eligibleObservationIds", () => {
  it("offers mixed for a mixed acceptance/persistence session", () => {
    const stats = calculateConnectionStats(makeMixedRounds());
    const ids = eligibleObservationIds(stats);
    expect(ids).toContain("mixed");
    expect(ids).not.toContain("acceptance");
    expect(ids).not.toContain("persistence");
  });

  it("offers acceptance when every disagreement was accepted", () => {
    const stats = calculateConnectionStats(makeAllAcceptRounds());
    const ids = eligibleObservationIds(stats);
    expect(ids).toContain("acceptance");
    expect(ids).not.toContain("persistence");
  });

  it("offers alignment_progress only when final alignment exceeded initial", () => {
    const rounds = [
      makeRound("B", "C", true, "C"),
      makeRound("B", "C", true, "C"),
      makeRound("A", "B", true, "C"),
    ];
    const ids = eligibleObservationIds(calculateConnectionStats(rounds));
    expect(ids).toContain("alignment_progress");
    expect(ids).not.toContain("alignment_stable");
  });

  it("offers alignment_stable only when final alignment equals initial", () => {
    const rounds = [
      makeRound("A", null, true),
      makeRound("B", null, true),
      makeRound("C", null, true),
    ];
    const ids = eligibleObservationIds(calculateConnectionStats(rounds));
    expect(ids).toContain("alignment_stable");
    expect(ids).not.toContain("alignment_progress");
  });

  it("offers no alignment candidate when final alignment dropped below initial", () => {
    const stats = calculateConnectionStats(makeMixedRounds());
    const ids = eligibleObservationIds(stats);
    expect(ids).not.toContain("alignment_progress");
    expect(ids).not.toContain("alignment_stable");
  });

  it("does not offer professional alignment claims when all references are practice", () => {
    const practiceRound = {
      ...makeRound("A", null, true),
      scenarioId: realScenarios[2].id,
    };
    const stats = calculateConnectionStats([practiceRound]);
    const ids = eligibleObservationIds(stats);
    expect(stats.verifiedReferenceRounds).toBe(0);
    expect(ids).not.toContain("alignment_progress");
    expect(ids).not.toContain("alignment_stable");
    expect(resolveReportObservation("alignment_stable", stats)).toBeNull();
  });
});

describe("resolveReportObservation", () => {
  const stats = calculateConnectionStats(makeMixedRounds());

  it("returns the safe candidate text for an eligible id", () => {
    expect(resolveReportObservation("mixed", stats)).toBe(
      OBSERVATION_CANDIDATES.mixed,
    );
  });

  it("rejects an id that is ineligible for the current stats", () => {
    expect(resolveReportObservation("acceptance", stats)).toBeNull();
  });

  it("rejects alignment candidates when final alignment dropped below initial", () => {
    expect(resolveReportObservation("alignment_progress", stats)).toBeNull();
    expect(resolveReportObservation("alignment_stable", stats)).toBeNull();
  });

  it("rejects an unknown id", () => {
    expect(resolveReportObservation("you_should_trust_ai", stats)).toBeNull();
  });

  it("rejects null / empty selection", () => {
    expect(resolveReportObservation(null, stats)).toBeNull();
    expect(resolveReportObservation("", stats)).toBeNull();
  });
});
