import { describe, expect, it } from "vitest";
import overpassState from "@/data/realMatch/g3-g2-spirit-m1-overpass-r10.json";
import dust2State from "@/data/realMatch/g3-g2-spirit-m2-dust2-r10.json";

async function loadContract() {
  try {
    return await import("@/domain/normalizedMatchState");
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

describe("NormalizedMatchState JSON boundary", () => {
  it("validates the real Round 34 artifact", async () => {
    const contract = await loadContract();
    const fixture = await loadFixture();
    expect(contract, "Gate 1 normalized state contract is not implemented yet").not.toBeNull();
    expect(fixture, "Gate 1 real match fixture is not generated yet").not.toBeNull();
    if (!contract || !fixture) return;

    const state = contract.parseNormalizedMatchState(fixture);

    expect(state.map.name).toBe("de_mirage");
    expect(state.round.number).toBe(34);
    expect(state.round.parserRound).toBe(33);
    expect(state.tick).toBe(184065);
    expect(state.time.display).toBe("0:40");
    expect(state.players).toHaveLength(10);
    expect(new Set(state.players.map((player) => player.id)).size).toBe(10);
    expect(state.bomb.status).toBe("carried");
    expect(state.bomb.carrierName).toBe("magixx");
  });

  it("rejects malformed or non-finite boundary data", async () => {
    const contract = await loadContract();
    const fixture = await loadFixture();
    expect(contract, "Gate 1 normalized state contract is not implemented yet").not.toBeNull();
    expect(fixture, "Gate 1 real match fixture is not generated yet").not.toBeNull();
    if (!contract || !fixture) return;

    expect(() => contract.parseNormalizedMatchState({ ...fixture, players: [] })).toThrow();
    expect(() => contract.parseNormalizedMatchState({ ...fixture, tick: Number.NaN })).toThrow();
  });

  it("validates a real non-Mirage snapshot without inventing a raster asset", async () => {
    const contract = await loadContract();
    expect(contract).not.toBeNull();
    if (!contract) return;

    const state = contract.parseNormalizedMatchState(overpassState);

    expect(state.map.name).toBe("de_overpass");
    expect(state.map.asset).toBeNull();
    expect(state.round.number).toBe(10);
    expect(state.players.filter((player) => player.alive)).toHaveLength(7);
    expect(state.bomb.status).toBe("planted");
  });

  it("marks a post-plant snapshot without presenting round clock as a fact", async () => {
    const contract = await loadContract();
    expect(contract).not.toBeNull();
    if (!contract) return;

    const state = contract.parseNormalizedMatchState(overpassState);

    expect(state.time.semantics).toBe("post_plant_elapsed");
    expect(state.time.remainingSeconds).toBeNull();
    expect(state.time.postPlantElapsedSeconds).toBeCloseTo(26.0625, 4);
    expect(state.time.display).toBe("post-plant · 26.1s since plant");
    expect(state.time.warningTick).toBeNull();
    expect(state.extraction.availableFields).not.toContain("round_time_warning");
    expect(state.extraction.derivedFields.join(" ")).not.toMatch(/warning/i);
  });

  it("does not expose a warning event that occurs after the selected target", async () => {
    const contract = await loadContract();
    expect(contract).not.toBeNull();
    if (!contract) return;

    const state = contract.parseNormalizedMatchState(dust2State);

    expect(state.tick).toBeLessThan(state.time.warningTick ?? Number.POSITIVE_INFINITY);
    expect(state.time.warningTick).toBeNull();
    expect(state.extraction.availableFields).not.toContain("round_time_warning");
  });
});
