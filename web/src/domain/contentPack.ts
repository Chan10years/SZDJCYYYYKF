import {
  NormalizedMatchStateSchema,
  formatTimeForFact,
  type NormalizedMatchState,
} from "./normalizedMatchState";
import { z } from "zod";

export const CONTENT_QA_CHECK_IDS = [
  "source",
  "round-time",
  "players",
  "objective",
  "coordinates",
  "known-unknown",
  "call-tradeoff",
  "tactical-preview",
  "professional-reference",
] as const;

export const ContentQaCheckIdSchema = z.enum(CONTENT_QA_CHECK_IDS);
export type ContentQaCheckId = z.infer<typeof ContentQaCheckIdSchema>;

const ContentQaCheckSchema = z
  .object({
    id: ContentQaCheckIdSchema,
    label: z.string().trim().min(1),
    owner: z.enum(["machine", "human"]),
    status: z.enum(["machine-extracted", "needs-human"]),
    evidence: z.string().trim().min(1),
  })
  .strict();

const ContentPackEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    verificationStatus: z.literal("draft"),
    humanQaRequired: z.literal(true),
    normalizedMatchState: NormalizedMatchStateSchema,
    qaChecks: z.array(ContentQaCheckSchema).length(CONTENT_QA_CHECK_IDS.length),
  })
  .strict()
  .superRefine((entry, context) => {
    const ids = entry.qaChecks.map((check) => check.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["qaChecks"],
        message: "Content Pack QA checks must have unique IDs",
      });
    }
    for (const id of CONTENT_QA_CHECK_IDS) {
      if (!uniqueIds.has(id)) {
        context.addIssue({
          code: "custom",
          path: ["qaChecks"],
          message: `Content Pack QA check ${id} is missing`,
        });
      }
    }
  });

export const RealContentPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    verificationStatus: z.literal("draft"),
    humanQaRequired: z.literal(true),
    entries: z.array(ContentPackEntrySchema).min(1),
  })
  .strict()
  .superRefine((pack, context) => {
    const ids = pack.entries.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Content Pack entry IDs must be unique",
      });
    }
  });

export type ContentQaCheck = z.infer<typeof ContentQaCheckSchema>;
export type RealContentPack = z.infer<typeof RealContentPackSchema>;

export type RealContentPackInput = {
  id: string;
  state: unknown;
};

function formatScore(state: NormalizedMatchState): string {
  return Object.entries(state.round.score)
    .map(([team, score]) => `${team} ${score ?? "unavailable"}`)
    .join(" : ");
}

function formatAlive(state: NormalizedMatchState): string {
  return (["CT", "T"] as const)
    .map(
      (side) =>
        `${state.players.filter((player) => player.side === side && player.alive).length} ${side}`,
    )
    .join(" / ");
}

function buildQaChecks(state: NormalizedMatchState): ContentQaCheck[] {
  const hasRasterCalibration = state.map.render !== undefined;
  return [
    {
      id: "source",
      label: "来源 / demo 身份",
      owner: "machine",
      status: "machine-extracted",
      evidence: `${state.source.match} · ${state.map.name} · ${state.source.demoFile} · SHA-256 ${state.source.demoSha256}`,
    },
    {
      id: "round-time",
      label: "回合 / 时间截点",
      owner: "machine",
      status: "machine-extracted",
      evidence: `Round ${state.round.number} · parser round ${state.round.parserRound} · Tick ${state.tick} · ${formatTimeForFact(state.time)} · ${formatScore(state)}`,
    },
    {
      id: "players",
      label: "玩家 / 存活状态",
      owner: "machine",
      status: "machine-extracted",
      evidence: `${state.players.length} 个唯一玩家 · ${formatAlive(state)} · world coordinates retained`,
    },
    {
      id: "objective",
      label: "Bomb / Objective",
      owner: "machine",
      status: "machine-extracted",
      evidence:
        state.bomb.status === "carried"
          ? `C4 carried by ${state.bomb.carrierName} · ${state.bomb.derivedFrom}`
          : `C4 ${state.bomb.status} · ${state.bomb.derivedFrom}`,
    },
    {
      id: "coordinates",
      label: "坐标 / 空间标定",
      owner: "human",
      status: "needs-human",
      evidence: hasRasterCalibration
        ? `${state.map.name} overview → configured raster exists; coach must visually verify landmarks and player placement`
        : `${state.map.name} overview coordinates were extracted, but no Human-QA raster calibration is attached`,
    },
    {
      id: "known-unknown",
      label: "Known / Unknown 边界",
      owner: "human",
      status: "needs-human",
      evidence: "Machine state does not infer what the player knew at the decision moment; coach must author and verify this boundary",
    },
    {
      id: "call-tradeoff",
      label: "Call / Reason / trade-off",
      owner: "human",
      status: "needs-human",
      evidence: "No Call, Reason, risk, or trade-off is generated from the demo snapshot",
    },
    {
      id: "tactical-preview",
      label: "Tactical Preview 空间语义",
      owner: "human",
      status: "needs-human",
      evidence: "Routes, zones, player intent, and map semantics require separate coach authorship and visual QA",
    },
    {
      id: "professional-reference",
      label: "Professional / Coach reference",
      owner: "human",
      status: "needs-human",
      evidence: "A demo snapshot does not establish the professional decision rationale or a unique correct answer",
    },
  ];
}

/**
 * Build a draft-only production pack from machine snapshots. This function
 * intentionally has no promotion method: authored semantics and Human QA stay
 * outside the extraction boundary.
 */
export function buildRealContentPack(
  inputs: readonly RealContentPackInput[],
): RealContentPack {
  if (inputs.length === 0) {
    throw new Error("a real content pack requires at least one snapshot");
  }

  return RealContentPackSchema.parse({
    schemaVersion: 1,
    verificationStatus: "draft",
    humanQaRequired: true,
    entries: inputs.map(({ id, state }) => {
      const normalizedState = NormalizedMatchStateSchema.parse(state);
      return {
        id,
        verificationStatus: "draft",
        humanQaRequired: true,
        normalizedMatchState: normalizedState,
        qaChecks: buildQaChecks(normalizedState),
      };
    }),
  });
}
