import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  buildDemoImportInspection,
  buildDemoImportNormalizedState,
  type DemoParserInspectionInput,
} from "@/domain/demoImportAdapter";
import { DemoImportScreen } from "@/components/import/DemoImportScreen";
import type {
  DemoImportClientLike,
  DemoImportProgress,
} from "@/lib/demoImportClient";
import { DemoRosterRecoveryError } from "@/domain/demoImportErrors";

const SHA = "B".repeat(64);

function makeData(mapName = "de_mirage") {
  const players = Array.from({ length: 10 }, (_, index) => ({
    slot: index,
    steamid: String(index + 1),
    name: `demo-player-${index + 1}`,
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
  const raw = {
    header: {
      map_name: mapName,
      demo_version_name: "demo",
      patch_version: "patch",
      server_name: "new user Demo",
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
    roundStartEvents: [{ event_name: "round_start", tick: 1000, game_time: 0, total_rounds_played: 0, round: 1, is_warmup_period: false }],
    roundFreezeEndEvents: [{ event_name: "round_freeze_end", tick: 1200, game_time: 3, total_rounds_played: 0, round: 1 }],
    roundEndEvents: [{ event_name: "round_end", tick: 7000, game_time: 93, total_rounds_played: 0, round: 1, winner: "T", is_warmup_period: false }],
    killEvents: [],
    bombEvents: [],
  };
  const base: DemoParserInspectionInput = {
    fileName: "new-user.dem",
    fileSize: 15,
    demoSha256: SHA,
    header: raw.header,
    playerIdentities: raw.playerIdentities,
    competitiveParticipationEvidence: raw.competitiveParticipationEvidence,
    roundSideSnapshots: raw.roundSideSnapshots,
    roundStartEvents: raw.roundStartEvents,
    roundFreezeEndEvents: raw.roundFreezeEndEvents,
    roundEndEvents: raw.roundEndEvents,
    killEvents: raw.killEvents,
    bombEvents: raw.bombEvents,
  };
  const inspection = buildDemoImportInspection(base);
  const normalizedMatchState = buildDemoImportNormalizedState({
    ...base,
    roundNumber: 1,
    tick: 5555,
    tickRows: raw.tickRows,
  });
  return { inspection, normalizedMatchState };
}

function fillById(id: string, value: string) {
  const field = document.getElementById(id);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
    throw new Error(`missing field ${id}`);
  }
  fireEvent.change(field, { target: { value } });
}

function makeClient(
  onProgress?: (progress: DemoImportProgress) => void,
  mapName = "de_mirage",
): DemoImportClientLike {
  const { inspection, normalizedMatchState } = makeData(mapName);
  return {
    load: vi.fn(async () => ({ inspection, mode: "browser-local" as const })),
    confirmRoster: vi.fn(async () => ({ inspection, mode: "browser-local" as const })),
    select: vi.fn(async () => {
      onProgress?.({
        status: "parsing",
        message: "正在浏览器本地恢复所选 tick…",
        mode: "browser-local",
      });
      return { normalizedMatchState, mode: "browser-local" as const };
    }),
    reset: vi.fn(),
    cancel: vi.fn(),
  };
}

describe("DemoImportScreen", () => {
  it("supports a new file, arbitrary tick selection, machine-only Draft, and Human QA promotion", async () => {
    const user = userEvent.setup();
    render(<DemoImportScreen clientFactory={(onProgress) => makeClient(onProgress)} />);

    const input = screen.getByTestId("demo-import-input");
    await user.upload(input, new File([new Uint8Array(15)], "new-user.dem"));
    expect(await screen.findByTestId("demo-import-inspection")).toBeInTheDocument();

    const tick = screen.getByTestId("demo-tick-number");
    await user.clear(tick);
    await user.type(tick, "5555");
    expect(screen.getByTestId("demo-selected-tick")).toHaveTextContent("5555");
    await user.click(screen.getByTestId("demo-restore-state"));

    expect(await screen.findByTestId("demo-import-draft")).toBeInTheDocument();
    expect(screen.queryByTestId("demo-import-cancel")).not.toBeInTheDocument();
    expect(screen.getByText("machine-only · draft")).toBeInTheDocument();
    expect(screen.getByTestId("demo-qa-approve")).toBeDisabled();

    fillById("import-title", "中路信息不足时的选择");
    fillById("import-purpose", "训练信息与节奏的取舍");
    fillById("import-training-framing", "连接事实、理由与行动");
    fillById("import-objective", "在未知空间下保留可交易结构");
    fillById("import-known-label", "已确认信息");
    fillById("import-known-detail", "Demo 截点确认当前玩家状态。");
    fillById("import-unknown-label", "未知空间");
    fillById("import-unknown-detail", "对手未暴露位置仍需人工核对。");
    await user.click(screen.getByTestId("import-observable-confirm"));
    for (const id of ["A", "B", "C"]) {
      fillById(`import-call-${id}-label`, `方案 ${id}`);
      fillById(`import-call-${id}-description`, `人工描述方案 ${id}`);
      fillById(`import-tactical-${id}`, `方案 ${id} 的路线与区域语义`);
      fillById(`import-guidance-${id}-blindspot`, `方案 ${id} 的盲点`);
      fillById(`import-guidance-${id}-question`, `方案 ${id} 的复盘问题`);
    }
    for (const index of [0, 1, 2]) {
      fillById(`import-reason-label-${index}`, `人工依据 ${index + 1}`);
    }
    fillById("import-professional-path", "教练参考路径");
    fillById("import-professional-outcome", "历史结果与决策截点分开记录");
    fillById("import-professional-observation-0", "人工观察，不是标准答案");

    for (const label of ["来源 / 地图", "回合 / 时间", "玩家 / 存活", "Bomb / carrier", "坐标 / 底图"]) {
      await user.click(screen.getByLabelText(`Human QA：${label}`));
    }
    expect(screen.getByTestId("demo-qa-approve")).toBeEnabled();
    await user.click(screen.getByTestId("demo-qa-approve"));

    await waitFor(() => expect(screen.getByTestId("demo-import-experience")).toBeInTheDocument());
    expect(screen.getByText("开始体验")).toBeInTheDocument();
  });

  it("does not render a fixture or future marker when import fails", async () => {
    const user = userEvent.setup();
    const client: DemoImportClientLike = {
      load: vi.fn(async () => { throw new Error("这场 Demo 当前无法读取"); }),
      confirmRoster: vi.fn(),
      select: vi.fn(),
      reset: vi.fn(),
      cancel: vi.fn(),
    };
    render(<DemoImportScreen clientFactory={() => client} />);
    await user.upload(screen.getByTestId("demo-import-input"), new File([new Uint8Array(15)], "broken.dem"));
    expect(await screen.findByRole("alert")).toHaveTextContent("这场 Demo 当前无法读取");
    expect(screen.queryByText(/Lite2|G2 vs Team Spirit/)).not.toBeInTheDocument();
  });

  it("shows unresolved identities and submits an explicit ten-player roster", async () => {
    const user = userEvent.setup();
    const { inspection } = makeData();
    const identityOptions = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      name: `parser-player-${index + 1}`,
      slot: index,
      directEvidenceReferenceCount: index < 10 ? 1 : 0,
      directEvidenceKinds: index < 10 ? ["shots"] : [],
      roundSideEvidenceRoundCount: 1,
    }));
    const recoveryError = new DemoRosterRecoveryError(
      "当前 parser identities 中存在未决身份，请确认本次比赛的 10 人 roster。",
      {
        canConfirm: true,
        candidateIdentityIds: identityOptions.slice(0, 10).map((identity) => identity.id),
        unresolvedIdentityIds: identityOptions.slice(10).map((identity) => identity.id),
        identityOptions,
      },
    );
    const confirmRoster = vi.fn(async () => ({
      inspection,
      mode: "browser-local" as const,
    }));
    const client: DemoImportClientLike = {
      load: vi.fn(async () => {
        throw recoveryError;
      }),
      confirmRoster,
      select: vi.fn(),
      reset: vi.fn(),
      cancel: vi.fn(),
    };

    render(<DemoImportScreen clientFactory={() => client} />);
    await user.upload(
      screen.getByTestId("demo-import-input"),
      new File([new Uint8Array(15)], "ambiguous.dem"),
    );

    expect(await screen.findByTestId("demo-roster-confirmation")).toBeInTheDocument();
    expect(screen.getByText("parser-player-11")).toBeInTheDocument();
    expect(screen.getByText("parser-player-12")).toBeInTheDocument();
    expect(screen.getByTestId("demo-roster-confirm")).toBeEnabled();

    await user.click(screen.getByTestId("demo-roster-confirm"));

    await waitFor(() => expect(confirmRoster).toHaveBeenCalledTimes(1));
    expect(confirmRoster).toHaveBeenCalledWith({
      matchRosterIds: Array.from({ length: 10 }, (_, index) => String(index + 1)),
    });
    expect(await screen.findByTestId("demo-import-inspection")).toBeInTheDocument();
  });

  it("offers only the map-matched Ancient radar after Ancient state recovery", async () => {
    const user = userEvent.setup();
    render(<DemoImportScreen clientFactory={(onProgress) => makeClient(onProgress, "de_ancient")} />);

    await user.upload(
      screen.getByTestId("demo-import-input"),
      new File([new Uint8Array(15)], "ancient.dem"),
    );
    await screen.findByTestId("demo-import-inspection");
    await user.click(screen.getByTestId("demo-restore-state"));

    await screen.findByTestId("demo-import-draft");
    expect(screen.getByTestId("import-ancient-raster")).toBeInTheDocument();
    expect(screen.queryByTestId("import-mirage-raster")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("import-ancient-raster"));
    expect(screen.getByTestId("import-ancient-raster")).toBeChecked();
  });
});
