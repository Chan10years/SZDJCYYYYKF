import { describe, expect, it } from "vitest";
import {
  buildDemoImportInspection,
  buildDemoImportNormalizedState,
  type DemoParserInspectionInput,
  type DemoParserSelectionInput,
  type ParserRecord,
} from "@/domain/demoImportAdapter";
import {
  DemoMapMetadataError,
  DemoRosterRecoveryError,
  DemoRosterValidationError,
} from "@/domain/demoImportErrors";
import { buildCurrentStatePreview } from "@/domain/currentStatePreview";
import { ANCIENT_CURRENT_STATE_MAP_RENDER_FRAME } from "@/domain/mapCalibration";

const players = [
  ...Array.from({ length: 5 }, (_, index) => ({
    steamid: `100${index}`,
    name: `T${index}`,
    team: "T",
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    steamid: `200${index}`,
    name: `CT${index}`,
    team: "CT",
  })),
];

const baseInspectionInput: DemoParserInspectionInput = {
  fileName: "new-match.dem",
  fileSize: 2048,
  demoSha256: "B".repeat(64),
  header: {
    server_name: "Unlabeled Demo Server",
    map_name: "de_mirage",
    demo_version_name: "valve_demo_2",
    patch_version: "14165",
  },
  playerIdentities: players.map((player, slot) => ({
    slot,
    steamid: player.steamid,
    name: player.name,
    finalSide: player.team,
  })),
  competitiveParticipationEvidence: players.map((player, slot) => ({
    slot,
    steamid: player.steamid,
    competitiveEventReferenceCount: 1,
    competitiveEventKinds: ["shots"],
  })),
  roundSideSnapshots: [
    {
      roundNumber: 18,
      freezeEndTick: 1128,
      players: players.map((player, slot) => ({
        slot,
        steamid: player.steamid,
        name: player.name,
        side: player.team,
      })),
    },
    {
      roundNumber: 19,
      freezeEndTick: 10128,
      players: players.map((player, slot) => ({
        slot,
        steamid: player.steamid,
        name: player.name,
        side: player.team === "CT" ? "T" : "CT",
      })),
    },
  ],
  roundStartEvents: [
    { round: 18, tick: 1000, game_time: 100, total_rounds_played: 17 },
    { round: 19, tick: 10000, game_time: 250, total_rounds_played: 18 },
  ],
  roundFreezeEndEvents: [
    { tick: 1128, game_time: 102, total_rounds_played: 17 },
    { tick: 10128, game_time: 252, total_rounds_played: 18 },
  ],
  roundEndEvents: [
    { round: 17, tick: 900, game_time: 98, winner: "T", total_rounds_played: 16 },
    { round: 18, tick: 9000, game_time: 240, winner: "CT", total_rounds_played: 17 },
    { round: 19, tick: 18000, game_time: 390, winner: "T", total_rounds_played: 18 },
  ],
  killEvents: [
    { tick: 4000, game_time: 147, total_rounds_played: 17 },
    { tick: 7000, game_time: 194, total_rounds_played: 17 },
  ],
  bombEvents: [
    {
      event_name: "bomb_planted",
      tick: 7000,
      game_time: 194,
      total_rounds_played: 17,
      user_steamid: "1000",
      user_name: "T0",
    },
  ],
};

function selectionInput(
  overrides: Partial<DemoParserSelectionInput> = {},
): DemoParserSelectionInput {
  return {
    ...baseInspectionInput,
    roundNumber: 18,
    tick: 5555,
    tickRows: players.map((player, index) => ({
      X: index * 20,
      Y: index * -10,
      Z: 0,
      steamid: player.steamid,
      name: player.name,
      slot: index,
      m_iTeamNum: player.team === "CT" ? 3 : 2,
      health: index === 0 ? 76 : 100,
      is_alive: index !== 9,
      active_weapon_name: index === 0 ? "AK-47" : "Knife",
      last_place_name: index === 0 ? "Mid" : "TSpawn",
      game_time: 169,
      total_rounds_played: 17,
      tick: 5555,
    })) as ParserRecord[],
    ...overrides,
  };
}

describe("demoparser2 output adapter", () => {
  it("builds every Round range without reducing the user to marker nodes", () => {
    const inspection = buildDemoImportInspection(baseInspectionInput);

    expect(inspection.rounds.map((round) => round.number)).toEqual([18, 19]);
    expect(inspection.rounds[0].minSelectableTick).toBe(1128);
    expect(inspection.rounds[0].maxSelectableTick).toBe(8999);
    expect(inspection.markers.map((marker) => marker.tick)).toEqual([4000, 7000, 7000]);
    expect(inspection.markers.every((marker) => marker.navigationOnly)).toBe(true);
    expect(inspection.warnings).toContain(
      "队伍组织名未从 Demo 原生恢复，以下使用阵营标签",
    );
    expect(
      inspection.roundSideSnapshots.map(
        (snapshot) => snapshot.players.filter((player) => player.side === "CT").length,
      ),
    ).toEqual([5, 5]);
  });

  it("normalizes the exact selected tick and excludes later bomb state", () => {
    const state = buildDemoImportNormalizedState(selectionInput());

    expect(state.round.number).toBe(18);
    expect(state.tick).toBe(5555);
    expect(state.time.display).toBe("0:48");
    expect(state.time.semantics).toBe("round_clock_remaining");
    expect(state.bomb.status).toBe("unavailable");
    expect(state.players).toHaveLength(10);
    expect(state.players[0]).toMatchObject({
      id: "1000",
      side: "T",
      weapon: "AK-47",
      place: "Mid",
    });
    expect(state.source.selectionEvidence).toContain("exact tick 5555");
    expect(state.extraction.unavailableFields).toContain("已选 tick 之后的比赛事件");
  });

  it("uses the freeze-end roster snapshot when dead players omit m_iTeamNum", () => {
    const exactRows = (selectionInput().tickRows as ParserRecord[]).map((row) => ({
      ...row,
      m_iTeamNum: null,
      is_alive: false,
      health: 0,
    }));
    const state = buildDemoImportNormalizedState(
      selectionInput({
        tickRows: exactRows,
        sideRows: selectionInput().tickRows,
      }),
    );

    expect(state.players.filter((player) => player.side === "T")).toHaveLength(5);
    expect(state.players.filter((player) => player.side === "CT")).toHaveLength(5);
    expect(state.players.every((player) => player.alive === false)).toBe(true);
  });

  it("folds a bomb event only when it is at or before the selected tick", () => {
    const defaultRows = selectionInput().tickRows as ParserRecord[];
    const state = buildDemoImportNormalizedState(
      selectionInput({
        tick: 7500,
        tickRows: defaultRows.map((row) => ({
          ...row,
          tick: 7500,
          game_time: 201,
        })),
      }),
    );

    expect(state.bomb.status).toBe("planted");
    expect(state.bomb.derivedFrom).toContain("through tick 7500");
    expect(state.time.semantics).toBe("post_plant_elapsed");
  });

  it("does not fold a bomb event across the next sampled tick boundary", () => {
    const state = buildDemoImportNormalizedState(
      selectionInput({
        tick: 5555,
        bombEvents: [
          {
            event_name: "bomb_planted",
            tick: 5556,
            game_time: 169.015625,
          },
        ],
      }),
    );

    expect(state.bomb.status).toBe("unavailable");
    expect(state.source.selectionEvidence).toContain("exact tick 5555");
  });

  it("rejects player rows whose parser tick is after the selected tick", () => {
    const futureRows = (selectionInput().tickRows as ParserRecord[]).map((row) => ({
      ...row,
      tick: 5556,
    }));

    expect(() =>
      buildDemoImportNormalizedState(
        selectionInput({ tick: 5555, tickRows: futureRows }),
      ),
    ).toThrow(/future|selected tick/i);
  });

  it("keeps legal parser events when round fields are absent", () => {
    const input: DemoParserInspectionInput = {
      ...baseInspectionInput,
      roundFreezeEndEvents: baseInspectionInput.roundFreezeEndEvents.map((event) => {
        const record = event as ParserRecord;
        return { tick: record.tick, game_time: record.game_time };
      }),
      killEvents: [{ tick: 4000, game_time: 147 }],
      bombEvents: [
        {
          event_name: "bomb_planted",
          tick: 7000,
          game_time: 194,
          user_steamid: "1000",
          user_name: "T0",
        },
      ],
    };

    const inspection = buildDemoImportInspection(input);

    expect(inspection.rounds[0]).toMatchObject({
      number: 18,
      freezeEndTick: 1128,
    });
    expect(inspection.markers.map((marker) => marker.tick)).toEqual([
      4000,
      7000,
    ]);

    const state = buildDemoImportNormalizedState({
      ...input,
      roundNumber: 18,
      tick: 7500,
      tickRows: (selectionInput().tickRows as ParserRecord[]).map((row) => ({
        ...row,
        tick: 7500,
        game_time: 201,
      })),
    });
    expect(state.bomb.status).toBe("planted");
  });

  it("deduplicates temporal Round boundaries before assigning freezes and ends", () => {
    const input: DemoParserInspectionInput = {
      ...baseInspectionInput,
      roundSideSnapshots: (baseInspectionInput.roundSideSnapshots as ParserRecord[]).map(
        (snapshot, index) => ({
          ...snapshot,
          roundNumber: 14 + index,
          freezeEndTick: index === 0 ? 4580 : 11920,
        }),
      ),
      roundStartEvents: [
        { tick: 5, game_time: 5 / 64, round: 14, total_rounds_played: 13 },
        { tick: 1, game_time: 1 / 64, round: 14, total_rounds_played: 13 },
        { tick: 10640, game_time: 10640 / 64, round: 15, total_rounds_played: 14 },
      ],
      roundFreezeEndEvents: [
        { tick: 11920, game_time: 11920 / 64, total_rounds_played: 14 },
        { tick: 4580, game_time: 4580 / 64, total_rounds_played: 13 },
      ],
      roundEndEvents: [
        { tick: 16432, game_time: 16432 / 64, round: 16, winner: "CT" },
        { tick: 5, game_time: 5 / 64, round: 14, winner: null },
        { tick: 10320, game_time: 10320 / 64, round: 15, winner: "T" },
      ],
    };

    const rounds = buildDemoImportInspection(input).rounds;

    expect(rounds.map((round) => round.number)).toEqual([14, 15]);
    expect(rounds[0]).toMatchObject({
      startTick: 5,
      freezeEndTick: 4580,
      endTick: 10320,
    });
    expect(rounds[1]).toMatchObject({
      startTick: 10640,
      freezeEndTick: 11920,
      endTick: 16432,
    });
  });

  it("anchors round clock and post-plant copy to freeze end", () => {
    const state = buildDemoImportNormalizedState(
      selectionInput({
        tick: 1800,
        tickRows: (selectionInput().tickRows as ParserRecord[]).map((row) => ({
          ...row,
          tick: 1800,
          game_time: 112,
        })),
        bombEvents: [
          {
            event_name: "bomb_planted",
            tick: 1500,
            game_time: 110,
          },
        ],
      }),
    );

    expect(state.time.roundStartTick).toBe(1128);
    expect(state.time.roundStartGameTime).toBe(102);
    expect(state.time.display).toBe("下包后 0:02");
    expect(state.time.elapsedSeconds).toBe(10);
  });

  it("rejects an exact tick that cannot provide ten stable players", () => {
    expect(() =>
      buildDemoImportNormalizedState(
        selectionInput({ tickRows: selectionInput().tickRows.slice(0, 9) }),
      ),
    ).toThrow(/recovered 5v5 match roster|10 unique players/);
  });

  it("rejects an exact-tick row joined to the wrong parser slot", () => {
    const rowsWithParserSlots = (selectionInput().tickRows as ParserRecord[]).map(
      (row, index) => ({
        ...row,
        slot: index === 0 ? 99 : index,
      }),
    );

    expect(() =>
      buildDemoImportNormalizedState(
        selectionInput({ tickRows: rowsWithParserSlots }),
      ),
    ).toThrow(DemoRosterValidationError);
  });

  it("recovers the match roster from round-side evidence instead of final header sides", () => {
    const playerIdentities = players.map((player, slot) => ({
      slot,
      id: player.steamid,
      name: player.name,
      // Deliberately make the parser header side disagree with the round side.
      finalSide: player.team === "CT" ? "T" : "CT",
    }));
    const roundSidePlayers = players.map((player, slot) => ({
      slot,
      id: player.steamid,
      name: player.name,
      side: player.team,
    }));
    const input = {
      ...baseInspectionInput,
      playerIdentities,
      roundSideSnapshots: baseInspectionInput.roundSideSnapshots.map((snapshot) => ({
        ...(snapshot as ParserRecord),
        players: roundSidePlayers,
      })),
    } as DemoParserInspectionInput;

    const inspection = buildDemoImportInspection(input);

    expect(inspection.playerIdentities).toHaveLength(10);
    expect(inspection.matchRoster).toHaveLength(10);
    expect(inspection.matchRoster.map((player) => player.id)).toEqual(
      players.map((player) => player.steamid),
    );
    expect(inspection.roundSideSnapshots[0].players.filter((player) => player.side === "CT")).toHaveLength(5);
  });

  it("uses the selected round side snapshot when exact-tick rows omit team", () => {
    const input = {
      ...selectionInput(),
      playerIdentities: players.map((player, slot) => ({
        slot,
        steamid: player.steamid,
        name: player.name,
        finalSide: player.team === "CT" ? "T" : "CT",
      })),
      tickRows: (selectionInput().tickRows as ParserRecord[]).map((row) => ({
        ...row,
        m_iTeamNum: null,
      })),
      sideRows: [],
    } as DemoParserSelectionInput;

    const state = buildDemoImportNormalizedState(input);

    expect(state.players.filter((player) => player.side === "CT")).toHaveLength(5);
    expect(state.players.filter((player) => player.side === "T")).toHaveLength(5);
  });

  it("does not let provided side rows override the canonical selected round snapshot", () => {
    const tickRows = (selectionInput().tickRows as ParserRecord[]).map((row) => ({
      ...row,
      m_iTeamNum: null,
    }));
    const conflictingSideRows = (selectionInput().tickRows as ParserRecord[]).map(
      (row) => ({
        ...row,
        m_iTeamNum: row.m_iTeamNum === 3 ? 2 : 3,
      }),
    );

    expect(() =>
      buildDemoImportNormalizedState(
        selectionInput({ tickRows, sideRows: conflictingSideRows }),
      ),
    ).toThrow(/canonical selected Round snapshot/);
  });

  it("rejects provided side evidence joined to the wrong parser slot", () => {
    const sideRowsWithWrongSlot = (selectionInput().sideRows ??
      selectionInput().tickRows) as ParserRecord[];
    const malformedSideRows = sideRowsWithWrongSlot.map((row, index) => ({
      ...row,
      slot: index === 0 ? 99 : index,
    }));

    expect(() =>
      buildDemoImportNormalizedState(
        selectionInput({ sideRows: malformedSideRows }),
      ),
    ).toThrow(DemoRosterValidationError);
  });

  it("does not use an exact-tick team field without selected-round evidence", () => {
    expect(() =>
      buildDemoImportNormalizedState({
        ...selectionInput(),
        roundNumber: 19,
        tick: 12000,
        tickRows: selectionInput().tickRows,
        sideRows: [],
        roundSideSnapshots: [baseInspectionInput.roundSideSnapshots[0]],
      } as DemoParserSelectionInput),
    ).toThrow(/round-specific CT\/T side evidence/);
  });

  it("fails closed when a round loses a recovered roster player", () => {
    const firstSnapshot = baseInspectionInput.roundSideSnapshots[0] as ParserRecord;
    const firstPlayers = firstSnapshot.players as ParserRecord[];
    const extraIdentity = {
      slot: 10,
      steamid: "3000",
      name: "Extra Player",
      finalSide: "T",
    };
    const secondPlayers = firstPlayers.map((player, index) =>
      index === 0
        ? {
            ...player,
            slot: extraIdentity.slot,
            steamid: extraIdentity.steamid,
            name: extraIdentity.name,
          }
        : player,
    );

    expect(() =>
      buildDemoImportInspection(
        {
          ...baseInspectionInput,
          playerIdentities: [
            ...baseInspectionInput.playerIdentities,
            extraIdentity,
          ],
          competitiveParticipationEvidence: [
            ...baseInspectionInput.competitiveParticipationEvidence,
            {
              slot: extraIdentity.slot,
              steamid: extraIdentity.steamid,
              competitiveEventReferenceCount: 0,
              competitiveEventKinds: [],
            },
          ],
          roundSideSnapshots: [
            firstSnapshot,
            { ...firstSnapshot, roundNumber: 19, players: secondPlayers },
          ],
        } as DemoParserInspectionInput,
        {
          rosterConfirmation: {
            matchRosterIds: players.map((player) => player.steamid),
          },
        },
      ),
    ).toThrow(/complete|完整/);
  });

  it("fails closed when an advertised round has no side snapshot", () => {
    expect(() =>
      buildDemoImportInspection({
        ...baseInspectionInput,
        roundSideSnapshots: [baseInspectionInput.roundSideSnapshots[0]],
      }),
    ).toThrow(DemoRosterValidationError);
  });

  it("fails closed when parser evidence only describes a non-5v5 participant set", () => {
    const participantCount = 12;
    const participantIdentities = Array.from({ length: participantCount }, (_, slot) => ({
      slot,
      id: String(4000 + slot),
      name: `Participant ${slot}`,
      finalSide: slot < 6 ? "CT" : "T",
    }));
    const roundSidePlayers = participantIdentities.map((player, slot) => ({
      ...player,
      side: slot < 6 ? "CT" : "T",
    }));

    expect(() =>
      buildDemoImportInspection({
        ...baseInspectionInput,
        playerIdentities: participantIdentities,
        competitiveParticipationEvidence: participantIdentities.map((player) => ({
          slot: player.slot,
          steamid: player.id,
          competitiveEventReferenceCount: 1,
          competitiveEventKinds: ["shots"],
        })),
        roundSideSnapshots: [
          {
            roundNumber: 18,
            freezeEndTick: 1128,
            players: roundSidePlayers,
          },
        ],
      } as DemoParserInspectionInput),
    ).toThrow(/match roster|5v5|five CT/i);
  });

  it("rejects non-competitive event families as direct roster evidence", () => {
    const input = {
      ...baseInspectionInput,
      competitiveParticipationEvidence:
        baseInspectionInput.competitiveParticipationEvidence.map((evidence) => ({
          ...(evidence as ParserRecord),
          competitiveEventReferenceCount: 12,
          competitiveEventKinds: ["economy"],
        })),
    } as DemoParserInspectionInput;

    expect(() => buildDemoImportInspection(input)).toThrow(
      /outside the direct competitive evidence contract|直接.*证据/i,
    );
  });

  it("rejects malformed negative direct evidence counts", () => {
    const input = {
      ...baseInspectionInput,
      competitiveParticipationEvidence:
        baseInspectionInput.competitiveParticipationEvidence.map((evidence, index) =>
          index === 0
            ? {
                ...(evidence as ParserRecord),
                competitiveEventReferenceCount: -1,
                competitiveEventKinds: [],
              }
            : evidence,
        ),
    } as DemoParserInspectionInput;

    expect(() => buildDemoImportInspection(input)).toThrow(/non-negative|非负/i);
  });

  it("does not crop an eleventh direct-evidence identity to an arbitrary ten", () => {
    const extraIdentity = {
      slot: 10,
      steamid: "3012",
      name: "Extra Direct Identity",
      finalSide: "T" as const,
    };

    expect(() =>
      buildDemoImportInspection({
        ...baseInspectionInput,
        playerIdentities: [
          ...baseInspectionInput.playerIdentities,
          extraIdentity,
        ],
        competitiveParticipationEvidence: [
          ...baseInspectionInput.competitiveParticipationEvidence,
          {
            slot: extraIdentity.slot,
            steamid: extraIdentity.steamid,
            competitiveEventReferenceCount: 1,
            competitiveEventKinds: ["shots"],
          },
        ],
      } as DemoParserInspectionInput),
    ).toThrow(/confirmed 11|无法.*11|roster/i);
  });

  it("does not depend on identity array order or contiguous slot numbers", () => {
    const remappedSlots = [42, 7, 100, 3, 55, 9, 70, 11, 88, 15];
    const slotById = new Map(
      players.map((player, index) => [player.steamid, remappedSlots[index]]),
    );
    const remapRecord = (record: ParserRecord) => ({
      ...record,
      slot: slotById.get(String(record.steamid)),
    });
    const input = {
      ...baseInspectionInput,
      playerIdentities: (baseInspectionInput.playerIdentities as ParserRecord[])
        .map(remapRecord)
        .reverse(),
      competitiveParticipationEvidence: (
        baseInspectionInput.competitiveParticipationEvidence as ParserRecord[]
      )
        .map(remapRecord)
        .reverse(),
      roundSideSnapshots: (
        baseInspectionInput.roundSideSnapshots as ParserRecord[]
      ).map((snapshot) => ({
        ...snapshot,
        players: (snapshot.players as ParserRecord[])
          .map(remapRecord)
          .reverse(),
      })),
    } as DemoParserInspectionInput;

    const inspection = buildDemoImportInspection(input);

    expect(new Set(inspection.matchRoster.map((player) => player.id))).toEqual(
      new Set(players.map((player) => player.steamid)),
    );
    expect(inspection.matchRoster.map((player) => player.slot)).toEqual(
      [...remappedSlots].sort((a, b) => a - b),
    );
  });

  it("fails closed when a halftime snapshot no longer supports five CT and five T", () => {
    const secondSnapshot = baseInspectionInput.roundSideSnapshots[1] as ParserRecord;
    const secondPlayers = (secondSnapshot.players as ParserRecord[]).map(
      (player, index) =>
        index === 5
          ? { ...player, side: "CT" }
          : player,
    );

    expect(() =>
      buildDemoImportInspection({
        ...baseInspectionInput,
        roundSideSnapshots: [
          baseInspectionInput.roundSideSnapshots[0],
          { ...secondSnapshot, players: secondPlayers },
        ],
      } as DemoParserInspectionInput),
    ).toThrow(DemoRosterValidationError);
  });

  it("requires explicit confirmation when parser identities include unresolved participants", () => {
    const extras = [
      {
        slot: 10,
        id: "3010",
        name: "Spectator",
        finalSide: "Spectator",
        side: "T" as const,
      },
      {
        slot: 11,
        id: "3011",
        name: "Observer",
        finalSide: "Observer",
        side: "CT" as const,
      },
    ];
    const input = {
      ...baseInspectionInput,
      playerIdentities: [
        ...baseInspectionInput.playerIdentities,
        ...extras.map((extra) => ({
          slot: extra.slot,
          id: extra.id,
          name: extra.name,
          finalSide: extra.finalSide,
          steamid: extra.id,
        })),
      ],
      roundSideSnapshots: baseInspectionInput.roundSideSnapshots.map((snapshot) => ({
        ...(snapshot as ParserRecord),
        players: [
          ...((snapshot as ParserRecord).players as ParserRecord[]),
          ...extras.map((extra) => ({
            slot: extra.slot,
            steamid: extra.id,
            name: extra.name,
            side: extra.side,
          })),
        ],
      })),
      competitiveParticipationEvidence: [
        ...players.map((player, slot) => ({
          slot,
          steamid: player.steamid,
          competitiveEventReferenceCount: 1,
          competitiveEventKinds: ["shots"],
        })),
        ...extras.map((extra) => ({
          slot: extra.slot,
          steamid: extra.id,
          competitiveEventReferenceCount: 0,
          competitiveEventKinds: [],
        })),
      ],
    } as DemoParserInspectionInput & {
      competitiveParticipationEvidence: readonly unknown[];
    };

    try {
      buildDemoImportInspection(input);
      throw new Error("expected explicit roster confirmation");
    } catch (error) {
      expect(error).toBeInstanceOf(DemoRosterRecoveryError);
      expect(error).toMatchObject({
        canConfirm: true,
        candidateIdentityIds: players.map((player) => player.steamid),
        unresolvedIdentityIds: ["3010", "3011"],
      });
      expect((error as DemoRosterRecoveryError).identityOptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: players[0].steamid,
            name: players[0].name,
            slot: 0,
            directEvidenceKinds: ["shots"],
          }),
          expect.objectContaining({
            id: "3010",
            name: "Spectator",
            slot: 10,
            directEvidenceKinds: [],
          }),
        ]),
      );
    }
  });

  it("requires confirmation when a direct-looking extra competes with a quiet real identity", () => {
    const extra = {
      slot: 10,
      steamid: "3012",
      name: "Extra Direct Identity",
      finalSide: "T" as const,
      side: "T" as const,
    };
    const input = {
      ...baseInspectionInput,
      playerIdentities: [
        ...baseInspectionInput.playerIdentities,
        {
          slot: extra.slot,
          steamid: extra.steamid,
          name: extra.name,
          finalSide: extra.finalSide,
        },
      ],
      competitiveParticipationEvidence: [
        ...(baseInspectionInput.competitiveParticipationEvidence as ParserRecord[]).map(
          (evidence, index) =>
            index === 0
              ? {
                  ...evidence,
                  competitiveEventReferenceCount: 0,
                  competitiveEventKinds: [],
                }
              : evidence,
        ),
        {
          slot: extra.slot,
          steamid: extra.steamid,
          competitiveEventReferenceCount: 1,
          competitiveEventKinds: ["shots"],
        },
      ],
      roundSideSnapshots: baseInspectionInput.roundSideSnapshots.map((snapshot) => ({
        ...(snapshot as ParserRecord),
        players: [
          ...((snapshot as ParserRecord).players as ParserRecord[]),
          {
            slot: extra.slot,
            steamid: extra.steamid,
            name: extra.name,
            side: extra.side,
          },
        ],
      })),
    } as DemoParserInspectionInput;

    expect(() => buildDemoImportInspection(input)).toThrow(DemoRosterRecoveryError);
    try {
      buildDemoImportInspection(input);
    } catch (error) {
      expect(error).toMatchObject({
        canConfirm: true,
        candidateIdentityIds: [
          ...players.slice(1).map((player) => player.steamid),
          extra.steamid,
        ],
        unresolvedIdentityIds: [players[0].steamid],
      });
    }
  });

  it("accepts an explicit roster confirmation when automatic evidence remains unresolved", () => {
    const extras = [
      { slot: 10, id: "3010", name: "Spectator", side: "T" as const },
      { slot: 11, id: "3011", name: "Observer", side: "CT" as const },
    ];
    const input = {
      ...baseInspectionInput,
      playerIdentities: [
        ...baseInspectionInput.playerIdentities,
        ...extras.map((extra) => ({
          slot: extra.slot,
          steamid: extra.id,
          name: extra.name,
          finalSide: extra.side,
        })),
      ],
      competitiveParticipationEvidence: [
        ...players.map((player, slot) => ({
          slot,
          steamid: player.steamid,
          competitiveEventReferenceCount: slot === 0 ? 0 : 1,
          competitiveEventKinds: slot === 0 ? [] : ["shots"],
        })),
        ...extras.map((extra) => ({
          slot: extra.slot,
          steamid: extra.id,
          competitiveEventReferenceCount: 0,
          competitiveEventKinds: [],
        })),
      ],
      roundSideSnapshots: baseInspectionInput.roundSideSnapshots.map((snapshot) => ({
        ...(snapshot as ParserRecord),
        players: [
          ...((snapshot as ParserRecord).players as ParserRecord[]),
          ...extras.map((extra) => ({
            slot: extra.slot,
            steamid: extra.id,
            name: extra.name,
            side: extra.side,
          })),
        ],
      })),
    } as DemoParserInspectionInput;

    const inspection = buildDemoImportInspection(input, {
      rosterConfirmation: {
        matchRosterIds: players.map((player) => player.steamid),
      },
    });

    expect(inspection.matchRoster.map((player) => player.id)).toEqual(
      players.map((player) => player.steamid),
    );
    expect(
      (inspection as unknown as {
        rosterResolution: {
          mode: string;
          unresolvedIdentityIds: string[];
          confirmedNonRosterIdentityIds: string[];
        };
      }).rosterResolution,
    ).toMatchObject({
      mode: "user-confirmed",
      unresolvedIdentityIds: [],
      confirmedNonRosterIdentityIds: ["3010", "3011"],
    });
    expect(inspection.playerIdentities).toHaveLength(12);
    expect(
      inspection.competitiveParticipationEvidence.find(
        (evidence) => evidence.id === players[0].steamid,
      ),
    ).toMatchObject({ competitiveEventReferenceCount: 0, competitiveEventKinds: [] });
    expect(inspection.roundSideSnapshots[0].players).toHaveLength(12);

    const state = buildDemoImportNormalizedState(
      {
        ...input,
        roundNumber: 18,
        tick: 5555,
        tickRows: players.map((player, index) => ({
          X: index * 20,
          Y: index * -10,
          Z: 0,
          steamid: player.steamid,
          name: player.name,
          slot: index,
          m_iTeamNum: null,
          health: 100,
          is_alive: true,
          active_weapon_name: "AK-47",
          last_place_name: "Mid",
          game_time: 169,
          tick: 5555,
        })),
        sideRows: [],
      } as DemoParserSelectionInput,
      {
        rosterConfirmation: {
          matchRosterIds: players.map((player) => player.steamid),
        },
      },
    );
    expect(state.players).toHaveLength(10);
    expect(state.players.map((player) => player.id)).toEqual(
      players.map((player) => player.steamid),
    );
  });

  it("exposes unresolved identities when automatic roster recovery cannot choose ten players", () => {
    const input = {
      ...baseInspectionInput,
      competitiveParticipationEvidence: baseInspectionInput.competitiveParticipationEvidence.map(
        (evidence) => ({
          ...(evidence as ParserRecord),
          competitiveEventReferenceCount: 0,
          competitiveEventKinds: [],
        }),
      ),
    } as DemoParserInspectionInput;

    try {
      buildDemoImportInspection(input);
      throw new Error("expected automatic roster recovery to remain unresolved");
    } catch (error) {
      expect(error).toBeInstanceOf(DemoRosterRecoveryError);
      expect((error as DemoRosterRecoveryError).unresolvedIdentityIds).toEqual(
        players.map((player) => player.steamid),
      );
      expect((error as DemoRosterRecoveryError).candidateIdentityIds).toEqual([]);
    }
  });

  it("fails closed when one real identity has no direct competitive evidence", () => {
    const input = {
      ...baseInspectionInput,
      competitiveParticipationEvidence: baseInspectionInput.competitiveParticipationEvidence.map(
        (evidence, index) =>
          index === 0
            ? {
                ...(evidence as ParserRecord),
                competitiveEventReferenceCount: 0,
                competitiveEventKinds: [],
              }
            : evidence,
      ),
    } as DemoParserInspectionInput;

    expect(() => buildDemoImportInspection(input)).toThrow(
      /cannot|无法.*10.*roster/i,
    );
  });

  it("rejects a duplicate or unknown user-confirmed roster identity", () => {
    const duplicateRosterIds = [
      ...players.slice(0, 9).map((player) => player.steamid),
      players[0].steamid,
    ];
    const unknownRosterIds = [
      ...players.slice(0, 9).map((player) => player.steamid),
      "3999",
    ];

    expect(() =>
      buildDemoImportInspection(baseInspectionInput, {
        rosterConfirmation: { matchRosterIds: duplicateRosterIds },
      }),
    ).toThrow(DemoRosterValidationError);
    expect(() =>
      buildDemoImportInspection(baseInspectionInput, {
        rosterConfirmation: { matchRosterIds: unknownRosterIds },
      }),
    ).toThrow(DemoRosterValidationError);
  });

  it("does not merge duplicate logical SteamIDs across parser instances", () => {
    const duplicateIdentity = {
      slot: 10,
      steamid: players[0].steamid,
      name: "Reconnected Player",
      finalSide: "T" as const,
    };

    expect(() =>
      buildDemoImportInspection({
        ...baseInspectionInput,
        playerIdentities: [
          ...baseInspectionInput.playerIdentities,
          duplicateIdentity,
        ],
      } as DemoParserInspectionInput),
    ).toThrow(/duplicate logical SteamID|reconnect/i);
  });

  it("fails closed when a parser slot is reused without connection evidence", () => {
    const reusedSlotIdentity = {
      slot: 0,
      steamid: "3001",
      name: "Reused Slot Player",
      finalSide: "T" as const,
    };

    expect(() =>
      buildDemoImportInspection({
        ...baseInspectionInput,
        playerIdentities: [
          ...baseInspectionInput.playerIdentities,
          reusedSlotIdentity,
        ],
      } as DemoParserInspectionInput),
    ).toThrow(/slot 0.*reused|connection epoch/i);
  });

  it("fails closed for missing or non-stable SteamID values", () => {
    const invalidIdentity = {
      ...(baseInspectionInput.playerIdentities[0] as ParserRecord),
      steamid: "BOT",
    };

    expect(() =>
      buildDemoImportInspection({
        ...baseInspectionInput,
        playerIdentities: [
          invalidIdentity,
          ...baseInspectionInput.playerIdentities.slice(1),
        ],
      } as DemoParserInspectionInput),
    ).toThrow(/stable numeric SteamID|SteamID/i);

    const numericIdentity = {
      ...(baseInspectionInput.playerIdentities[0] as ParserRecord),
      steamid: 76561198000000001,
    };
    expect(() =>
      buildDemoImportInspection({
        ...baseInspectionInput,
        playerIdentities: [
          numericIdentity,
          ...baseInspectionInput.playerIdentities.slice(1),
        ],
      } as DemoParserInspectionInput),
    ).toThrow(/string.*precision|SteamID/i);
  });

  it("rejects a confirmed roster identity that is absent from the round snapshot", () => {
    const missingRoundIdentity = {
      slot: 10,
      steamid: "3002",
      name: "Missing From Round",
      finalSide: "T" as const,
    };
    const confirmedRosterIds = [
      ...players.slice(0, 9).map((player) => player.steamid),
      missingRoundIdentity.steamid,
    ];

    expect(() =>
      buildDemoImportInspection(
        {
          ...baseInspectionInput,
          playerIdentities: [
            ...baseInspectionInput.playerIdentities,
            missingRoundIdentity,
          ],
          competitiveParticipationEvidence: [
            ...baseInspectionInput.competitiveParticipationEvidence,
            {
              slot: missingRoundIdentity.slot,
              steamid: missingRoundIdentity.steamid,
              competitiveEventReferenceCount: 0,
              competitiveEventKinds: [],
            },
          ],
        } as DemoParserInspectionInput,
        { rosterConfirmation: { matchRosterIds: confirmedRosterIds } },
      ),
    ).toThrow(DemoRosterValidationError);
  });

  it("does not create a normalized state for a map without an explicit overview", () => {
    expect(() =>
      buildDemoImportNormalizedState(
        selectionInput({
          header: {
            ...(baseInspectionInput.header as ParserRecord),
            map_name: "de_unknown",
          },
        }),
      ),
    ).toThrow(DemoMapMetadataError);
  });

  it("builds an Ancient normalized state with the published overview metadata", () => {
    const state = buildDemoImportNormalizedState(
      selectionInput({
        header: {
          ...(baseInspectionInput.header as ParserRecord),
          map_name: "de_ancient",
        },
      }),
    );

    expect(state.map).toMatchObject({
      name: "de_ancient",
      asset: null,
      overview: {
        posX: -2953,
        posY: 2164,
        scale: 5,
        radarWidth: 1024,
        radarHeight: 1024,
        source:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_ancient.txt",
      },
    });

    expect(state.map.render).toBeUndefined();
    const preview = buildCurrentStatePreview({
      ...state,
      map: {
        ...state.map,
        asset: ANCIENT_CURRENT_STATE_MAP_RENDER_FRAME.asset,
        render: ANCIENT_CURRENT_STATE_MAP_RENDER_FRAME,
      },
    });
    expect(preview.asset).toBe("/maps/Ancient_CurrentStateBase.png");
    expect(preview.coordinateFrame).toBe("de_ancient-radar-overview");
    expect(preview.players[0].imagePosition).toEqual({
      x: 590.6,
      y: 432.8,
    });
    expect(preview.players[1].imagePosition).toEqual({
      x: 594.6,
      y: 434.8,
    });
  });
});
