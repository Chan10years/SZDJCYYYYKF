import { describe, expect, it } from "vitest";
import {
  eligibleObservationIds,
  OBSERVATION_CANDIDATES,
  resolveReportObservation,
} from "@/domain/reportObservation";
import { calculateConnectionStats } from "@/domain/stats";
import type { CallId, RoundResult } from "@/domain/types";

// 会话 1：2 次分歧，1 采纳 1 坚持（mixed）→ 可选 mixed + alignment_stable
function makeMixedRounds(): RoundResult[] {
  return [
    makeRound("A", "B", true), // 采纳
    makeRound("B", null, true), // 一致
    makeRound("C", "A", false), // 坚持
  ];
}

// 会话 2：3 次分歧全采纳 → 可选 acceptance + alignment_stable
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
): RoundResult {
  const finalCall =
    alternativeCall === null
      ? initialCall
      : accepted
        ? alternativeCall
        : initialCall;
  // A 局用 fixture-hero（职业路径 A），其余用 fixture-lite-3（职业路径 C）
  const useHero = initialCall === "A";
  return {
    scenarioId: useHero ? "fixture-hero" : "fixture-lite-3",
    initialCall,
    reasonIds: ["resource_preservation"],
    aiStance: alternativeCall === null ? "agree" : "challenge",
    aiAlternativeCall: alternativeCall,
    aiResponseSource: "live",
    finalCall,
    changedAfterAI: accepted && alternativeCall !== null,
    professionalCall: useHero ? "A" : "C",
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
      makeRound("B", "C", true),
      makeRound("B", "C", true),
      makeRound("A", "B", true),
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