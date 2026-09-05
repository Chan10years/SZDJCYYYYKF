import { describe, expect, it } from "vitest";
import { buildFallbackChallenge } from "@/domain/fallback";
import { fixtureScenarios } from "@/data/scenarios.fixture";
import type { ReasonId } from "@/domain/types";

const scenario = fixtureScenarios[0];

const reasonLabel = (id: ReasonId) =>
  scenario.reasonOptions.find((option) => option.id === id)?.label ?? "";

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