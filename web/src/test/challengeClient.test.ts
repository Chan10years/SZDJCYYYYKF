import { afterEach, describe, expect, it, vi } from "vitest";
import { requestChallengeOnClient } from "@/lib/challengeClient";
import { scenarios } from "@/data/scenarios";

const scenario = scenarios[0];

describe("requestChallengeOnClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the deterministic fallback when the browser request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

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

  it("returns fallback when the browser request never settles by the deadline", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );

    let settled = false;
    void requestChallengeOnClient({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds: ["known_position"],
    }).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(5_000);

    expect(signal?.aborted).toBe(true);
    expect(settled).toBe(true);
  });

  it("returns fallback when the browser receives an invalid response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ source: "live", unexpected: true }),
      }),
    );

    const result = await requestChallengeOnClient({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds: ["known_position"],
    });

    expect(result.source).toBe("fallback");
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
