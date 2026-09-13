import { z } from "zod";

const FiniteNumberSchema = z.number().finite();

const WorldPositionSchema = z
  .object({
    x: FiniteNumberSchema,
    y: FiniteNumberSchema,
    z: FiniteNumberSchema,
  })
  .strict();

const TeamNameSchema = z.string().trim().min(1);

const PlayerSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    team: TeamNameSchema,
    side: z.enum(["CT", "T"]),
    alive: z.boolean(),
    health: FiniteNumberSchema.int().min(0).max(100),
    weapon: z.string().trim().min(1).nullable(),
    worldPosition: WorldPositionSchema,
    place: z.string().trim().min(1).nullable(),
  })
  .strict();

const PlayersSchema = z
  .array(PlayerSchema)
  .length(10)
  .superRefine((players, context) => {
    const ids = new Set(players.map((player) => player.id));
    if (ids.size !== players.length) {
      context.addIssue({
        code: "custom",
        message: "players must have unique stable identities",
      });
    }
    for (const side of ["CT", "T"] as const) {
      const count = players.filter((player) => player.side === side).length;
      if (count !== 5) {
        context.addIssue({
          code: "custom",
          message: `expected five players on side ${side}, got ${count}`,
        });
      }
    }
    const teams = new Set(players.map((player) => player.team));
    if (teams.size !== 2) {
      context.addIssue({
        code: "custom",
        message: "a normalized match state must contain exactly two teams",
      });
    }
    for (const team of teams) {
      const count = players.filter((player) => player.team === team).length;
      if (count !== 5) {
        context.addIssue({
          code: "custom",
          message: `expected five players for team ${team}, got ${count}`,
        });
      }
    }
  });

const ScoreSchema = z
  .record(z.string(), FiniteNumberSchema.int().min(0))
  .superRefine((score, context) => {
    const teams = Object.keys(score).filter((team) => team.trim().length > 0);
    if (teams.length !== 2) {
      context.addIssue({
        code: "custom",
        message: "a normalized match state score must contain exactly two teams",
      });
    }
  });

const OverviewMetadataSchema = z
  .object({
    posX: FiniteNumberSchema,
    posY: FiniteNumberSchema,
    scale: FiniteNumberSchema.positive(),
    radarWidth: FiniteNumberSchema.positive(),
    radarHeight: FiniteNumberSchema.positive(),
    source: z.string().url(),
  })
  .strict();

export const MapRenderFrameSchema = z
  .object({
    asset: z.string().trim().min(1),
    imageWidth: FiniteNumberSchema.positive(),
    imageHeight: FiniteNumberSchema.positive(),
    coordinateFrame: z.string().trim().min(1),
    affine: z
      .object({
        x: z
          .object({
            scale: FiniteNumberSchema,
            offset: FiniteNumberSchema,
          })
          .strict(),
        y: z
          .object({
            scale: FiniteNumberSchema,
            offset: FiniteNumberSchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const MapSchema = z
  .object({
    name: z.string().trim().min(1),
    /** Null means machine facts exist but no Human-QA-approved raster is attached. */
    asset: z.string().trim().min(1).nullable(),
    overview: OverviewMetadataSchema,
    render: MapRenderFrameSchema.optional(),
  })
  .strict();

const RoundSchema = z
  .object({
    number: FiniteNumberSchema.int().min(1),
    parserRound: FiniteNumberSchema.int().min(0),
    boundaryTick: FiniteNumberSchema.int().min(0),
    score: ScoreSchema,
  })
  .strict();

const TimeSchema = z
  .object({
    display: z.string().trim().min(1),
    semantics: z.literal("round_clock_remaining"),
    remainingSeconds: FiniteNumberSchema.min(0),
    elapsedSeconds: FiniteNumberSchema.min(0),
    roundDurationSeconds: FiniteNumberSchema.positive(),
    roundStartTick: FiniteNumberSchema.int().min(0),
    roundStartGameTime: FiniteNumberSchema.min(0),
    gameTime: FiniteNumberSchema.min(0),
    tickrate: FiniteNumberSchema.positive(),
    /** Some valid demos do not emit a round_time_warning event for short rounds. */
    warningTick: FiniteNumberSchema.int().min(0).nullable(),
    warningGameTime: FiniteNumberSchema.min(0).nullable(),
  })
  .strict()
  .superRefine((time, context) => {
    if (time.remainingSeconds > time.roundDurationSeconds) {
      context.addIssue({
        code: "custom",
        path: ["remainingSeconds"],
        message: "remaining time cannot exceed round duration",
      });
    }
    if ((time.warningTick === null) !== (time.warningGameTime === null)) {
      context.addIssue({
        code: "custom",
        path: ["warningTick"],
        message: "warning tick and warning game time must be provided together",
      });
    }
  });

const BombSchema = z
  .object({
    status: z.enum(["carried", "dropped", "planted", "defused", "exploded", "unavailable"]),
    carrierId: z.string().trim().min(1).nullable(),
    carrierName: z.string().trim().min(1).nullable(),
    derivedFrom: z.string().trim().min(1),
    rawState: z
      .object({
        isPlanted: z.boolean().nullable(),
        isDropped: z.boolean().nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((bomb, context) => {
    if (bomb.status === "carried" && (!bomb.carrierId || !bomb.carrierName)) {
      context.addIssue({
        code: "custom",
        path: ["carrierId"],
        message: "a carried bomb must identify its carrier",
      });
    }
    if (bomb.status !== "carried" && (bomb.carrierId || bomb.carrierName)) {
      context.addIssue({
        code: "custom",
        path: ["carrierId"],
        message: "only a carried bomb may identify a carrier",
      });
    }
  });

const SourceSchema = z
  .object({
    kind: z.literal("offline-demo"),
    demoFile: z.string().trim().min(1),
    demoSha256: z.string().regex(/^[A-F0-9]{64}$/),
    match: z.string().trim().min(1),
    parser: z.string().trim().min(1),
    parserVersion: z.string().trim().min(1),
    demoVersion: z.string().trim().min(1),
    patchVersion: z.string().trim().min(1),
    selectionEvidence: z.string().trim().min(1),
  })
  .strict();

const ExtractionSchema = z
  .object({
    verificationStatus: z.literal("draft"),
    humanQaRequired: z.literal(true),
    roundNumberBasis: z.string().trim().min(1),
    availableFields: z.array(z.string().trim().min(1)).min(1),
    unavailableFields: z.array(z.string().trim().min(1)).min(1),
    derivedFields: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

export const NormalizedMatchStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: SourceSchema,
    map: MapSchema,
    round: RoundSchema,
    tick: FiniteNumberSchema.int().min(0),
    time: TimeSchema,
    players: PlayersSchema,
    bomb: BombSchema,
    extraction: ExtractionSchema,
  })
  .strict()
  .superRefine((state, context) => {
    if (!state || !Array.isArray(state.players) || !state.round || !state.round.score) {
      return;
    }
    const playerTeams = new Set(state.players.map((player) => player.team));
    const scoreTeams = new Set(Object.keys(state.round.score));
    if (
      playerTeams.size !== scoreTeams.size ||
      [...playerTeams].some((team) => !scoreTeams.has(team))
    ) {
      context.addIssue({
        code: "custom",
        path: ["round", "score"],
        message: "score teams must match the two teams in the player state",
      });
    }
  });

export type NormalizedMatchState = z.infer<typeof NormalizedMatchStateSchema>;
export type NormalizedPlayer = NormalizedMatchState["players"][number];
export type OverviewMetadata = NormalizedMatchState["map"]["overview"];

export function parseNormalizedMatchState(input: unknown): NormalizedMatchState {
  return NormalizedMatchStateSchema.parse(input);
}
