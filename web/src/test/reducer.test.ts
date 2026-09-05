import { describe, expect, it } from "vitest";
import {
  experienceReducer,
  initialState,
  type ExperienceState,
} from "@/domain/experienceReducer";
import { fixtureScenarios } from "@/data/scenarios.fixture";
import type { ChallengeOutput } from "@/domain/types";

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
    expect(round.scenarioId).toBe(fixtureScenarios[0].id);
    expect(round.initialCall).toBe("A");
    expect(round.aiStance).toBe("challenge");
    expect(round.aiAlternativeCall).toBe("B");
    expect(round.aiResponseSource).toBe("fallback");
    expect(round.finalCall).toBe("A");
    expect(round.changedAfterAI).toBe(false);
    expect(s.phase).toBe("situation");
    expect(s.scenarioIndex).toBe(1);
  });

  it("after the third round moves to summary", () => {
    let s: ExperienceState = reviewState;
    for (let i = 0; i < 3; i += 1) {
      if (i > 0) {
        s = {
          phase: "decision",
          scenarioIndex: s.scenarioIndex,
          initialCall: i === 1 ? "B" : "C",
          reasonIds: ["time_pressure"],
          challenge,
          finalCall: "A",
          completedRounds: s.completedRounds,
        };
      }
      s = experienceReducer(s, { type: "COMPLETE_ROUND" });
    }
    expect(s.completedRounds).toHaveLength(3);
    expect(s.phase).toBe("summary");
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