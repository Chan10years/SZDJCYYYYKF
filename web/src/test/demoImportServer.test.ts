import { describe, expect, it, vi } from "vitest";
import {
  parseDemoImportBuffer,
  sha256DemoBytes,
} from "@/lib/demoImportServer";
import type { DemoParserBindings } from "@/lib/demoParserRuntime";

const SHA = "A".repeat(64);

function makeParser(): DemoParserBindings {
  const players = Array.from({ length: 10 }, (_, index) => ({
    steamid: String(index + 1),
    name: `player-${index + 1}`,
    m_iTeamNum: index < 5 ? 3 : 2,
    X: index,
    Y: index + 1,
    Z: 0,
    health: 100,
    is_alive: true,
    active_weapon_name: "AK-47",
    last_place_name: "Mid",
    game_time: 45,
  }));
  const events = [
    ...players.map((player) => ({
      event_name: "player_first_connect",
      steamid: player.steamid,
      name: player.name,
      team: player.m_iTeamNum,
    })),
    {
      event_name: "round_start",
      tick: 1000,
      game_time: 0,
      total_rounds_played: 0,
      round: 1,
      is_warmup_period: false,
    },
    {
      event_name: "round_freeze_end",
      tick: 1200,
      game_time: 3,
      total_rounds_played: 0,
      round: 1,
    },
    {
      event_name: "round_end",
      tick: 7000,
      game_time: 93,
      total_rounds_played: 0,
      round: 1,
      winner: "T",
      is_warmup_period: false,
    },
  ];

  return {
    parseHeader: vi.fn(() => ({
      map_name: "de_mirage",
      demo_version_name: "demo",
      patch_version: "patch",
      server_name: "server",
    })),
    parseEvents: vi.fn(() => events),
    parseTicks: vi.fn(() => players),
  };
}

describe("parseDemoImportBuffer", () => {
  it("builds an inspection from parser output without using fixtures", () => {
    const parser = makeParser();
    const result = parseDemoImportBuffer(
      {
        buffer: Buffer.from("real-demo-bytes"),
        fileName: "new-match.dem",
        fileSize: 15,
        demoSha256: SHA,
        action: "inspect",
      },
      parser,
    );

    expect(result.kind).toBe("inspection");
    if (result.kind !== "inspection") return;
    expect(result.inspection.fileName).toBe("new-match.dem");
    expect(result.inspection.players).toHaveLength(10);
    expect(parser.parseEvents).toHaveBeenCalledTimes(1);
    expect(parser.parseTicks).not.toHaveBeenCalled();
  });

  it("parses only the selected tick after inspection and returns a normalized draft state", () => {
    const parser = makeParser();
    const result = parseDemoImportBuffer(
      {
        buffer: Buffer.from("real-demo-bytes"),
        fileName: "new-match.dem",
        fileSize: 15,
        demoSha256: SHA,
        action: "select",
        roundNumber: 1,
        tick: 5555,
      },
      parser,
    );

    expect(result.kind).toBe("selection");
    if (result.kind !== "selection") return;
    expect(result.normalizedMatchState.tick).toBe(5555);
    expect(result.normalizedMatchState.extraction.verificationStatus).toBe("draft");
    expect(parser.parseEvents).toHaveBeenCalledTimes(1);
    expect(parser.parseTicks).toHaveBeenCalledTimes(2);
    expect(parser.parseTicks).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(["X", "game_time"]),
      [5555],
    );
  });

  it("derives a real SHA-256 instead of accepting a path or fixture id", () => {
    expect(sha256DemoBytes(Buffer.from("hello"))).toBe(
      "2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824",
    );
  });

  it("rejects a selection outside the inspected selectable range", () => {
    expect(() =>
      parseDemoImportBuffer(
        {
          buffer: Buffer.from("real-demo-bytes"),
          fileName: "new-match.dem",
          fileSize: 15,
          demoSha256: SHA,
          action: "select",
          roundNumber: 1,
          tick: 9999,
        },
        makeParser(),
      ),
    ).toThrow(/selectable range/);
  });
});
