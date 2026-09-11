import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => {
      values.clear();
    },
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  };
}

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
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("round-trips a valid session", () => {
    saveSession(validSession);
    expect(loadSession()).toEqual(validSession);
  });

  it("stores a session in sessionStorage instead of shared localStorage", () => {
    saveSession(validSession);

    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe(
      JSON.stringify(validSession),
    );
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("does not hydrate a stale localStorage session", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(validSession));

    expect(loadSession()).toBeNull();
  });

  it("starts a new or reopened tab with empty session storage", () => {
    const tabAStorage = createMemoryStorage();
    const tabBStorage = createMemoryStorage();
    const reopenedTabStorage = createMemoryStorage();

    vi.stubGlobal("sessionStorage", tabAStorage);
    saveSession(validSession);

    vi.stubGlobal("sessionStorage", tabBStorage);
    expect(loadSession()).toBeNull();

    vi.stubGlobal("sessionStorage", reopenedTabStorage);
    expect(loadSession()).toBeNull();
  });

  it("does not let reset in one tab clear another tab", () => {
    const tabAStorage = createMemoryStorage();
    const tabBStorage = createMemoryStorage();

    vi.stubGlobal("sessionStorage", tabAStorage);
    saveSession(validSession);

    vi.stubGlobal("sessionStorage", tabBStorage);
    clearSession();

    vi.stubGlobal("sessionStorage", tabAStorage);
    expect(loadSession()).toEqual(validSession);
  });

  it("returns null when the key is missing", () => {
    expect(loadSession()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, "{ not valid json");
    expect(loadSession()).toBeNull();
  });

  it("returns null for schema-invalid data", () => {
    const invalid = { ...validSession, scenarioIndex: 99 };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(invalid));
    expect(loadSession()).toBeNull();
  });

  it("removes the key on clear", () => {
    saveSession(validSession);
    clearSession();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("keeps the in-memory flow alive when setItem is denied", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    expect(() => saveSession(validSession)).not.toThrow();
  });

  it("returns no saved session when getItem is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("storage denied", "SecurityError");
    });

    expect(loadSession()).toBeNull();
  });

  it("does not crash reset when removeItem is denied", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("storage denied", "SecurityError");
    });

    expect(() => clearSession()).not.toThrow();
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
