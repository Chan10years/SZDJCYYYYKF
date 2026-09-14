import { describe, expect, it, vi } from "vitest";
import {
  collectDemoParserInput,
  collectDemoParserSelectionInput,
  DEMO_IMPORT_EVENT_NAMES,
  DEMO_IMPORT_TICK_PROPS,
  type DemoParserBindings,
} from "@/lib/demoParserRuntime";

const parserEvents = [
  { event_name: "player_first_connect", steamid: "1", name: "T1", team: "T", tick: 1, game_time: 10, total_rounds_played: 0 },
  { event_name: "round_start", round: 1, tick: 100, game_time: 20, total_rounds_played: 0, is_warmup_period: false },
  { event_name: "round_freeze_end", tick: 228, game_time: 22, total_rounds_played: 0, is_warmup_period: false },
  { event_name: "round_end", round: 1, tick: 900, game_time: 35, total_rounds_played: 0, is_warmup_period: false, winner: "T" },
  { event_name: "player_death", tick: 500, game_time: 28, total_rounds_played: 0 },
];

function makeParser(): DemoParserBindings {
  return {
    parseHeader: vi.fn(() => new Map([
      ["server_name", "Test server"],
      ["map_name", "de_mirage"],
      ["demo_version_name", "valve_demo_2"],
      ["patch_version", "14165"],
    ])),
    parseEvents: vi.fn(() => parserEvents),
    parseTicks: vi.fn(() => [{ steamid: "1", tick: 555 }]),
  };
}

describe("native parser runtime boundary", () => {
  it("collects one deterministic event pass and groups only known event names", () => {
    const parser = makeParser();
    const result = collectDemoParserInput(parser, "demo-bytes", {
      fileName: "new.dem",
      fileSize: 2048,
      demoSha256: "C".repeat(64),
    });

    expect(parser.parseEvents).toHaveBeenCalledWith(
      "demo-bytes",
      DEMO_IMPORT_EVENT_NAMES,
      [],
      expect.arrayContaining(["game_time", "total_rounds_played"]),
    );
    expect(result.killEvents).toHaveLength(1);
    expect(result.roundStartEvents).toHaveLength(1);
    expect(result.roundFreezeEndEvents).toHaveLength(1);
    expect(result.roundEndEvents).toHaveLength(1);
    expect(result.playerFirstConnectEvents).toHaveLength(1);
  });

  it("parses the exact user-selected tick instead of a pre-enumerated candidate", () => {
    const parser = makeParser();
    const result = collectDemoParserSelectionInput(parser, "demo-bytes", {
      fileName: "new.dem",
      fileSize: 2048,
      demoSha256: "D".repeat(64),
      roundNumber: 1,
      tick: 555,
    });

    expect(parser.parseTicks).toHaveBeenCalledWith(
      "demo-bytes",
      DEMO_IMPORT_TICK_PROPS,
      [555],
    );
    expect(result.tick).toBe(555);
    expect(result.tickRows).toEqual([{ steamid: "1", tick: 555 }]);
  });

  it("rejects malformed parser collection results instead of falling back to fixtures", () => {
    const parser = makeParser();
    vi.mocked(parser.parseEvents).mockReturnValueOnce({} as never);

    expect(() =>
      collectDemoParserInput(parser, "demo-bytes", {
        fileName: "new.dem",
        fileSize: 2048,
        demoSha256: "E".repeat(64),
      }),
    ).toThrow(/array/);
  });
});
