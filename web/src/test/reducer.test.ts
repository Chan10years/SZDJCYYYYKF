import { describe, expect, it } from "vitest";
import {
  experienceReducer,
  initialState,
  type ExperienceState,
} from "@/domain/experienceReducer";
import { scenarios } from "@/data/scenarios";
import type { CallId, ChallengeOutput } from "@/domain/types";

const challenge: ChallengeOutput = {
  stance: "challenge",
  acknowledge: "你把「已知位置」作为主要依据。",
  blindspot: "练习用盲点。",
  question: "练习用反问。",
  alternativeCall: "B",
  source: "fallback",
};

const decisionState: ExperienceState = {
  ...initialState,
  phase: "decision",
  initialCall: "A",
  reasonIds: ["known_position"],
};

const resolvedState: ExperienceState = {
  ...decisionState,
  phase: "challenge",
  challenge,
};

const reviewState: ExperienceState = {
  ...resolvedState,
  finalCall: "A",
  phase: "review",
};

describe("experienceReducer", () => {
  it("starts at intro phase", () => {
    expect(initialState.phase).toBe("intro");
  });

  it("moves from intro to situation on START", () => {
    expect(experienceReducer(initialState, { type: "START" }).phase).toBe(
      "situation",
    );
  });

  it("moves from situation to decision on BEGIN_DECISION", () => {
    const s = experienceReducer(initialState, { type: "START" });
    expect(experienceReducer(s, { type: "BEGIN_DECISION" }).phase).toBe(
      "decision",
    );
  });

  it("selecting a call or reason does not change phase", () => {
    let s = experienceReducer(initialState, { type: "START" });
    s = experienceReducer(s, { type: "BEGIN_DECISION" });
    s = experienceReducer(s, { type: "SET_CALL", call: "B" });
    s = experienceReducer(s, { type: "TOGGLE_REASON", reason: "time_pressure" });
    expect(s.phase).toBe("decision");
    expect(s.initialCall).toBe("B");
    expect(s.reasonIds).toEqual(["time_pressure"]);
  });

  it("REQUEST_CHALLENGE requires a call and 1-2 reasons", () => {
    const withoutCall = experienceReducer(
      { ...decisionState, initialCall: null },
      { type: "REQUEST_CHALLENGE" },
    );
    expect(withoutCall.phase).toBe("decision");

    const withoutReasons = experienceReducer(
      { ...decisionState, reasonIds: [] },
      { type: "REQUEST_CHALLENGE" },
    );
    expect(withoutReasons.phase).toBe("decision");

    const tooMany = experienceReducer(
      {
        ...decisionState,
        reasonIds: ["known_position", "time_pressure", "unknown_space"],
      },
      { type: "REQUEST_CHALLENGE" },
    );
    expect(tooMany.phase).toBe("decision");
  });

  it("moves to challenge phase when request is valid", () => {
    const s = experienceReducer(decisionState, { type: "REQUEST_CHALLENGE" });
    expect(s.phase).toBe("challenge");
  });

  it("stores initial reasoning and requires a response reason before leaving Challenge", () => {
    const decision = experienceReducer(decisionState, {
      type: "SET_INITIAL_REASONING",
      value: "先确认已知信息，再比较风险。",
    });
    const challenged = experienceReducer(decision, {
      type: "REQUEST_CHALLENGE",
    });
    const resolved = experienceReducer(challenged, {
      type: "CHALLENGE_RESOLVED",
      challenge,
    });
    const blocked = experienceReducer(resolved, {
      type: "RESPOND_TO_CHALLENGE",
      response: "keep",
    });
    expect(blocked.phase).toBe("challenge");

    const withReason = experienceReducer(resolved, {
      type: "SET_CHANGE_REASON",
      value: "这个风险仍不足以改变我的判断。",
    });
    const answered = experienceReducer(withReason, {
      type: "RESPOND_TO_CHALLENGE",
      response: "keep",
    });
    expect(answered.optionalFreeformReasoning).toBe(
      "先确认已知信息，再比较风险。",
    );
    expect(answered.userResponseToChallenge).toBe("keep");
    expect(answered.finalCall).toBe(answered.initialCall);
    expect(answered.phase).toBe("preview");
  });

  it("resolves the challenge into challenge phase", () => {
    const s = experienceReducer(
      { ...decisionState, phase: "challenge" },
      { type: "CHALLENGE_RESOLVED", challenge },
    );
    expect(s.phase).toBe("challenge");
    expect(s.challenge).toEqual(challenge);
  });

  it("KEEP_INITIAL moves to preview keeping the initial call", () => {
    const s = experienceReducer(resolvedState, { type: "KEEP_INITIAL" });
    expect(s.phase).toBe("preview");
    expect(s.finalCall).toBe("A");
  });

  it("ACCEPT_ALTERNATIVE moves to preview with the AI alternative call", () => {
    const s = experienceReducer(resolvedState, { type: "ACCEPT_ALTERNATIVE" });
    expect(s.phase).toBe("preview");
    expect(s.finalCall).toBe("B");
  });

  it("SHOW_REFERENCE and SHOW_REVIEW advance phases", () => {
    let s = experienceReducer(
      { ...resolvedState, phase: "preview" },
      { type: "SHOW_REFERENCE" },
    );
    expect(s.phase).toBe("reference");
    s = experienceReducer(s, { type: "SHOW_REVIEW" });
    expect(s.phase).toBe("review");
  });

  it("COMPLETE_ROUND appends a RoundResult and advances to situation", () => {
    const s = experienceReducer(reviewState, { type: "COMPLETE_ROUND" });
    expect(s.completedRounds).toHaveLength(1);
    const round = s.completedRounds[0];
    expect(round.scenarioId).toBe(scenarios[0].id);
    expect(round.professionalCall).toBe(scenarios[0].professional.call);
    expect(round.initialCall).toBe("A");
    expect(round.aiStance).toBe("challenge");
    expect(round.aiAlternativeCall).toBe("B");
    expect(round.aiResponseSource).toBe("fallback");
    expect(round.finalCall).toBe("A");
    expect(round.changedAfterAI).toBe(false);
    expect(
      (round as typeof round & { scenarioSnapshot?: unknown }).scenarioSnapshot,
    ).toBeDefined();
    expect(s.phase).toBe("situation");
    expect(s.scenarioIndex).toBe(1);
  });

  it("completes a round with the full reasoning chain and next check", () => {
    const completed = experienceReducer(
      {
        ...reviewState,
        optionalFreeformReasoning: "先确认空间，再决定是否提速。",
        userResponseToChallenge: "keep",
        changeReason: "AI 提到的风险还没有改变关键条件。",
        postRoundReflection: "我需要更明确地说出关键条件。",
        nextTrainingHypothesis: "下一次先检查关键条件是否仍成立。",
      },
      { type: "COMPLETE_ROUND" },
    );
    expect(completed.completedRounds[0]).toMatchObject({
      optionalFreeformReasoning: "先确认空间，再决定是否提速。",
      aiChallenge: challenge,
      userResponseToChallenge: "keep",
      changeReason: "AI 提到的风险还没有改变关键条件。",
      professionalReference: scenarios[0].professional,
      postRoundReflection: "我需要更明确地说出关键条件。",
      nextTrainingHypothesis: "下一次先检查关键条件是否仍成立。",
    });
  });

  it("after the third round moves to summary", () => {
    let s: ExperienceState = reviewState;
    for (let i = 0; i < 3; i += 1) {
      if (i > 0) {
        s = {
          ...s,
          phase: "review",
          scenarioIndex: i,
          initialCall: i === 1 ? "B" : "C",
          reasonIds: ["time_pressure"],
          challenge,
          finalCall: "A",
        };
      }
      s = experienceReducer(s, { type: "COMPLETE_ROUND" });
    }
    expect(s.completedRounds).toHaveLength(3);
    expect(s.phase).toBe("summary");
    expect(s.scenarioIndex).toBeLessThanOrEqual(2);
  });

  it("can run a one-scenario practice pool without changing the default pool", () => {
    const practiceScenario = {
      ...scenarios[0],
      id: "gate1-practice-r34",
      verificationStatus: "practice" as const,
    };

    const completed = experienceReducer(
      reviewState,
      { type: "COMPLETE_ROUND" },
      [practiceScenario],
    );

    expect(completed.phase).toBe("summary");
    expect(completed.completedRounds[0]?.scenarioId).toBe(
      "gate1-practice-r34",
    );
  });

  it("drives a full round loop R1 -> R2 -> R3 -> summary through every phase", () => {
    let s: ExperienceState = initialState;
    const calls: CallId[] = ["A", "B", "C"];
    for (let round = 0; round < 3; round += 1) {
      s = experienceReducer(s, { type: "START" });
      expect(s.phase).toBe("situation");
      s = experienceReducer(s, { type: "BEGIN_DECISION" });
      s = experienceReducer(s, { type: "SET_CALL", call: calls[round] });
      s = experienceReducer(s, {
        type: "TOGGLE_REASON",
        reason: "known_position",
      });
      s = experienceReducer(s, { type: "REQUEST_CHALLENGE" });
      expect(s.phase).toBe("challenge");
      s = experienceReducer(s, { type: "CHALLENGE_RESOLVED", challenge });
      s = experienceReducer(s, { type: "KEEP_INITIAL" });
      expect(s.phase).toBe("preview");
      s = experienceReducer(s, { type: "SHOW_REFERENCE" });
      expect(s.phase).toBe("reference");
      s = experienceReducer(s, { type: "SHOW_REVIEW" });
      expect(s.phase).toBe("review");
      s = experienceReducer(s, { type: "COMPLETE_ROUND" });
    }
    expect(s.completedRounds).toHaveLength(3);
    expect(s.phase).toBe("summary");
    expect(s.scenarioIndex).toBe(2);
  });

  it("blocks forward actions from the wrong phase", () => {
    // Intro 不能直接跳到 reference / review
    expect(
      experienceReducer(initialState, { type: "SHOW_REFERENCE" }).phase,
    ).toBe("intro");
    expect(
      experienceReducer(initialState, { type: "SHOW_REVIEW" }).phase,
    ).toBe("intro");
    expect(
      experienceReducer(initialState, { type: "BEGIN_DECISION" }).phase,
    ).toBe("intro");
    // 已进入 challenge 后不能再改 initial call
    const afterChallenge = experienceReducer(resolvedState, {
      type: "SET_CALL",
      call: "C",
    });
    expect(afterChallenge.initialCall).toBe("A");
    // 不能跳过正常流程直接完成 round
    const skipped = experienceReducer(decisionState, { type: "COMPLETE_ROUND" });
    expect(skipped.completedRounds).toEqual([]);
    expect(skipped.phase).toBe("decision");
    // 未到 review 不能进入 preview
    expect(
      experienceReducer(initialState, { type: "KEEP_INITIAL" }).phase,
    ).toBe("intro");
  });

  it("RESET clears the session to intro", () => {
    const s = experienceReducer(resolvedState, { type: "RESET" });
    expect(s).toEqual(initialState);
  });

  it("HYDRATE restores a valid session", () => {
    const saved: ExperienceState = {
      ...initialState,
      phase: "situation",
      scenarioIndex: 1,
    };
    const s = experienceReducer(initialState, { type: "HYDRATE", payload: saved });
    expect(s.phase).toBe("situation");
    expect(s.scenarioIndex).toBe(1);
  });

  it("returns unchanged state for invalid ordinary actions", () => {
    const s = experienceReducer(initialState, { type: "ACCEPT_ALTERNATIVE" });
    expect(s).toEqual(initialState);
  });
});
