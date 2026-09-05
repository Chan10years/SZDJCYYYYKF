import { describe, expect, it } from "vitest";
import { buildFallbackChallenge, buildFallbackReport } from "@/domain/fallback";
import { calculateConnectionStats } from "@/domain/stats";
import { fixtureScenarios } from "@/data/scenarios.fixture";
import type { ReasonId, RoundResult } from "@/domain/types";

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
  const stats = calculateConnectionStats(rounds);

  it("mentions disagreement, acceptance and persistence counts", () => {
    const text = buildFallbackReport(rounds, stats);
    expect(text).toContain("3 个案例");
    expect(text).toContain("2 次 AI 分歧");
    expect(text).toContain("采纳了 1 次");
    expect(text).toContain("坚持了 1 次");
  });

  it("mentions the highest-frequency reason label", () => {
    const text = buildFallbackReport(rounds, stats);
    expect(text).toContain("「人数优势」");
  });

  it("includes a small-sample qualifier without personality claims", () => {
    const text = buildFallbackReport(rounds, stats);
    expect(text).toContain("当前样本");
    expect(text).not.toContain("你就是");
    expect(text).not.toContain("人格");
  });
});