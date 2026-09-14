import { describe, expect, it, vi } from "vitest";
import { buildDemoImportInspection, buildDemoImportNormalizedState } from "@/domain/demoImportAdapter";
import type { DemoParserInspectionInput } from "@/domain/demoImportAdapter";
import { DemoImportClient } from "@/lib/demoImportClient";

const SHA = "A".repeat(64);

function makeRaw() {
  const players = Array.from({ length: 10 }, (_, index) => ({
    steamid: String(index + 1),
    name: `player-${index + 1}`,
    team: index < 5 ? 3 : 2,
    X: index,
    Y: index + 1,
    Z: 0,
    health: 100,
    is_alive: true,
    active_weapon_name: "AK-47",
    last_place_name: "Mid",
    game_time: 45,
  }));
  return {
    header: {
      map_name: "de_mirage",
      demo_version_name: "demo",
      patch_version: "patch",
      server_name: "new server",
    },
    playerFirstConnectEvents: players.map((player) => ({
      event_name: "player_first_connect",
      steamid: player.steamid,
      name: player.name,
      team: player.team,
    })),
    roundStartEvents: [
      {
        event_name: "round_start",
        tick: 1000,
        game_time: 0,
        total_rounds_played: 0,
        round: 1,
        is_warmup_period: false,
      },
    ],
    roundFreezeEndEvents: [
      {
        event_name: "round_freeze_end",
        tick: 1200,
        game_time: 3,
        total_rounds_played: 0,
        round: 1,
      },
    ],
    roundEndEvents: [
      {
        event_name: "round_end",
        tick: 7000,
        game_time: 93,
        total_rounds_played: 0,
        round: 1,
        winner: "T",
        is_warmup_period: false,
      },
    ],
    killEvents: [],
    bombEvents: [],
    tickRows: players,
  };
}

function makeInspection() {
  const raw = makeRaw();
  const input: DemoParserInspectionInput = {
    fileName: "new-match.dem",
    fileSize: 15,
    demoSha256: SHA,
    header: raw.header,
    playerFirstConnectEvents: raw.playerFirstConnectEvents,
    roundStartEvents: raw.roundStartEvents,
    roundFreezeEndEvents: raw.roundFreezeEndEvents,
    roundEndEvents: raw.roundEndEvents,
    killEvents: raw.killEvents,
    bombEvents: raw.bombEvents,
  };
  return buildDemoImportInspection(input);
}

class FakeWorker {
  private listeners = new Set<(event: MessageEvent) => void>();
  constructor(private readonly failLoad = false) {}

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.delete(listener);
  }

  postMessage(message: { type: string; roundNumber?: number; tick?: number }) {
    queueMicrotask(() => {
      if (message.type === "load") {
        if (this.failLoad) {
          this.emit({ type: "error", code: "unsupported" });
          return;
        }
        const raw = makeRaw();
        this.emit({ type: "inspection", fileName: "new-match.dem", fileSize: 15, demoSha256: SHA, raw });
      } else if (message.type === "select") {
        const raw = makeRaw();
        this.emit({
          type: "selection",
          roundNumber: message.roundNumber,
          tick: message.tick,
          raw: { ...raw, roundNumber: message.roundNumber, tick: message.tick },
        });
      }
    });
  }

  terminate() {}

  private emit(data: unknown) {
    const event = { data } as MessageEvent;
    this.listeners.forEach((listener) => listener(event));
  }
}

describe("DemoImportClient", () => {
  it("loads a new Demo locally and requests an arbitrary exact tick", async () => {
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(),
      fetchImpl: vi.fn(),
    });
    const file = new File([new Uint8Array(15)], "new-match.dem");

    const loaded = await client.load(file);
    expect(loaded.mode).toBe("browser-local");
    expect(loaded.inspection.rounds[0].minSelectableTick).toBe(1200);

    const selected = await client.select(1, 5555);
    expect(selected.mode).toBe("browser-local");
    expect(selected.normalizedMatchState.tick).toBe(5555);
  });

  it("switches explicitly to the compatibility parser when local WASM is unsupported", async () => {
    const inspection = makeInspection();
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const form = init?.body as FormData;
      if (form.get("action") === "inspect") {
        return Response.json({ kind: "inspection", inspection });
      }
      const raw = makeRaw();
      const state = buildDemoImportNormalizedState({
        fileName: "new-match.dem",
        fileSize: 15,
        demoSha256: SHA,
        header: raw.header,
        playerFirstConnectEvents: raw.playerFirstConnectEvents,
        roundStartEvents: raw.roundStartEvents,
        roundFreezeEndEvents: raw.roundFreezeEndEvents,
        roundEndEvents: raw.roundEndEvents,
        killEvents: raw.killEvents,
        bombEvents: raw.bombEvents,
        roundNumber: 1,
        tick: 5555,
        tickRows: raw.tickRows,
      });
      return Response.json({ kind: "selection", inspection, normalizedMatchState: state });
    });
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(true),
      fetchImpl,
    });

    const loaded = await client.load(new File([new Uint8Array(15)], "new-match.dem"));
    expect(loaded.mode).toBe("compatibility");
    expect(loaded.inspection.matchLabel).toBe("new server");

    const selected = await client.select(1, 5555);
    expect(selected.mode).toBe("compatibility");
    expect(selected.normalizedMatchState.source.demoSha256).toBe(SHA);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("surfaces malformed or unsupported compatibility responses without fixture fallback", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ kind: "not-a-real-response" }, { status: 422 }));
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(true),
      fetchImpl,
    });

    await expect(
      client.load(new File([new Uint8Array(15)], "new-match.dem")),
    ).rejects.toThrow(/无法读取|response|parser/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
