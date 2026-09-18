import { describe, expect, it } from "vitest";
import normalizedMatchState from "@/data/realMatch/lite2-g2-spirit-r34.json";
import {
  buildImportedPracticeScenario,
  ImportedScenarioAuthoringSchema,
  type ImportedScenarioAuthoring,
} from "@/domain/importedScenario";
import {
  buildScenarioDraft,
  SCENARIO_DRAFT_QA_CHECK_IDS,
  approveScenarioDraftForPractice,
} from "@/domain/scenarioDraft";
import { realScenarios } from "@/data/scenarios.real";

const authoring: ImportedScenarioAuthoring = {
  title: "R34：把信息缺口写清楚",
  purpose: "测试玩家在未知区域中的判断",
  trainingFraming: "练习先陈述已知边界，再比较三条可行路径",
  objectiveFraming: "由 Human QA 确认本回合的执行目标与风险边界",
  knownFact: {
    label: "已确认",
    detail: "当前 Round、tick、玩家存活与 C4 状态来自选定截点。",
  },
  unknownFact: {
    label: "未知",
    detail: "选定 tick 后的敌方反应与回合结果不进入当前判断。",
  },
  calls: [
    { id: "A", label: "收缩执行", description: "将队伍向已知方向集中。" },
    { id: "B", label: "双向施压", description: "保留一侧压力再寻找连接。" },
    { id: "C", label: "继续控图", description: "用空间换取更多信息。" },
  ],
  reasonOptions: [
    { id: "known_position", label: "已知位置" },
    { id: "unknown_space", label: "未知区域" },
    { id: "time_pressure", label: "时间压力" },
  ],
  challengeGuidance: {
    A: { blindspot: "集中也可能撞入未知交叉。", question: "退路在哪里？", alternativeCall: "C" },
    B: { blindspot: "分兵会降低交易能力。", question: "谁能保护带包者？", alternativeCall: "A" },
    C: { blindspot: "等待会消耗执行窗口。", question: "何时停止获取信息？", alternativeCall: "A" },
  },
  tacticalNotes: {
    A: "路线 / 区域：从当前控制向执行区收缩，保持补枪距离。",
    B: "路线 / 区域：一侧保持压力，另一侧沿连接区转移。",
    C: "路线 / 区域：保持中路连接，不承诺单一执行区。",
  },
  professional: {
    call: "C",
    pathLabel: "保持控图",
    outcome: "Coach Reference：此处仅记录人工参考路径。",
    observations: ["先写清未知信息，再讨论是否值得等待。"],
  },
  perspective: {
    side: "T",
    visiblePlayerIds: normalizedMatchState.players
      .filter((player) => player.side === "T")
      .map((player) => player.id),
    confirmed: true,
    bombVisibility: "hidden",
  },
  mapAsset: null,
};

const plantedState = {
  ...normalizedMatchState,
  bomb: {
    ...normalizedMatchState.bomb,
    status: "planted" as const,
    carrierId: null,
    carrierName: null,
    rawState: { isPlanted: true, isDropped: false },
  },
  time: {
    ...normalizedMatchState.time,
    display: "下包后 0:02",
    semantics: "post_plant_elapsed" as const,
    remainingSeconds: null,
    postPlantElapsedSeconds: 2,
  },
};

describe("imported machine-only Draft promotion", () => {
  it("requires human-authored semantic content and preserves it in practice", () => {
    const draft = buildScenarioDraft(normalizedMatchState);
    const scenario = buildImportedPracticeScenario(
      draft,
      authoring,
      SCENARIO_DRAFT_QA_CHECK_IDS,
    );

    expect(scenario.verificationStatus).toBe("practice");
    expect(scenario.id).toBe(draft.id);
    expect(scenario.title).toBe(authoring.title);
    expect(scenario.purpose).toContain(authoring.trainingFraming);
    expect(scenario.calls).toEqual(authoring.calls);
    expect(scenario.situation.objective).toBe(authoring.objectiveFraming);
    expect(scenario.situation.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: `已确认 · ${authoring.knownFact.label}` }),
        expect.objectContaining({ label: `未知 · ${authoring.unknownFact.label}` }),
        expect.objectContaining({ label: "截点" }),
      ]),
    );
    expect(scenario.situation.facts).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ detail: expect.stringContaining("magixx") }),
      ]),
    );
    expect(scenario.situation.alive).toBe("5 T · 仅该 perspective 可见");
    expect(scenario.previewByCall.A.metrics).toEqual([
      {
        label: "路线 / 区域（Human QA）",
        value: authoring.tacticalNotes.A,
      },
    ]);
  });

  it("does not allow the existing authored Scenario approval helper to promote it", () => {
    const draft = buildScenarioDraft(normalizedMatchState);

    expect(() =>
      approveScenarioDraftForPractice(
        draft,
        realScenarios[1],
        SCENARIO_DRAFT_QA_CHECK_IDS,
      ),
    ).toThrow(/machine-only/);
  });

  it("does not expose plant-derived time when Human QA keeps C4 hidden", () => {
    const draft = buildScenarioDraft(plantedState);
    const scenario = buildImportedPracticeScenario(
      draft,
      authoring,
      SCENARIO_DRAFT_QA_CHECK_IDS,
    );
    const serializedScenario = JSON.stringify(scenario);

    expect(scenario.situation.time).toBe("时间未知");
    expect(scenario.situation.facts.find((fact) => fact.label === "截点")?.detail).toContain(
      "时间未知",
    );
    expect(serializedScenario).not.toContain("下包后 0:02");
  });

  it("preserves plant-derived time after Human QA confirms C4 visibility", () => {
    const draft = buildScenarioDraft(plantedState);
    const scenario = buildImportedPracticeScenario(
      draft,
      {
        ...authoring,
        perspective: { ...authoring.perspective, bombVisibility: "confirmed" },
      },
      SCENARIO_DRAFT_QA_CHECK_IDS,
    );

    expect(scenario.situation.time).toBe("下包后 0:02");
    expect(scenario.situation.facts.find((fact) => fact.label === "截点")?.detail).toContain(
      "下包后 0:02",
    );
  });

  it("rejects empty semantic content instead of manufacturing a Scenario", () => {
    expect(() =>
      ImportedScenarioAuthoringSchema.parse({
        ...authoring,
        title: "",
      }),
    ).toThrow();
    expect(() =>
      ImportedScenarioAuthoringSchema.parse({
        ...authoring,
        tacticalNotes: { ...authoring.tacticalNotes, B: "" },
      }),
    ).toThrow();
  });

  it("accepts the Ancient raster only for an Ancient normalized state", () => {
    const ancientState = {
      ...normalizedMatchState,
      map: {
        ...normalizedMatchState.map,
        name: "de_ancient",
        overview: {
          posX: -2953,
          posY: 2164,
          scale: 5,
          radarWidth: 1024,
          radarHeight: 1024,
          source:
            "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_ancient.txt",
        },
      },
    };
    const draft = buildScenarioDraft(ancientState);
    const scenario = buildImportedPracticeScenario(
      draft,
      { ...authoring, mapAsset: "/maps/Ancient_CurrentStateBase.png" },
      SCENARIO_DRAFT_QA_CHECK_IDS,
    );

    expect(scenario.mapBase).toBe("/maps/Ancient_CurrentStateBase.png");
    expect(() =>
      buildImportedPracticeScenario(
        buildScenarioDraft(normalizedMatchState),
        { ...authoring, mapAsset: "/maps/Ancient_CurrentStateBase.png" },
        SCENARIO_DRAFT_QA_CHECK_IDS,
      ),
    ).toThrow(/map/i);
  });
});
