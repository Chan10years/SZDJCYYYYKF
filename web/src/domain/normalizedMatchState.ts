import { z } from "zod";

const FiniteNumberSchema = z.number().finite();

const WorldPositionSchema = z
  .object({
    x: FiniteNumberSchema,
    y: FiniteNumberSchema,
    z: FiniteNumberSchema,
  })
  .strict();

const PlayerSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    team: z.enum(["G2", "Team Spirit"]),
    side: z.enum(["CT", "T"]),
    alive: z.boolean(),
    health: FiniteNumberSchema.int().min(0).max(100),
    weapon: z.string().trim().min(1).nullable(),
    worldPosition: WorldPositionSchema,
    place: z.string().trim().min(1).nullable(),
  })
  .strict()
  .superRefine((player, context) => {
    const expectedSide = player.team === "G2" ? "CT" : "T";
    if (player.side !== expectedSide) {
      context.addIssue({
        code: "custom",
        path: ["side"],
        message: `team ${player.team} must be on side ${expectedSide}`,
      });
    }
  });

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
  });

const ScoreSchema = z
  .object({
    G2: FiniteNumberSchema.int().min(0),
    "Team Spirit": FiniteNumberSchema.int().min(0),
  })
  .strict();

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

const MapSchema = z
  .object({
    name: z.string().trim().min(1),
    asset: z.string().trim().min(1),
    overview: OverviewMetadataSchema,
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
    warningTick: FiniteNumberSchema.int().min(0),
    warningGameTime: FiniteNumberSchema.min(0),
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
    match: z.literal("G2 vs Team Spirit"),
    parser: z.literal("demoparser2"),
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
  .strict();

export type NormalizedMatchState = z.infer<typeof NormalizedMatchStateSchema>;
export type NormalizedPlayer = NormalizedMatchState["players"][number];
export type OverviewMetadata = NormalizedMatchState["map"]["overview"];

export function parseNormalizedMatchState(input: unknown): NormalizedMatchState {
  return NormalizedMatchStateSchema.parse(input);
}
