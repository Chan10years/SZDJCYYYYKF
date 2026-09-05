import { describe, expect, it, beforeEach } from "vitest";
import {
  clearSession,
  loadSession,
  saveSession,
  SESSION_STORAGE_KEY,
} from "@/lib/storage";
import { experienceReducer, initialState } from "@/domain/experienceReducer";
import type { ExperienceState } from "@/domain/experienceReducer";
import type { PersistedSession } from "@/domain/sessionSchema";
import type { ChallengeOutput } from "@/domain/types";

const validSession: PersistedSession = {
  phase: "challenge",
  scenarioIndex: 0,
  initialCall: "A",
  reasonIds: ["known_position"],
  challenge: {
    stance: "challenge",
    acknowledge: "你把「已知位置」作为主要依据。",
    blindspot: "练习用盲点。",
    question: "练习用反问。",
    alternativeCall: "B",
    source: "fallback",
  },
  finalCall: null,
  completedRounds: [],
};

describe("session storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a valid session", () => {
    saveSession(validSession);
    expect(loadSession()).toEqual(validSession);
  });

  it("returns null when the key is missing", () => {
    expect(loadSession()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "{ not valid json");
    expect(loadSession()).toBeNull();
  });

  it("returns null for schema-invalid data", () => {
    const invalid = { ...validSession, scenarioIndex: 99 };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(invalid));
    expect(loadSession()).toBeNull();
  });

  it("removes the key on clear", () => {
    saveSession(validSession);
    clearSession();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("recovers to summary with three rounds after refresh (demo path)", () => {
    const challenge: ChallengeOutput = {
      stance: "challenge",
      acknowledge: "你把「已知位置」作为主要依据。",
      blindspot: "练习用盲点。",
      question: "练习用反问。",
      alternativeCall: "B",
      source: "fallback",
    };

    let state: ExperienceState = {
      ...initialState,
      phase: "review",
      initialCall: "A",
      reasonIds: ["known_position"],
      challenge,
      finalCall: "A",
    };

    for (let i = 0; i < 3; i += 1) {
      if (i > 0) {
        state = {
          ...state,
          phase: "review",
          scenarioIndex: i,
          initialCall: i === 1 ? "B" : "C",
          reasonIds: ["time_pressure"],
          challenge,
          finalCall: "A",
        };
      }
      state = experienceReducer(state, { type: "COMPLETE_ROUND" });
    }

    expect(state.phase).toBe("summary");
    expect(state.completedRounds).toHaveLength(3);

    saveSession(state);
    const restored = loadSession();
    expect(restored).toEqual(state);
    expect(restored?.phase).toBe("summary");
    expect(restored?.completedRounds).toHaveLength(3);
  });
});