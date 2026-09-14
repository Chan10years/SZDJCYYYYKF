import { describe, expect, it } from "vitest";
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

class FakeWorker {
  private listeners = new Set<(event: MessageEvent) => void>();
  terminated = false;
  constructor(private readonly failLoad = false) {}

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.delete(listener);
  }

  postMessage(message: { type: string; roundNumber?: number; tick?: number }) {
    if (this.terminated) return;
    queueMicrotask(() => {
      if (this.terminated) return;
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

  terminate() {
    this.terminated = true;
  }

  private emit(data: unknown) {
    const event = { data } as MessageEvent;
    this.listeners.forEach((listener) => listener(event));
  }
}

class StalledWorker extends FakeWorker {
  constructor() {
    super(false);
  }

  postMessage() {
    // Deliberately leave the request pending so timeout and cancellation are
    // observable at the client boundary.
  }
}

describe("DemoImportClient", () => {
  it("loads a new Demo locally and requests an arbitrary exact tick", async () => {
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(),
    });
    const file = new File([new Uint8Array(15)], "new-match.dem");

    const loaded = await client.load(file);
    expect(loaded.mode).toBe("browser-local");
    expect(loaded.inspection.rounds[0].minSelectableTick).toBe(1200);

    const selected = await client.select(1, 5555);
    expect(selected.mode).toBe("browser-local");
    expect(selected.normalizedMatchState.tick).toBe(5555);
  });

  it("surfaces local parser unsupported without uploading the Demo", async () => {
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(true),
    });

    await expect(
      client.load(new File([new Uint8Array(15)], "new-match.dem")),
    ).rejects.toThrow(/本地|上传|支持/);
  });

  it("terminates a stalled local parser at the timeout boundary", async () => {
    const worker = new StalledWorker();
    const client = new DemoImportClient({
      workerFactory: () => worker,
      workerTimeoutMs: 5,
    });

    await expect(
      client.load(new File([new Uint8Array(15)], "stalled.dem")),
    ).rejects.toThrow(/超时|本地|支持/);
    expect(worker.terminated).toBe(true);
  });

  it("cancels a pending local parse and ignores stale worker output", async () => {
    const worker = new StalledWorker();
    const client = new DemoImportClient({
      workerFactory: () => worker,
      workerTimeoutMs: 1000,
    });
    const loading = client.load(new File([new Uint8Array(15)], "cancel.dem"));
    const cancelled = loading.catch((error: unknown) => {
      expect(error).toMatchObject({ name: "DemoImportCancelledError" });
      expect(error).toHaveProperty("message", "已取消 Demo 解析");
    });

    client.cancel();

    await cancelled;
    expect(worker.terminated).toBe(true);
  });
});
