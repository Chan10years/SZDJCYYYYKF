import { z } from "zod";
import {
  NormalizedMatchStateSchema,
  parseNormalizedMatchState,
  type NormalizedMatchState,
} from "./normalizedMatchState";
import { ScenarioSchema } from "./schemas";
import type { Scenario } from "./types";
import { LITE2_CURRENT_STATE_MAP_CALIBRATION } from "./mapCalibration";

export const SCENARIO_DRAFT_QA_CHECK_IDS = [
  "source",
  "round-time",
  "players",
  "bomb",
  "coordinates",
] as const;

export const ScenarioDraftQaCheckIdSchema = z.enum(SCENARIO_DRAFT_QA_CHECK_IDS);
export type ScenarioDraftQaCheckId = z.infer<
  typeof ScenarioDraftQaCheckIdSchema
>;

const ScenarioDraftQaCheckSchema = z
  .object({
    id: ScenarioDraftQaCheckIdSchema,
    label: z.string().trim().min(1),
    evidence: z.string().trim().min(1),
  })
  .strict();

export const ScenarioDraftSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().trim().min(1),
    verificationStatus: z.literal("draft"),
    humanQaRequired: z.literal(true),
    authoredScenarioId: z.string().trim().min(1),
    normalizedMatchState: NormalizedMatchStateSchema,
    qaChecks: z.array(ScenarioDraftQaCheckSchema).length(
      SCENARIO_DRAFT_QA_CHECK_IDS.length,
    ),
  })
  .strict()
  .superRefine((draft, context) => {
    const ids = draft.qaChecks.map((check) => check.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["qaChecks"],
        message: "ScenarioDraft QA checks must have unique IDs",
      });
    }
    for (const id of SCENARIO_DRAFT_QA_CHECK_IDS) {
      if (!uniqueIds.has(id)) {
        context.addIssue({
          code: "custom",
          path: ["qaChecks"],
          message: `ScenarioDraft QA check ${id} is missing`,
        });
      }
    }
  });

export type ScenarioDraft = z.infer<typeof ScenarioDraftSchema>;

function assertDraftInputs(
  state: NormalizedMatchState,
  authoredScenario: Scenario,
): void {
  const authoredMap = authoredScenario.source.map.toLowerCase();
  const expectedMap = authoredMap.startsWith("de_")
    ? authoredMap
    : `de_${authoredMap}`;
  if (
    state.map.name !== expectedMap ||
    state.round.number !== authoredScenario.source.round ||
    state.source.match !== authoredScenario.source.match
  ) {
    throw new Error(
      "ScenarioDraft source does not match the authored Scenario context",
    );
  }
}

function formatScore(state: NormalizedMatchState): string {
  return Object.entries(state.round.score)
    .map(([team, score]) => `${team} ${score}`)
    .join(" : ");
}

function buildQaChecks(state: NormalizedMatchState) {
  const aliveBySide = {
    CT: state.players.filter((player) => player.side === "CT" && player.alive)
      .length,
    T: state.players.filter((player) => player.side === "T" && player.alive)
      .length,
  };
  const hasLegacyLite2Calibration =
    state.map.name === "de_mirage" && state.map.asset === "/maps/Lite2_Map.png";
  return [
    {
      id: "source" as const,
      label: "来源 / 地图",
      evidence: `${state.source.match} · ${state.map.name} · ${state.source.demoFile}`,
    },
    {
      id: "round-time" as const,
      label: "回合 / 时间",
      evidence: `Round ${state.round.number} · Tick ${state.tick} · ${state.time.display} remaining · ${formatScore(state)}`,
    },
    {
      id: "players" as const,
      label: "玩家 / 存活",
      evidence: `${state.players.length} 个唯一 SteamID · ${aliveBySide.CT} CT / ${aliveBySide.T} T · 所有当前玩家状态已保留`,
    },
    {
      id: "bomb" as const,
      label: "Bomb / carrier",
      evidence:
        state.bomb.status === "carried"
          ? `C4 carried by ${state.bomb.carrierName} · ${state.bomb.derivedFrom}`
          : `C4 ${state.bomb.status} · ${state.bomb.derivedFrom}`,
    },
    {
      id: "coordinates" as const,
      label: "坐标 / 底图",
      evidence: state.map.render
        ? `${state.map.name} overview ${state.map.overview.posX}, ${state.map.overview.posY}, scale ${state.map.overview.scale} → ${state.map.render.imageWidth}×${state.map.render.imageHeight} native raster`
        : hasLegacyLite2Calibration
          ? `${state.map.name} overview ${state.map.overview.posX}, ${state.map.overview.posY}, scale ${state.map.overview.scale} → ${LITE2_CURRENT_STATE_MAP_CALIBRATION.imageWidth}×${LITE2_CURRENT_STATE_MAP_CALIBRATION.imageHeight} native raster`
          : `${state.map.name} overview ${state.map.overview.posX}, ${state.map.overview.posY}, scale ${state.map.overview.scale} · raster calibration pending Human QA`,
    },
  ];
}

export function buildScenarioDraft(
  input: unknown,
  authoredScenarioInput: unknown,
): ScenarioDraft {
  const state = parseNormalizedMatchState(input);
  const authoredScenario = ScenarioSchema.parse(authoredScenarioInput);
  assertDraftInputs(state, authoredScenario);

  return ScenarioDraftSchema.parse({
    schemaVersion: 1,
    id: `gate1-${state.source.demoSha256.slice(0, 12).toLowerCase()}-r${state.round.number}`,
    verificationStatus: "draft",
    humanQaRequired: true,
    authoredScenarioId: authoredScenario.id,
    normalizedMatchState: state,
    qaChecks: buildQaChecks(state),
  });
}

function assertAllQaChecksApproved(
  approvedCheckIds: readonly string[],
): asserts approvedCheckIds is readonly ScenarioDraftQaCheckId[] {
  const required = new Set<string>(SCENARIO_DRAFT_QA_CHECK_IDS);
  const approved = new Set(approvedCheckIds);
  const hasUnknown = approvedCheckIds.some((id) => !required.has(id));
  const hasDuplicates = approvedCheckIds.length !== approved.size;
  const hasAll = approved.size === required.size &&
    SCENARIO_DRAFT_QA_CHECK_IDS.every((id) => approved.has(id));
  if (hasUnknown || hasDuplicates || !hasAll) {
    throw new Error("all Human QA checks must be approved exactly once");
  }
}

function buildPracticeFacts(state: NormalizedMatchState) {
  const aliveBySide = {
    CT: state.players.filter((player) => player.side === "CT" && player.alive)
      .length,
    T: state.players.filter((player) => player.side === "T" && player.alive)
      .length,
  };
  return [
    {
      label: "比分",
      detail: formatScore(state),
    },
    {
      label: "截点",
      detail: `Round ${state.round.number} · Tick ${state.tick} · ${state.time.display} remaining`,
    },
    {
      label: "存活",
      detail: `${aliveBySide.CT} CT / ${aliveBySide.T} T · ${state.players.length} 个已解析玩家`,
    },
    {
      label: "C4",
      detail:
        state.bomb.status === "carried"
          ? `由 ${state.bomb.carrierName} 携带 · ${state.bomb.derivedFrom}`
          : `${state.bomb.status} · ${state.bomb.derivedFrom}`,
    },
  ];
}

/**
 * Human QA is an explicit promotion boundary. The result is practice content
 * for the existing flow; it is never silently published as verified content.
 */
export function approveScenarioDraftForPractice(
  draftInput: unknown,
  authoredScenarioInput: unknown,
  approvedCheckIds: readonly string[],
): Scenario {
  const draft = ScenarioDraftSchema.parse(draftInput);
  const authoredScenario = ScenarioSchema.parse(authoredScenarioInput);
  if (draft.authoredScenarioId !== authoredScenario.id) {
    throw new Error("ScenarioDraft authored Scenario mismatch");
  }
  assertAllQaChecksApproved(approvedCheckIds);
  const state = draft.normalizedMatchState;

  return ScenarioSchema.parse({
    ...authoredScenario,
    id: draft.id,
    title: `R${state.round.number}：真实状态 · Human QA practice`,
    purpose: "真实比赛状态 · 先独立判断，再接受 AI 第二意见",
    verificationStatus: "practice",
    source: {
      ...authoredScenario.source,
      round: state.round.number,
      sourceLabel: `${state.source.demoFile} · Human QA draft promotion`,
    },
    mapBase:
      state.map.render?.asset ??
      (state.map.name === "de_mirage" && state.map.asset === "/maps/Lite2_Map.png"
        ? LITE2_CURRENT_STATE_MAP_CALIBRATION.asset
        : authoredScenario.mapBase),
    situation: {
      ...authoredScenario.situation,
      phase: `Round ${state.round.number} · parser round ${state.round.parserRound}`,
      time: state.time.display,
      alive: `${state.players.filter((player) => player.side === "CT" && player.alive).length}v${state.players.filter((player) => player.side === "T" && player.alive).length}`,
      objective:
        state.bomb.status === "carried"
          ? `C4 由 ${state.bomb.carrierName} 携带 · 当前状态截点`
          : `C4 ${state.bomb.status} · 当前状态截点`,
      facts: buildPracticeFacts(state),
    },
    // The real snapshot is rendered by the optional current-state situation
    // view. Authored calls remain the existing, separately authored semantics.
    previewByCall: authoredScenario.previewByCall,
  });
}
