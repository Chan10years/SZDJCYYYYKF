import { describe, expect, it } from "vitest";
import {
  DemoImportClient,
  type DemoImportProgress,
} from "@/lib/demoImportClient";
import {
  DemoRosterRecoveryError,
  DemoParseError,
  DemoParserRuntimeError,
} from "@/domain/demoImportErrors";

const SHA = "A".repeat(64);

function makeRaw(selectionTickStep?: number, inactiveSlots: readonly number[] = []) {
  const players = Array.from({ length: 10 }, (_, index) => ({
    slot: index,
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
    playerIdentities: players.map((player, slot) => ({
      slot,
      steamid: player.steamid,
      name: player.name,
      finalSide: player.team,
    })),
    competitiveParticipationEvidence: players.map((player, slot) => ({
      slot,
      steamid: player.steamid,
      competitiveEventReferenceCount: inactiveSlots.includes(slot) ? 0 : 1,
      competitiveEventKinds: inactiveSlots.includes(slot) ? [] : ["shots"],
    })),
    roundSideSnapshots: [
      {
        roundNumber: 1,
        freezeEndTick: 1200,
        players: players.map((player, slot) => ({
          slot,
          steamid: player.steamid,
          name: player.name,
          side: player.team === 3 ? "CT" : "T",
        })),
      },
    ],
    tickRows: players,
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
    ...(selectionTickStep ? { selectionTickStep } : {}),
  };
}

class FakeWorker {
  private listeners = new Set<(event: MessageEvent) => void>();
  terminated = false;
  constructor(
    private readonly failLoad = false,
    private readonly selectionActualTick: number | undefined = undefined,
    private readonly selectionTickStep: number | undefined = undefined,
    private readonly includeActualTick = true,
    private readonly failureCode = "unsupported",
    private readonly inactiveSlots: readonly number[] = [],
  ) {}

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
          this.emit({
            type: "error",
            code: this.failureCode,
            message:
              this.failureCode === "demo-parse"
                ? "浏览器本地 Demo 解析失败；原始文件未上传。"
                : undefined,
          });
          return;
        }
        const raw = makeRaw(this.selectionTickStep, this.inactiveSlots);
        this.emit({
          type: "inspection",
          fileName: "new-match.dem",
          fileSize: 15,
          demoSha256: SHA,
          selectionTickStep: this.selectionTickStep,
          raw,
        });
      } else if (message.type === "select") {
        const raw = makeRaw(this.selectionTickStep, this.inactiveSlots);
        const actualTick = this.selectionActualTick ?? message.tick;
        this.emit({
          type: "selection",
          roundNumber: message.roundNumber,
          requestedTick: message.tick,
          ...(this.includeActualTick ? { actualTick } : {}),
          raw: { ...raw, roundNumber: message.roundNumber, tick: actualTick },
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
  it("loads a new Demo locally and requests a valid exact tick", async () => {
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
    ).rejects.toBeInstanceOf(DemoParserRuntimeError);
  });

  it("keeps a Demo parse failure distinct from a parser runtime failure", async () => {
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(true, undefined, undefined, true, "demo-parse"),
    });

    await expect(
      client.load(new File([new Uint8Array(15)], "malformed.dem")),
    ).rejects.toBeInstanceOf(DemoParseError);
  });

  it("reports roster recovery ambiguity as an import error, not parser unsupported", async () => {
    const progress: DemoImportProgress[] = [];
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(false, undefined, undefined, true, "unsupported", [0]),
      onProgress: (next) => progress.push(next),
    });

    await expect(
      client.load(new File([new Uint8Array(15)], "ambiguous-roster.dem")),
    ).rejects.toBeInstanceOf(DemoRosterRecoveryError);
    expect(progress.at(-1)).toMatchObject({
      status: "error",
      failureKind: "roster-recovery",
    });
  });

  it("carries explicit roster confirmation through exact-tick selection", async () => {
    const client = new DemoImportClient({
      workerFactory: () =>
        new FakeWorker(false, undefined, undefined, true, "unsupported", [0]),
    });
    const file = new File([new Uint8Array(15)], "confirmed-roster.dem");
    const rosterIds = Array.from({ length: 10 }, (_, index) => String(index + 1));

    await client.load(file, { rosterConfirmation: { matchRosterIds: rosterIds } });
    const selected = await client.select(1, 5555);

    expect(selected.normalizedMatchState.players).toHaveLength(10);
    expect(selected.normalizedMatchState.players.map((player) => player.id)).toEqual(
      rosterIds,
    );
  });

  it("rejects a non-aligned tick before the worker can sample it", async () => {
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(false, undefined, 4),
    });

    await client.load(new File([new Uint8Array(15)], "sampled.dem"));
    await expect(client.select(1, 5555)).rejects.toThrow(/interval/);
  });

  it("rejects a worker sample that would move past the requested tick", async () => {
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(false, 5556),
    });

    await client.load(new File([new Uint8Array(15)], "future-sample.dem"));
    await expect(client.select(1, 5555)).rejects.toThrow(/未来|请求 tick/i);
  });

  it("rejects a selection without an explicit actual tick", async () => {
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(false, undefined, undefined, false),
    });

    await client.load(new File([new Uint8Array(15)], "missing-tick.dem"));
    await expect(client.select(1, 5555)).rejects.toThrow(/实际 tick/);
  });

  it("emits a non-running progress state after the selected tick is restored", async () => {
    const progress: DemoImportProgress[] = [];
    const client = new DemoImportClient({
      workerFactory: () => new FakeWorker(),
      onProgress: (next) => progress.push(next),
    });

    await client.load(new File([new Uint8Array(15)], "complete.dem"));
    await client.select(1, 5555);

    expect(progress.at(-1)).toMatchObject({ status: "ready" });
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
