import { describe, expect, it } from "vitest";
import { ScenarioSchema } from "@/domain/schemas";
import { fixtureScenarios } from "@/data/scenarios.fixture";

describe("ScenarioSchema", () => {
  it("accepts all development fixtures", () => {
    for (const scenario of fixtureScenarios) {
      expect(ScenarioSchema.parse(scenario)).toEqual(scenario);
    }
  });

  it("rejects a Tactical Preview point outside normalized map bounds", () => {
    const invalid = structuredClone(fixtureScenarios[0]);
    invalid.previewByCall.A.routes[0].points[0].x = 101;
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });

  it("rejects more than three call options", () => {
    const invalid = structuredClone(fixtureScenarios[0]);
    invalid.calls.push({
      id: "A",
      label: "duplicate",
      description: "invalid duplicate",
    });
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });
});