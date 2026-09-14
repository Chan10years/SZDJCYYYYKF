import { z } from "zod";

const Sha256Schema = z.string().regex(/^[A-F0-9]{64}$/);
const FiniteNumberSchema = z.number().finite();

/** Product import guard; it is shared by browser and compatibility paths. */
export const MAX_DEMO_FILE_SIZE_BYTES = 1_000_000_000;

export const DemoImportStatusSchema = z.enum([
  "idle",
  "reading",
  "parsing",
  "ready",
  "unsupported",
  "error",
]);

export const DemoImportSourceSchema = z
  .object({
    kind: z.literal("local-demo"),
    demoSha256: Sha256Schema,
    parser: z.literal("demoparser2"),
    parserVersion: z.string().trim().min(1),
    demoVersion: z.string().trim().min(1),
    patchVersion: z.string().trim().min(1),
  })
  .strict();

const DemoImportOverviewSchema = z
  .object({
    posX: FiniteNumberSchema,
    posY: FiniteNumberSchema,
    scale: FiniteNumberSchema.positive(),
    radarWidth: FiniteNumberSchema.positive(),
    radarHeight: FiniteNumberSchema.positive(),
    source: z.string().url(),
  })
  .strict();

const DemoImportMapSchema = z
  .object({
    name: z.string().trim().min(1),
    overview: DemoImportOverviewSchema.nullable(),
    renderAvailable: z.boolean(),
  })
  .strict();

export const DemoImportTeamSchema = z
  .object({
    label: z.string().trim().min(1),
    side: z.enum(["CT", "T"]),
    playerCount: z.number().int().min(0).max(5),
  })
  .strict();

export const DemoImportPlayerIdentitySchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    side: z.enum(["CT", "T"]),
  })
  .strict();

export const DemoImportRoundSchema = z
  .object({
    number: z.number().int().min(1),
    parserRound: z.number().int().min(0),
    startTick: z.number().int().min(0),
    freezeEndTick: z.number().int().min(0),
    endTick: z.number().int().min(0).nullable(),
    minSelectableTick: z.number().int().min(0),
    maxSelectableTick: z.number().int().min(0),
    startGameTime: FiniteNumberSchema.min(0),
    freezeEndGameTime: FiniteNumberSchema.min(0),
    endGameTime: FiniteNumberSchema.min(0).nullable(),
    tickrate: FiniteNumberSchema.positive(),
    durationSeconds: FiniteNumberSchema.positive(),
  })
  .strict()
  .superRefine((round, context) => {
    if (round.startTick > round.freezeEndTick) {
      context.addIssue({
        code: "custom",
        path: ["freezeEndTick"],
        message: "freeze end must be at or after round start",
      });
    }
    if (round.minSelectableTick !== round.freezeEndTick) {
      context.addIssue({
        code: "custom",
        path: ["minSelectableTick"],
        message: "selectable range must begin at the freeze end boundary",
      });
    }
    if (round.maxSelectableTick < round.minSelectableTick) {
      context.addIssue({
        code: "custom",
        path: ["maxSelectableTick"],
        message: "selectable range must contain at least one tick",
      });
    }
    if (round.endTick !== null && round.maxSelectableTick >= round.endTick) {
      context.addIssue({
        code: "custom",
        path: ["maxSelectableTick"],
        message: "selectable range must stop before the round end outcome",
      });
    }
    if (round.endTick === null && round.endGameTime !== null) {
      context.addIssue({
        code: "custom",
        path: ["endGameTime"],
        message: "an end game time requires a round end",
      });
    }
  });

export const DemoImportMarkerSchema = z
  .object({
    kind: z.enum([
      "round_start",
      "kill",
      "bomb_pickup",
      "bomb_dropped",
      "bomb_planted",
      "bomb_defused",
      "bomb_exploded",
      "round_end",
    ]),
    roundNumber: z.number().int().min(1),
    tick: z.number().int().min(0),
    label: z.string().trim().min(1),
    navigationOnly: z.literal(true),
  })
  .strict();

export const DemoImportInspectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    fileName: z.string().trim().min(1),
    fileSize: z.number().int().positive(),
    source: DemoImportSourceSchema,
    matchLabel: z.string().trim().min(1),
    map: DemoImportMapSchema,
    teams: z.array(DemoImportTeamSchema).length(2),
    players: z.array(DemoImportPlayerIdentitySchema).length(10),
    rounds: z.array(DemoImportRoundSchema).min(1),
    markers: z.array(DemoImportMarkerSchema),
    warnings: z.array(z.string().trim().min(1)),
  })
  .strict()
  .superRefine((inspection, context) => {
    const ids = new Set(inspection.players.map((player) => player.id));
    if (ids.size !== inspection.players.length) {
      context.addIssue({
        code: "custom",
        path: ["players"],
        message: "inspection player identities must be unique",
      });
    }
    for (const side of ["CT", "T"] as const) {
      const count = inspection.players.filter((player) => player.side === side)
        .length;
      if (count !== 5) {
        context.addIssue({
          code: "custom",
          path: ["players"],
          message: `inspection must contain five ${side} player identities`,
        });
      }
    }
    if (inspection.map.renderAvailable && inspection.map.overview === null) {
      context.addIssue({
        code: "custom",
        path: ["map", "renderAvailable"],
        message: "render availability requires map overview metadata",
      });
    }
    for (const marker of inspection.markers) {
      const round = inspection.rounds.find(
        (candidate) => candidate.number === marker.roundNumber,
      );
      if (!round) {
        context.addIssue({
          code: "custom",
          path: ["markers"],
          message: "markers must refer to an inspected round",
        });
        continue;
      }
      if (marker.tick < round.startTick) {
        context.addIssue({
          code: "custom",
          path: ["markers"],
          message: "markers cannot precede their round start",
        });
      }
    }
  });

export const DemoImportSelectionSchema = z
  .object({
    roundNumber: z.number().int().min(1),
    tick: z.number().int().min(0),
  })
  .strict();

export type DemoImportStatus = z.infer<typeof DemoImportStatusSchema>;
export type DemoImportInspection = z.infer<typeof DemoImportInspectionSchema>;
export type DemoImportRound = z.infer<typeof DemoImportRoundSchema>;
export type DemoImportMarker = z.infer<typeof DemoImportMarkerSchema>;
export type DemoImportSelection = z.infer<typeof DemoImportSelectionSchema>;

export function parseDemoImportInspection(
  input: unknown,
): DemoImportInspection {
  return DemoImportInspectionSchema.parse(input);
}

export function getSelectableRound(
  input: DemoImportInspection,
  roundNumber: number,
): DemoImportRound {
  const inspection = parseDemoImportInspection(input);
  const round = inspection.rounds.find(
    (candidate) => candidate.number === roundNumber,
  );
  if (!round) {
    throw new Error(`Round ${roundNumber} is not available in this Demo`);
  }
  return round;
}

export function assertSelectableTick(
  input: DemoImportRound,
  tick: number,
): number {
  const round = DemoImportRoundSchema.parse(input);
  if (!Number.isInteger(tick)) {
    throw new Error("tick must be an integer");
  }
  if (
    tick < round.minSelectableTick ||
    tick > round.maxSelectableTick
  ) {
    throw new Error(
      `tick must be inside the selectable range ${round.minSelectableTick}..${round.maxSelectableTick}`,
    );
  }
  return tick;
}

export function filterMarkersThroughTick(
  input: readonly DemoImportMarker[],
  tick: number,
): DemoImportMarker[] {
  return z
    .array(DemoImportMarkerSchema)
    .parse(input)
    .filter((marker) => marker.tick <= tick);
}

export function formatDemoClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error("demo clock seconds must be finite and non-negative");
  }
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = String(wholeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}
