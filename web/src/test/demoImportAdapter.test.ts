import { describe, expect, it } from "vitest";
import {
  buildDemoImportInspection,
  buildDemoImportNormalizedState,
  type DemoParserInspectionInput,
  type DemoParserSelectionInput,
  type ParserRecord,
} from "@/domain/demoImportAdapter";

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
  playerFirstConnectEvents: players.map((player) => ({
    ...player,
    tick: 1,
    total_rounds_played: 0,
  })),
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
    ).toThrow(/ten unique players/);
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
    ).toThrow(/overview metadata/);
  });
});
