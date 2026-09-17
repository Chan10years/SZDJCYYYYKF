import { z } from "zod";

const Sha256Schema = z.string().regex(/^[A-F0-9]{64}$/);
const FiniteNumberSchema = z.number().finite();
const SteamIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,19}$/, "SteamID must be a stable numeric identifier");

/**
 * Event families whose actor/victim references are direct competition-scoped
 * evidence. Presence, movement, spawn, inventory, economy and track rows are
 * deliberately not roster evidence.
 */
export const DEMO_IMPORT_DIRECT_COMPETITIVE_EVENT_KINDS = [
  "kills",
  "damage",
  "shots",
  "grenades",
  "blinds",
  "plants",
  "defuses",
] as const;

const CompetitiveEventKindSchema = z.enum(
  DEMO_IMPORT_DIRECT_COMPETITIVE_EVENT_KINDS,
);

/** Product import guard for the browser-local Demo path. */
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
    id: SteamIdSchema,
    name: z.string().trim().min(1),
    slot: z.number().int().min(0),
    /** Parser header's final team; never a round-side or roster decision. */
    finalSide: z.enum(["CT", "T"]).nullable(),
  })
  .strict();

export const DemoImportMatchRosterPlayerSchema = z
  .object({
    id: SteamIdSchema,
    name: z.string().trim().min(1),
    /** Parser slot used only to join this logical identity to parser rows. */
    slot: z.number().int().min(0),
  })
  .strict();

export const DemoImportRoundSidePlayerSchema = z
  .object({
    id: SteamIdSchema,
    name: z.string().trim().min(1),
    /** Parser slot used to prove this side row belongs to the same instance. */
    slot: z.number().int().min(0),
    side: z.enum(["CT", "T"]),
  })
  .strict();

export const DemoImportRoundSideSnapshotSchema = z
  .object({
    roundNumber: z.number().int().min(1),
    freezeEndTick: z.number().int().min(0),
    players: z.array(DemoImportRoundSidePlayerSchema).min(1),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const ids = new Set(snapshot.players.map((player) => player.id));
    const slots = new Set(snapshot.players.map((player) => player.slot));
    if (ids.size !== snapshot.players.length) {
      context.addIssue({
        code: "custom",
        path: ["players"],
        message: "round-side snapshot player identities must be unique",
      });
    }
    if (slots.size !== snapshot.players.length) {
      context.addIssue({
        code: "custom",
        path: ["players"],
        message: "round-side snapshot player slots must be unique",
      });
    }
  });

export const DemoImportCompetitiveParticipationEvidenceSchema = z
  .object({
    id: SteamIdSchema,
    /** Parser slot join key; id remains the logical identity. */
    slot: z.number().int().min(0),
    competitiveEventReferenceCount: z.number().int().nonnegative(),
    competitiveEventKinds: z.array(CompetitiveEventKindSchema),
  })
  .strict()
  .superRefine((evidence, context) => {
    const kinds = new Set(evidence.competitiveEventKinds);
    if (kinds.size !== evidence.competitiveEventKinds.length) {
      context.addIssue({
        code: "custom",
        path: ["competitiveEventKinds"],
        message: "competitive event kinds must be unique",
      });
    }
    if (
      evidence.competitiveEventReferenceCount === 0 &&
      evidence.competitiveEventKinds.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["competitiveEventKinds"],
        message: "event kinds require a positive competitive event reference count",
      });
    }
    if (
      evidence.competitiveEventReferenceCount > 0 &&
      evidence.competitiveEventKinds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["competitiveEventKinds"],
        message: "positive competitive event references require an event kind",
      });
    }
  });

export const DemoImportRosterConfirmationSchema = z
  .object({
    matchRosterIds: z.array(SteamIdSchema).length(10),
  })
  .strict()
  .superRefine((confirmation, context) => {
    if (new Set(confirmation.matchRosterIds).size !== 10) {
      context.addIssue({
        code: "custom",
        path: ["matchRosterIds"],
        message: "confirmed match roster identities must be unique",
      });
    }
  });

export const DemoImportRosterResolutionSchema = z
  .object({
    mode: z.enum(["automatic", "user-confirmed"]),
    matchRosterIds: z.array(SteamIdSchema).length(10),
    unresolvedIdentityIds: z.array(SteamIdSchema),
    confirmedNonRosterIdentityIds: z.array(SteamIdSchema),
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
    tickStep: z.number().int().positive().optional(),
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
    if (round.minSelectableTick < round.freezeEndTick) {
      context.addIssue({
        code: "custom",
        path: ["minSelectableTick"],
        message: "selectable range must begin at or after the freeze end boundary",
      });
    }
    const tickStep = round.tickStep ?? 1;
    if (round.minSelectableTick % tickStep !== 0) {
      context.addIssue({
        code: "custom",
        path: ["minSelectableTick"],
        message: "selectable range must align to the parser tick interval",
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
    schemaVersion: z.literal(3),
    fileName: z.string().trim().min(1),
    fileSize: z.number().int().positive(),
    source: DemoImportSourceSchema,
    matchLabel: z.string().trim().min(1),
    map: DemoImportMapSchema,
    teams: z.array(DemoImportTeamSchema).length(2),
    playerIdentities: z.array(DemoImportPlayerIdentitySchema).min(1),
    competitiveParticipationEvidence: z
      .array(DemoImportCompetitiveParticipationEvidenceSchema)
      .min(1),
    rosterResolution: DemoImportRosterResolutionSchema,
    matchRoster: z.array(DemoImportMatchRosterPlayerSchema).length(10),
    roundSideSnapshots: z.array(DemoImportRoundSideSnapshotSchema).min(1),
    rounds: z.array(DemoImportRoundSchema).min(1),
    markers: z.array(DemoImportMarkerSchema),
    warnings: z.array(z.string().trim().min(1)),
  })
  .strict()
  .superRefine((inspection, context) => {
    const identityById = new Map(
      inspection.playerIdentities.map((player) => [player.id, player]),
    );
    const identityIds = new Set(identityById.keys());
    const identitySlots = new Set(
      inspection.playerIdentities.map((player) => player.slot),
    );
    if (identityIds.size !== inspection.playerIdentities.length) {
      context.addIssue({
        code: "custom",
        path: ["playerIdentities"],
        message: "parser player identities must be unique",
      });
    }
    if (identitySlots.size !== inspection.playerIdentities.length) {
      context.addIssue({
        code: "custom",
        path: ["playerIdentities"],
        message: "parser player slots must be unique",
      });
    }
    const evidenceById = new Map(
      inspection.competitiveParticipationEvidence.map((evidence) => [
        evidence.id,
        evidence,
      ]),
    );
    const evidenceSlots = new Set(
      inspection.competitiveParticipationEvidence.map((evidence) => evidence.slot),
    );
    if (
      evidenceById.size !== inspection.competitiveParticipationEvidence.length ||
      evidenceSlots.size !== inspection.competitiveParticipationEvidence.length ||
      inspection.competitiveParticipationEvidence.length !==
        inspection.playerIdentities.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["competitiveParticipationEvidence"],
        message:
          "competitive participation evidence must contain one unique record for every parser identity",
      });
    }
    for (const evidence of inspection.competitiveParticipationEvidence) {
      const identity = identityById.get(evidence.id);
      if (!identity || identity.slot !== evidence.slot) {
        context.addIssue({
          code: "custom",
          path: ["competitiveParticipationEvidence"],
          message:
            "competitive participation evidence must refer to the same parser identity and slot",
        });
      }
    }
    const rosterIds = new Set(inspection.matchRoster.map((player) => player.id));
    const rosterSlots = new Set(
      inspection.matchRoster.map((player) => player.slot),
    );
    if (rosterIds.size !== inspection.matchRoster.length) {
      context.addIssue({
        code: "custom",
        path: ["matchRoster"],
        message: "match roster player identities must be unique",
      });
    }
    if (rosterSlots.size !== inspection.matchRoster.length) {
      context.addIssue({
        code: "custom",
        path: ["matchRoster"],
        message: "match roster player slots must be unique",
      });
    }
    for (const player of inspection.matchRoster) {
      const identity = identityById.get(player.id);
      if (!identity || identity.slot !== player.slot) {
        context.addIssue({
          code: "custom",
          path: ["matchRoster"],
          message: "match roster players must refer to parser identities",
        });
      }
    }
    const resolutionIds = [
      ...inspection.rosterResolution.matchRosterIds,
      ...inspection.rosterResolution.unresolvedIdentityIds,
      ...inspection.rosterResolution.confirmedNonRosterIdentityIds,
    ];
    const resolutionIdSet = new Set(resolutionIds);
    if (resolutionIdSet.size !== resolutionIds.length) {
      context.addIssue({
        code: "custom",
        path: ["rosterResolution"],
        message: "roster resolution identity sets must be disjoint",
      });
    }
    if (
      resolutionIdSet.size !== identityIds.size ||
      [...identityIds].some((id) => !resolutionIdSet.has(id))
    ) {
      context.addIssue({
        code: "custom",
        path: ["rosterResolution"],
        message: "roster resolution must account for every parser identity",
      });
    }
    if (
      new Set(inspection.rosterResolution.matchRosterIds).size !==
        rosterIds.size ||
      [...rosterIds].some(
        (id) => !inspection.rosterResolution.matchRosterIds.includes(id),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["rosterResolution", "matchRosterIds"],
        message: "roster resolution must point to the canonical match roster",
      });
    }
    for (const side of ["CT", "T"] as const) {
      const team = inspection.teams.find((candidate) => candidate.side === side);
      if (!team || team.playerCount !== 5) {
        context.addIssue({
          code: "custom",
          path: ["teams"],
          message: `match roster must expose five ${side} players`,
        });
      }
    }
    const snapshotRounds = new Set(
      inspection.roundSideSnapshots.map((snapshot) => snapshot.roundNumber),
    );
    if (snapshotRounds.size !== inspection.roundSideSnapshots.length) {
      context.addIssue({
        code: "custom",
        path: ["roundSideSnapshots"],
        message: "inspection may contain only one round-side snapshot per Round",
      });
    }
    for (const snapshot of inspection.roundSideSnapshots) {
      const round = inspection.rounds.find(
        (candidate) => candidate.number === snapshot.roundNumber,
      );
      if (!round) {
        context.addIssue({
          code: "custom",
          path: ["roundSideSnapshots"],
          message: "round-specific side evidence must refer to an inspected Round",
        });
      } else if (round.freezeEndTick !== snapshot.freezeEndTick) {
        context.addIssue({
          code: "custom",
          path: ["roundSideSnapshots"],
          message:
            "round-specific side evidence must use the inspected Round freeze-end tick",
        });
      }
      for (const player of snapshot.players) {
        const identity = identityById.get(player.id);
        if (!identity || identity.slot !== player.slot) {
          context.addIssue({
            code: "custom",
            path: ["roundSideSnapshots"],
            message:
              "round-specific side evidence must refer to the same parser identity and slot",
          });
        }
      }
      const rosterPlayers = snapshot.players.filter((player) =>
        rosterIds.has(player.id),
      );
      const rosterSnapshotIds = new Set(
        rosterPlayers.map((player) => player.id),
      );
      const ctCount = rosterPlayers.filter((player) => player.side === "CT")
        .length;
      const tCount = rosterPlayers.filter((player) => player.side === "T")
        .length;
      if (
        rosterPlayers.length !== 10 ||
        rosterSnapshotIds.size !== 10 ||
        ctCount !== 5 ||
        tCount !== 5 ||
        [...rosterIds].some((id) => !rosterSnapshotIds.has(id))
      ) {
        context.addIssue({
          code: "custom",
          path: ["roundSideSnapshots"],
          message:
            "each round-specific snapshot must provide CT/T evidence for the recovered 10-player roster",
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
export type DemoImportPlayerIdentity = z.infer<
  typeof DemoImportPlayerIdentitySchema
>;
export type DemoImportMatchRosterPlayer = z.infer<
  typeof DemoImportMatchRosterPlayerSchema
>;
export type DemoImportRoundSidePlayer = z.infer<
  typeof DemoImportRoundSidePlayerSchema
>;
export type DemoImportRoundSideSnapshot = z.infer<
  typeof DemoImportRoundSideSnapshotSchema
>;
export type DemoImportCompetitiveParticipationEvidence = z.infer<
  typeof DemoImportCompetitiveParticipationEvidenceSchema
>;
export type DemoImportRosterConfirmation = z.infer<
  typeof DemoImportRosterConfirmationSchema
>;
export type DemoImportRosterResolution = z.infer<
  typeof DemoImportRosterResolutionSchema
>;
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
  const tickStep = round.tickStep ?? 1;
  if (tick % tickStep !== 0) {
    throw new Error(
      `tick must align to the parser sample interval of ${tickStep}`,
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
