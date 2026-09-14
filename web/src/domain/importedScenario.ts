import { z } from "zod";
import {
  CallOptionSchema,
  ChallengeGuidanceByCallSchema,
  ProfessionalReferenceSchema,
  ReasonOptionSchema,
  ScenarioFactSchema,
  ScenarioSchema,
} from "./schemas";
import {
  assertAllQaChecksApproved,
  buildPracticeFacts,
  ScenarioDraftSchema,
  type ScenarioDraft,
  type ScenarioDraftQaCheckId,
} from "./scenarioDraft";
import type { Scenario } from "./types";

const HumanTextSchema = z.string().trim().min(1).max(500);

const ImportedFactSchema = ScenarioFactSchema.extend({
  detail: HumanTextSchema,
});

export const ImportedScenarioAuthoringSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    purpose: z.string().trim().min(1).max(240),
    trainingFraming: z.string().trim().min(1).max(240),
    objectiveFraming: z.string().trim().min(1).max(240),
    knownFact: ImportedFactSchema,
    unknownFact: ImportedFactSchema,
    calls: z.array(CallOptionSchema).length(3),
    reasonOptions: z.array(ReasonOptionSchema).min(3).max(6),
    challengeGuidance: ChallengeGuidanceByCallSchema,
    tacticalNotes: z
      .object({
        A: HumanTextSchema,
        B: HumanTextSchema,
        C: HumanTextSchema,
      })
      .strict(),
    professional: ProfessionalReferenceSchema,
    mapAsset: z.literal("/maps/Lite2_CurrentStateBase.png").nullable(),
  })
  .strict();

export type ImportedScenarioAuthoring = z.infer<
  typeof ImportedScenarioAuthoringSchema
>;

function buildPreview(note: string) {
  return {
    routes: [],
    zones: [],
    metrics: [
      {
        label: "路线 / 区域（Human QA）",
        value: note,
      },
    ],
  };
}

function buildImportedFacts(
  state: ScenarioDraft["normalizedMatchState"],
  authoring: ImportedScenarioAuthoring,
) {
  return [
    ...buildPracticeFacts(state),
    {
      label: `已确认 · ${authoring.knownFact.label}`,
      detail: authoring.knownFact.detail,
    },
    {
      label: `未知 · ${authoring.unknownFact.label}`,
      detail: authoring.unknownFact.detail,
    },
  ];
}

/**
 * The imported Draft is machine-only until this function receives both the
 * complete Human QA payload and every machine QA confirmation. It is
 * intentionally separate from the existing Gate 1 approval helper so a
 * fixture/authored Scenario can never be silently reused for a new Demo.
 */
export function buildImportedPracticeScenario(
  draftInput: unknown,
  authoringInput: unknown,
  approvedCheckIds: readonly string[],
): Scenario {
  const draft = ScenarioDraftSchema.parse(draftInput);
  if (draft.authoredScenarioId !== null) {
    throw new Error("imported practice approval requires a machine-only Draft");
  }
  const authoring = ImportedScenarioAuthoringSchema.parse(authoringInput);
  assertAllQaChecksApproved(approvedCheckIds);
  const state = draft.normalizedMatchState;

  if (
    authoring.mapAsset !== null &&
    state.map.name !== "de_mirage"
  ) {
    throw new Error(
      "the existing Mirage raster can only be attached to a Mirage Demo",
    );
  }

  const scenarioInput = {
    id: draft.id,
    title: authoring.title,
    purpose: `${authoring.purpose} · ${authoring.trainingFraming}`,
    verificationStatus: "practice" as const,
    source: {
      event: "Local Demo import",
      match: state.source.match,
      map: state.map.name,
      round: state.round.number,
      sourceLabel: `${state.source.demoFile} · Human QA imported practice`,
    },
    ...(authoring.mapAsset ? { mapBase: authoring.mapAsset } : {}),
    situation: {
      phase: `Round ${state.round.number} · parser round ${state.round.parserRound}`,
      time: state.time.display,
      alive: `${state.players.filter((player) => player.side === "CT" && player.alive).length}v${state.players.filter((player) => player.side === "T" && player.alive).length}`,
      objective: authoring.objectiveFraming,
      facts: buildImportedFacts(state, authoring),
    },
    calls: authoring.calls,
    reasonOptions: authoring.reasonOptions,
    previewByCall: {
      A: buildPreview(authoring.tacticalNotes.A),
      B: buildPreview(authoring.tacticalNotes.B),
      C: buildPreview(authoring.tacticalNotes.C),
    },
    challengeGuidance: authoring.challengeGuidance,
    professional: authoring.professional,
  };

  return ScenarioSchema.parse(scenarioInput);
}

export type ImportedScenarioQaApproval = readonly ScenarioDraftQaCheckId[];
