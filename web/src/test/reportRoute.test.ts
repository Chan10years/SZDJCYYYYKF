// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/report/route";
import { buildFallbackReport } from "@/domain/fallback";
import { calculateConnectionStats } from "@/domain/stats";
import { scenarios } from "@/data/scenarios";
import { requestChatCompletion } from "@/lib/aiClient";
import { resetAiBudgetForTests } from "@/lib/aiBudget";
import type { RoundResult } from "@/domain/types";

vi.mock("@/lib/aiClient", () => ({
  requestChatCompletion: vi.fn(),
}));

const mockedCompletion = vi.mocked(requestChatCompletion);

const rounds: RoundResult[] = scenarios.map((scenario, index) => ({
  scenarioId: scenario.id,
  initialCall: (["A", "B", "C"] as const)[index],
  reasonIds: ["known_position"],
  aiStance: "agree",
  aiAlternativeCall: null,
  aiResponseSource: "fallback",
  finalCall: (["A", "B", "C"] as const)[index],
  changedAfterAI: false,
  professionalCall: (["A", "B", "C"] as const)[index],
  completedAt: `2026-09-10T00:0${index}:00.000Z`,
}));

function post(sourceKey: string) {
  return POST(
    new Request("http://localhost/api/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": sourceKey,
      },
      body: JSON.stringify({ rounds }),
    }),
  );
}

describe("POST /api/report — 来源预算", () => {
  beforeEach(() => {
    mockedCompletion.mockReset();
    resetAiBudgetForTests();
    mockedCompletion.mockResolvedValue(
      JSON.stringify({ choose: "no_disagreement" }),
    );
  });

  it("60 名用户各生成一次 Report 后仍不触发进程预算 fallback", async () => {
    const sourceKey = "198.51.100.88";

    const burst = Array.from({ length: 60 }, () => post(sourceKey));
    await Promise.all(burst);
    const response = await post(sourceKey);

    expect(mockedCompletion).toHaveBeenCalledTimes(60);
    await expect(response.json()).resolves.toEqual({
      observation: buildFallbackReport(calculateConnectionStats(rounds)),
      source: "fallback",
    });
  });
});
