import { describe, expect, it } from "vitest";
import { realScenarios } from "@/data/scenarios.real";

async function loadAdapter() {
  try {
    return await import("@/domain/currentStatePreview");
  } catch {
    return null;
  }
}

async function loadFixture() {
  try {
    return (await import("@/data/realMatch/lite2-g2-spirit-r34.json")).default;
  } catch {
    return null;
  }
}

describe("current-state Tactical Preview adapter", () => {
  it("adapts ten real players and the event-derived carrier", async () => {
    const adapter = await loadAdapter();
    const fixture = await loadFixture();
    expect(adapter, "Gate 1 current-state adapter is not implemented yet").not.toBeNull();
    expect(fixture, "Gate 1 real match fixture is not generated yet").not.toBeNull();
    if (!adapter || !fixture) return;

    const preview = adapter.buildCurrentStatePreview(fixture);

    expect(preview.kind).toBe("current-match-state");
    expect(preview.players).toHaveLength(10);
    expect(preview.players.filter((player) => player.side === "CT")).toHaveLength(5);
    expect(preview.players.filter((player) => player.side === "T")).toHaveLength(5);
    expect(preview.players.every((player) => player.alive)).toBe(true);
    expect(preview.bomb.carrierName).toBe("magixx");
    expect(preview.players.every(({ normalizedPosition }) =>
      normalizedPosition.x >= 0 && normalizedPosition.x <= 100 &&
      normalizedPosition.y >= 0 && normalizedPosition.y <= 100,
    )).toBe(true);
  });

  it("does not mutate authored Scenario preview semantics", async () => {
    const adapter = await loadAdapter();
    const fixture = await loadFixture();
    expect(adapter, "Gate 1 current-state adapter is not implemented yet").not.toBeNull();
    expect(fixture, "Gate 1 real match fixture is not generated yet").not.toBeNull();
    if (!adapter || !fixture) return;

    const scenario = realScenarios.find((candidate) => candidate.id === "lite2-g2-spirit-mirage-r34");
    expect(scenario).toBeDefined();
    if (!scenario) return;
    const authoredPreviewBefore = JSON.stringify(scenario.previewByCall);

    adapter.buildCurrentStatePreview(fixture);

    expect(JSON.stringify(scenario.previewByCall)).toBe(authoredPreviewBefore);
  });
});
