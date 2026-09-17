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
  ScenarioDraftSchema,
  type ScenarioDraft,
  type ScenarioDraftQaCheckId,
} from "./scenarioDraft";
import type { Scenario } from "./types";

const HumanTextSchema = z.string().trim().min(1).max(500);

const ImportedFactSchema = ScenarioFactSchema.extend({
  detail: HumanTextSchema,
});

export const ImportedObservableBoundarySchema = z
  .object({
    side: z.enum(["CT", "T"]),
    visiblePlayerIds: z.array(z.string().trim().min(1)).min(1).max(5),
    confirmed: z.literal(true),
    bombVisibility: z.enum(["hidden", "confirmed"]),
  })
  .strict();

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
    /** Human QA boundary; the machine Draft remains complete, practice does not. */
    perspective: ImportedObservableBoundarySchema,
    mapAsset: z
      .enum([
        "/maps/Lite2_CurrentStateBase.png",
        "/maps/Ancient_CurrentStateBase.png",
      ])
      .nullable(),
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
  visiblePlayerIds: ReadonlySet<string>,
) {
  const visiblePlayers = state.players.filter((player) =>
    visiblePlayerIds.has(player.id),
  );
  const visibleAlive = visiblePlayers.filter((player) => player.alive).length;
  const bombDetail =
    authoring.perspective.bombVisibility === "confirmed"
      ? state.bomb.status === "carried" &&
        state.bomb.carrierId !== null &&
        !visiblePlayerIds.has(state.bomb.carrierId)
        ? "未知（C4 carrier 不属于已确认可见阵营）"
        : state.bomb.status === "carried"
          ? `由 ${state.bomb.carrierName ?? "已确认可见队员"} 携带`
          : state.bomb.status
      : "未知（Human QA 未确认该 perspective 可见 C4）";
  return [
    {
      label: "比分",
      detail: Object.entries(state.round.score)
        .map(([team, score]) => `${team} ${score}`)
        .join(" : "),
    },
    {
      label: "截点",
      detail: `Round ${state.round.number} · Tick ${state.tick} · ${state.time.display}`,
    },
    {
      label: "存活",
      detail: `${visibleAlive} ${authoring.perspective.side} · 仅该 perspective 可见`,
    },
    {
      label: "C4",
      detail: bombDetail,
    },
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
  const visiblePlayerIds = new Set(authoring.perspective.visiblePlayerIds);
  const visiblePlayers = state.players.filter((player) =>
    visiblePlayerIds.has(player.id),
  );
  if (
    visiblePlayers.length !== visiblePlayerIds.size ||
    visiblePlayers.some((player) => player.side !== authoring.perspective.side)
  ) {
    throw new Error(
      "observable boundary may only expose players from the confirmed perspective side",
    );
  }

  const mapAssetMap = {
    "/maps/Lite2_CurrentStateBase.png": "de_mirage",
    "/maps/Ancient_CurrentStateBase.png": "de_ancient",
  } as const;
  if (
    authoring.mapAsset !== null &&
    mapAssetMap[authoring.mapAsset] !== state.map.name
  ) {
    throw new Error(
      "a current-state raster can only be attached to a matching Demo map",
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
      alive: `${visiblePlayers.filter((player) => player.alive).length} ${authoring.perspective.side} · 仅该 perspective 可见`,
      objective: authoring.objectiveFraming,
      facts: buildImportedFacts(state, authoring, visiblePlayerIds),
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
