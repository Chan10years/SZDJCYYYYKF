import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import {
  loadSession,
  saveSession,
  SESSION_STORAGE_KEY,
} from "@/lib/storage";
import { initializeSessionForEntry } from "@/lib/freshEntry";
import { ExperienceShell } from "@/components/experience/ExperienceShell";
import type { PersistedSession } from "@/domain/sessionSchema";

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

const savedSession: PersistedSession = {
  phase: "decision",
  scenarioIndex: 1,
  initialCall: "B",
  reasonIds: ["time_pressure"],
  challenge: null,
  finalCall: null,
  completedRounds: [],
};

describe("fresh entry", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("clears the old session and starts at Intro for new=1", () => {
    saveSession(savedSession);
    window.history.replaceState({}, "", "/?new=1&source=classroom#intro");

    expect(initializeSessionForEntry()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?source=classroom");
    expect(window.location.hash).toBe("#intro");
  });

  it("renders Intro instead of the old phase for a Fresh Entry", async () => {
    saveSession(savedSession);
    window.history.replaceState({}, "", "/?new=1");

    render(createElement(ExperienceShell));

    expect(
      await screen.findByRole("button", { name: "开始体验" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "锁定判断" })).toBeNull();
  });

  it("recovers new progress after the consumed entry is refreshed", () => {
    saveSession(savedSession);
    window.history.replaceState({}, "", "/?new=1");

    expect(initializeSessionForEntry()).toBeNull();

    const newProgress: PersistedSession = {
      ...savedSession,
      phase: "challenge",
      scenarioIndex: 0,
    };
    saveSession(newProgress);

    expect(initializeSessionForEntry()).toEqual(newProgress);
    expect(window.location.search).toBe("");
  });

  it("does not clear an independent tab when the current tab uses Fresh Entry", () => {
    const tabAStorage = createMemoryStorage();
    const tabBStorage = createMemoryStorage();

    vi.stubGlobal("sessionStorage", tabAStorage);
    saveSession(savedSession);
    vi.stubGlobal("sessionStorage", tabBStorage);
    saveSession(savedSession);

    vi.stubGlobal("sessionStorage", tabAStorage);
    window.history.replaceState({}, "", "/?new=1");
    expect(initializeSessionForEntry()).toBeNull();

    vi.stubGlobal("sessionStorage", tabBStorage);
    expect(loadSession()).toEqual(savedSession);
  });

  it("keeps ordinary refresh recovery without new=1", () => {
    saveSession(savedSession);

    expect(initializeSessionForEntry()).toEqual(savedSession);
    expect(window.location.search).toBe("");
  });
});
