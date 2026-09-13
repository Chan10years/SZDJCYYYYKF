import { describe, expect, it } from "vitest";
import { scenarios } from "@/data/scenarios";
import { RoundResultSchema } from "@/domain/schemas";
import { buildNextTrainingHypothesis } from "@/domain/trainingRecord";

const scenario = scenarios[0];

const challenge = {
  stance: "challenge" as const,
  acknowledge: "你把「已知位置」作为主要依据。",
  blindspot: "练习用盲点。",
  question: "练习用反问。",
  alternativeCall: "B" as const,
  source: "fallback" as const,
};

const legacyRound = {
  scenarioId: scenario.id,
  initialCall: "A" as const,
  reasonIds: ["known_position" as const],
  aiStance: "challenge" as const,
  aiAlternativeCall: "B" as const,
  aiResponseSource: "fallback" as const,
  finalCall: "A" as const,
  changedAfterAI: false,
  professionalCall: scenario.professional.call,
  completedAt: "2026-09-13T00:00:00.000Z",
};

describe("Gate 2 training record contract", () => {
  it("builds a check for the exact response path without judging correctness", () => {
    expect(
      buildNextTrainingHypothesis({
        initialCall: "A",
        finalCall: "B",
        challenge,
      }),
    ).toContain("改判前要验证的条件");
  });

  it("preserves a full challenge and optional reflection fields in a round result", () => {
    const parsed = RoundResultSchema.parse({
      ...legacyRound,
      optionalFreeformReasoning: "先确认空间。",
      aiChallenge: challenge,
      userResponseToChallenge: "keep",
      changeReason: "这个风险还不足以改变我的判断。",
      professionalReference: scenario.professional,
      postRoundReflection: "我忽略了时间窗口。",
      nextTrainingHypothesis: "下一次先检查时间窗口。",
    });

    expect(parsed.aiChallenge).toEqual(challenge);
    expect(parsed.nextTrainingHypothesis).toBe("下一次先检查时间窗口。");
  });

  it("accepts a pre-Gate-2 round without pretending missing history exists", () => {
    const parsed = RoundResultSchema.parse(legacyRound);

    expect(parsed.aiChallenge).toBeUndefined();
    expect(parsed.nextTrainingHypothesis).toBeUndefined();
  });
});
