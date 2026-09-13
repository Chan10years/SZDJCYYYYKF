import { describe, expect, it } from "vitest";
import { realScenarios } from "@/data/scenarios.real";
import overpassState from "@/data/realMatch/g3-g2-spirit-m1-overpass-r10.json";
import dust2State from "@/data/realMatch/g3-g2-spirit-m2-dust2-r10.json";

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
    expect(preview.asset).toBe("/maps/Lite2_CurrentStateBase.png");
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

  it("refuses spatial rendering until a map raster calibration is human-approved", async () => {
    const adapter = await loadAdapter();
    expect(adapter).not.toBeNull();
    if (!adapter) return;

    expect(() => adapter.buildCurrentStatePreview(overpassState)).toThrow(
      /Human-QA-approved raster calibration/,
    );
  });

  it("uses an explicit non-Mirage render frame when one is supplied", async () => {
    const adapter = await loadAdapter();
    expect(adapter).not.toBeNull();
    if (!adapter) return;

    const preview = adapter.buildCurrentStatePreview({
      ...overpassState,
      map: {
        ...overpassState.map,
        render: {
          projection: "cs2-radar-overview",
          asset: "/maps/Overpass_CurrentStateBase.png",
          imageWidth: 1200,
          imageHeight: 900,
          coordinateFrame: "de_overpass-radar-overview",
          radarWidth: overpassState.map.overview.radarWidth,
          radarHeight: overpassState.map.overview.radarHeight,
          overviewSource: overpassState.map.overview.source,
        },
      },
    });

    expect(preview.map).toBe("de_overpass");
    expect(preview.asset).toBe("/maps/Overpass_CurrentStateBase.png");
    expect(preview.imageWidth).toBe(1200);
    expect(preview.imageHeight).toBe(900);
    expect(preview.coordinateFrame).toBe("de_overpass-radar-overview");
    expect(preview.players.find((player) => player.name === "huNter-")?.imagePosition).toEqual({
      x: 804.7,
      y: 408.29,
    });
  });

  it("maps Dust2 positions with its actual radar metadata and raster dimensions", async () => {
    const adapter = await loadAdapter();
    expect(adapter).not.toBeNull();
    if (!adapter) return;

    const preview = adapter.buildCurrentStatePreview({
      ...dust2State,
      map: {
        ...dust2State.map,
        render: {
          projection: "cs2-radar-overview",
          asset: "/maps/Dust2_CurrentStateBase.png",
          imageWidth: 2048,
          imageHeight: 1024,
          coordinateFrame: "de_dust2-radar-overview-2x",
          radarWidth: dust2State.map.overview.radarWidth,
          radarHeight: dust2State.map.overview.radarHeight,
          overviewSource: dust2State.map.overview.source,
        },
      },
    });

    expect(preview.map).toBe("de_dust2");
    expect(preview.players.find((player) => player.name === "huNter-")?.imagePosition).toEqual({
      x: 1363.44,
      y: 266.09,
    });
  });
});
