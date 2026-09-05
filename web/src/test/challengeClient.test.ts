import { afterEach, describe, expect, it, vi } from "vitest";
import { requestChallengeOnClient } from "@/lib/challengeClient";

describe("requestChallengeOnClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the deterministic fallback when the browser request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(
      requestChallengeOnClient({
        scenarioId: "fixture-hero",
        initialCall: "A",
        reasonIds: ["known_position"],
      }),
    ).resolves.toMatchObject({
      stance: "challenge",
      acknowledge: "你把「已知位置」作为主要依据。",
      alternativeCall: "B",
      source: "fallback",
    });
  });
});
