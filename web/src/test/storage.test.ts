import { describe, expect, it, beforeEach } from "vitest";
import {
  clearSession,
  loadSession,
  saveSession,
  SESSION_STORAGE_KEY,
} from "@/lib/storage";
import type { PersistedSession } from "@/domain/sessionSchema";

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
});