import { describe, expect, it } from "vitest";
import normalizedMatchState from "@/data/realMatch/lite2-g2-spirit-r34.json";
import { realScenarios } from "@/data/scenarios.real";
import {
  approveScenarioDraftForPractice,
  buildScenarioDraft,
  SCENARIO_DRAFT_QA_CHECK_IDS,
} from "@/domain/scenarioDraft";

const authoredScenario = realScenarios[1];

describe("Gate 1 ScenarioDraft boundary", () => {
  it("keeps the normalized real state as a draft with explicit QA checks", () => {
    const draft = buildScenarioDraft(normalizedMatchState, authoredScenario);

    expect(draft.verificationStatus).toBe("draft");
    expect(draft.humanQaRequired).toBe(true);
    expect(draft.authoredScenarioId).toBe(authoredScenario.id);
    expect(draft.normalizedMatchState).toEqual(normalizedMatchState);
    expect(draft.qaChecks.map((check) => check.id)).toEqual(
      SCENARIO_DRAFT_QA_CHECK_IDS,
    );
  });

  it("does not promote a draft until every fixed QA check is approved", () => {
    const draft = buildScenarioDraft(normalizedMatchState, authoredScenario);

    expect(() =>
      approveScenarioDraftForPractice(
        draft,
        authoredScenario,
        SCENARIO_DRAFT_QA_CHECK_IDS.slice(0, -1),
      ),
    ).toThrow(/all Human QA checks/);
  });

  it("rejects duplicate or unknown QA approvals", () => {
    const draft = buildScenarioDraft(normalizedMatchState, authoredScenario);

    expect(() =>
      approveScenarioDraftForPractice(
        draft,
        authoredScenario,
        [...SCENARIO_DRAFT_QA_CHECK_IDS, "source"],
      ),
    ).toThrow(/all Human QA checks/);

    expect(() =>
      approveScenarioDraftForPractice(
        draft,
        authoredScenario,
        [...SCENARIO_DRAFT_QA_CHECK_IDS.slice(0, -1), "not-a-check"],
      ),
    ).toThrow(/all Human QA checks/);
  });

  it("promotes only to practice and preserves authored call semantics", () => {
    const draft = buildScenarioDraft(normalizedMatchState, authoredScenario);
    const promoted = approveScenarioDraftForPractice(
      draft,
      authoredScenario,
      SCENARIO_DRAFT_QA_CHECK_IDS,
    );

    expect(promoted.verificationStatus).toBe("practice");
    expect(promoted.verificationStatus).not.toBe("verified");
    expect(promoted.id).toBe(draft.id);
    expect(promoted.mapBase).toBe("/maps/Lite2_CurrentStateBase.png");
    expect(promoted.previewByCall).toEqual(authoredScenario.previewByCall);
    expect(promoted.situation.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "截点", detail: expect.stringContaining("Tick 184065") }),
        expect.objectContaining({ label: "C4", detail: expect.stringContaining("magixx") }),
      ]),
    );
  });

  it("creates an explicit machine-only Draft without an authored Scenario", () => {
    const importedDraft = buildScenarioDraft(normalizedMatchState);

    expect(importedDraft.verificationStatus).toBe("draft");
    expect(importedDraft.authoredScenarioId).toBeNull();
    expect(() =>
      approveScenarioDraftForPractice(
        importedDraft,
        authoredScenario,
        SCENARIO_DRAFT_QA_CHECK_IDS,
      ),
    ).toThrow(/machine-only|authored Scenario mismatch/);
  });
});
