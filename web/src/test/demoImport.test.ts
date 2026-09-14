import { describe, expect, it } from "vitest";
import {
  DemoImportInspectionSchema,
  formatDemoClock,
  getSelectableRound,
  filterMarkersThroughTick,
  assertSelectableTick,
  type DemoImportInspection,
} from "@/domain/demoImport";

const inspectionFixture: DemoImportInspection = {
  schemaVersion: 1,
  fileName: "new-match.dem",
  fileSize: 1024,
  source: {
    kind: "local-demo",
    demoSha256: "A".repeat(64),
    parser: "demoparser2",
    parserVersion: "0.42.0",
    demoVersion: "valve_demo_2",
    patchVersion: "14165",
  },
  matchLabel: "Demo server recording",
  map: {
    name: "de_mirage",
    overview: {
      posX: -3230,
      posY: 1713,
      scale: 5,
      radarWidth: 1024,
      radarHeight: 1024,
      source:
        "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_mirage.txt",
    },
    renderAvailable: false,
  },
  teams: [
    { label: "T side", side: "T", playerCount: 5 },
    { label: "CT side", side: "CT", playerCount: 5 },
  ],
  players: [
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `t-${index}`,
      name: `T${index}`,
      side: "T" as const,
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `ct-${index}`,
      name: `CT${index}`,
      side: "CT" as const,
    })),
  ],
  rounds: [
    {
      number: 18,
      parserRound: 17,
      startTick: 1000,
      freezeEndTick: 1128,
      endTick: 9000,
      minSelectableTick: 1128,
      maxSelectableTick: 8999,
      startGameTime: 10,
      freezeEndGameTime: 12,
      endGameTime: 150,
      tickrate: 64,
      durationSeconds: 115,
    },
  ],
  markers: [
    {
      kind: "kill",
      roundNumber: 18,
      tick: 4000,
      label: "击杀事件 · 仅用于定位",
      navigationOnly: true,
    },
    {
      kind: "bomb_planted",
      roundNumber: 18,
      tick: 6000,
      label: "下包事件 · 仅用于定位",
      navigationOnly: true,
    },
  ],
  warnings: ["队伍组织名未从 Demo 原生恢复，以下使用阵营标签"],
};

describe("Gate 4 demo import domain", () => {
  it("validates machine inspection metadata and preserves neutral markers", () => {
    const parsed = DemoImportInspectionSchema.parse(inspectionFixture);

    expect(parsed.rounds[0].minSelectableTick).toBe(1128);
    expect(parsed.rounds[0].maxSelectableTick).toBe(8999);
    expect(parsed.markers.every((marker) => marker.navigationOnly)).toBe(true);
  });

  it("allows the first sampled tick after a non-aligned freeze end", () => {
    const parsed = DemoImportInspectionSchema.parse({
      ...inspectionFixture,
      rounds: [
        {
          ...inspectionFixture.rounds[0],
          freezeEndTick: 1129,
          minSelectableTick: 1132,
          tickStep: 4,
        },
      ],
    });

    expect(parsed.rounds[0].minSelectableTick).toBe(1132);
  });

  it("lets the user choose any tick within the selected round range", () => {
    const round = getSelectableRound(inspectionFixture, 18);

    expect(assertSelectableTick(round, 5555)).toBe(5555);
    expect(() => assertSelectableTick(round, 1127)).toThrow(/selectable range/);
    expect(() => assertSelectableTick(round, 9000)).toThrow(/selectable range/);
  });

  it("rejects a tick that is not on the browser parser sample interval", () => {
    const round = getSelectableRound(
      {
        ...inspectionFixture,
        rounds: [{ ...inspectionFixture.rounds[0], tickStep: 4 }],
      },
      18,
    );

    expect(() => assertSelectableTick(round, 5555)).toThrow(/interval/);
    expect(assertSelectableTick(round, 5556)).toBe(5556);
  });

  it("filters navigation markers at the selected tick before creating the Draft", () => {
    expect(filterMarkersThroughTick(inspectionFixture.markers, 5000)).toEqual([
      inspectionFixture.markers[0],
    ]);
    expect(filterMarkersThroughTick(inspectionFixture.markers, 3000)).toEqual(
      [],
    );
  });

  it("uses a neutral clock formatter without calling a time a recommendation", () => {
    expect(formatDemoClock(42)).toBe("0:42");
    expect(formatDemoClock(0)).toBe("0:00");
    expect(formatDemoClock(75.9)).toBe("1:15");
  });

  it("rejects a range whose upper bound includes round-end outcome", () => {
    expect(() =>
      DemoImportInspectionSchema.parse({
        ...inspectionFixture,
        rounds: [
          {
            ...inspectionFixture.rounds[0],
            maxSelectableTick: inspectionFixture.rounds[0].endTick,
          },
        ],
      }),
    ).toThrow(/round end/);
  });
});
