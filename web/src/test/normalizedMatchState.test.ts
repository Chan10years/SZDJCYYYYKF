import { describe, expect, it } from "vitest";

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
});
