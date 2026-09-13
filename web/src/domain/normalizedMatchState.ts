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

const RenderFrameBaseSchema = z.object({
  asset: z.string().trim().min(1),
  imageWidth: FiniteNumberSchema.positive(),
  imageHeight: FiniteNumberSchema.positive(),
  coordinateFrame: z.string().trim().min(1),
  overviewSource: z.string().url(),
});

const RadarOverviewRenderFrameSchema = RenderFrameBaseSchema.extend({
  projection: z.literal("cs2-radar-overview"),
  radarWidth: FiniteNumberSchema.positive(),
  radarHeight: FiniteNumberSchema.positive(),
}).strict();

/**
 * New-map render frames must remain in the actual CS2 radar coordinate frame.
 * The legacy Lite2 affine is kept outside this persisted state contract.
 */
export const MapRenderFrameSchema = RadarOverviewRenderFrameSchema;

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
    semantics: z.enum(["round_clock_remaining", "post_plant_elapsed"]),
    remainingSeconds: FiniteNumberSchema.min(0).nullable(),
    elapsedSeconds: FiniteNumberSchema.min(0),
    postPlantElapsedSeconds: FiniteNumberSchema.min(0).nullable(),
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
    if (
      time.semantics === "round_clock_remaining" &&
      time.remainingSeconds === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["remainingSeconds"],
        message: "round-clock semantics require a remaining time value",
      });
    }
    if (
      time.semantics === "round_clock_remaining" &&
      time.postPlantElapsedSeconds !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["postPlantElapsedSeconds"],
        message: "round-clock semantics cannot include post-plant elapsed time",
      });
    }
    if (
      time.semantics === "post_plant_elapsed" &&
      time.remainingSeconds !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["remainingSeconds"],
        message: "post-plant semantics cannot present round-clock remaining time",
      });
    }
    if (
      time.semantics === "post_plant_elapsed" &&
      time.postPlantElapsedSeconds === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["postPlantElapsedSeconds"],
        message: "post-plant semantics require elapsed time since plant",
      });
    }
    if (
      time.remainingSeconds !== null &&
      time.remainingSeconds > time.roundDurationSeconds
    ) {
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
    if (
      !state ||
      !Array.isArray(state.players) ||
      !state.round ||
      !state.round.score ||
      !state.map ||
      !state.map.overview ||
      !state.time ||
      !state.bomb
    ) {
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
    if (
      state.time.semantics === "post_plant_elapsed" &&
      state.bomb.status !== "planted"
    ) {
      context.addIssue({
        code: "custom",
        path: ["time", "semantics"],
        message: "post-plant time semantics require a planted bomb state",
      });
    }
    if (
      state.time.semantics === "round_clock_remaining" &&
      state.bomb.status === "planted"
    ) {
      context.addIssue({
        code: "custom",
        path: ["time", "semantics"],
        message: "a planted bomb cannot use round-clock remaining semantics",
      });
    }
    if (state.map.render) {
      if (state.map.render.overviewSource !== state.map.overview.source) {
        context.addIssue({
          code: "custom",
          path: ["map", "render", "overviewSource"],
          message: "render projection must reference the map overview source",
        });
      }
      if (
        state.map.render.projection === "cs2-radar-overview" &&
        (state.map.render.radarWidth !== state.map.overview.radarWidth ||
          state.map.render.radarHeight !== state.map.overview.radarHeight)
      ) {
        context.addIssue({
          code: "custom",
          path: ["map", "render"],
          message: "radar render dimensions must match the map overview metadata",
        });
      }
    }
  });

export type NormalizedMatchState = z.infer<typeof NormalizedMatchStateSchema>;
export type NormalizedPlayer = NormalizedMatchState["players"][number];
export type OverviewMetadata = NormalizedMatchState["map"]["overview"];

export function formatTimeForFact(time: NormalizedMatchState["time"]): string {
  return time.semantics === "round_clock_remaining"
    ? `${time.display} remaining`
    : time.display;
}

export function parseNormalizedMatchState(input: unknown): NormalizedMatchState {
  return NormalizedMatchStateSchema.parse(input);
}
