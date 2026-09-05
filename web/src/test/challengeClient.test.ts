import { afterEach, describe, expect, it, vi } from "vitest";
import { requestChallengeOnClient } from "@/lib/challengeClient";
import { scenarios } from "@/data/scenarios";

describe("requestChallengeOnClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the deterministic fallback when the browser request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    const scenario = scenarios[0];
    const result = await requestChallengeOnClient({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds: ["known_position"],
    });

    // 确定性 fallback：结构合法、来源为 fallback、alternativeCall 取自该 Call 的 guidance。
    expect(result.source).toBe("fallback");
    expect(result.acknowledge.length).toBeGreaterThan(0);
    expect(result.blindspot).toBe(scenario.challengeGuidance.A.blindspot);
    expect(result.question).toBe(scenario.challengeGuidance.A.question);
    expect(result.alternativeCall).toBe(
      scenario.challengeGuidance.A.alternativeCall,
    );
  });

  it("throws for an unknown scenario id", async () => {
    await expect(
      requestChallengeOnClient({
        scenarioId: "fixture-hero",
        initialCall: "A",
        reasonIds: ["known_position"],
      }),
    ).rejects.toThrow("Scenario not found");
  });
});
