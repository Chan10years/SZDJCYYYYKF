import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ConnectionReportScreen } from "@/components/experience/ConnectionReportScreen";
import { experienceReducer, initialState } from "@/domain/experienceReducer";
import { OBSERVATION_CANDIDATES } from "@/domain/reportObservation";
import { scenarios } from "@/data/scenarios";
import type { RoundResult, Scenario } from "@/domain/types";

function round(partial: Partial<RoundResult> & { scenarioId: string }): RoundResult {
  return {
    initialCall: "A",
    reasonIds: ["known_position"],
    aiStance: "agree",
    aiAlternativeCall: null,
    aiResponseSource: "live",
    finalCall: "A",
    changedAfterAI: false,
    professionalCall: "A",
    completedAt: "2026-09-06T00:00:00.000Z",
    ...partial,
  };
}

function scenarioSnapshotFor(
  scenario: Scenario,
  reasonIds: RoundResult["reasonIds"],
) {
  return {
    title: scenario.title,
    verificationStatus: scenario.verificationStatus,
    calls: scenario.calls.map((call) => ({ ...call })),
    selectedReasons: reasonIds.map((reasonId) => ({
      ...scenario.reasonOptions.find((reason) => reason.id === reasonId)!,
    })),
  };
}

function recordedRound(
  scenario: Scenario,
  partial: Partial<RoundResult> & { scenarioId: string },
): RoundResult {
  const result = round(partial);
  return {
    ...result,
    scenarioSnapshot: scenarioSnapshotFor(scenario, result.reasonIds),
  };
}

/** 丰富状态：R1 分歧+坚持，R2 分歧+调整，R3 一致。 */
const richRounds: RoundResult[] = [
  recordedRound(scenarios[0], {
    scenarioId: scenarios[0].id,
    initialCall: "A",
    aiStance: "challenge",
    aiAlternativeCall: "B",
    finalCall: "A",
    professionalCall: scenarios[0].professional.call,
  }),
  recordedRound(scenarios[1], {
    scenarioId: scenarios[1].id,
    initialCall: "C",
    aiStance: "challenge",
    aiAlternativeCall: "B",
    finalCall: "B",
    changedAfterAI: true,
    professionalCall: scenarios[1].professional.call,
  }),
  recordedRound(scenarios[2], {
    scenarioId: scenarios[2].id,
    initialCall: "B",
    finalCall: "B",
    professionalCall: "B",
  }),
];

/** 全部一致状态：AI 未提出任何不同方向。 */
const agreeRounds: RoundResult[] = scenarios.map((s, i) =>
  recordedRound(s, {
    scenarioId: s.id,
    initialCall: (["A", "B", "C"] as const)[i],
    finalCall: (["A", "B", "C"] as const)[i],
    professionalCall: s.professional.call,
  }),
);

const gate1PracticeScenario = {
  ...scenarios[0],
  id: "gate1-practice-r34",
  verificationStatus: "practice" as const,
};

const gate1PracticeRound = recordedRound(gate1PracticeScenario, {
  scenarioId: gate1PracticeScenario.id,
  initialCall: "A",
  finalCall: "A",
  professionalCall: "A",
  professionalReference: gate1PracticeScenario.professional,
});

const richReasoningRound = recordedRound(scenarios[0], {
  scenarioId: scenarios[0].id,
  initialCall: "A",
  aiStance: "challenge",
  aiAlternativeCall: "B",
  aiResponseSource: "live",
  finalCall: "A",
  optionalFreeformReasoning: "先确认空间，再比较风险。",
  aiChallenge: {
    stance: "challenge",
    acknowledge: "你把「已知位置」作为主要依据。",
    blindspot: "记录中的 Challenge 盲点。",
    question: "记录中的 Challenge 反问。",
    alternativeCall: "B",
    source: "fallback",
  },
  userResponseToChallenge: "keep",
  changeReason: "这个风险仍不足以改变我的判断。",
  professionalReference: scenarios[0].professional,
  postRoundReflection: "我需要更明确地说出关键条件。",
  nextTrainingHypothesis: "下一次先检查关键条件。",
});

function cloneScenario(scenario: Scenario): Scenario {
  return JSON.parse(JSON.stringify(scenario)) as Scenario;
}

function completeRoundForScenario(scenario: Scenario): RoundResult {
  const completed = experienceReducer(
    {
      ...initialState,
      phase: "review",
      scenarioIndex: 0,
      initialCall: "A",
      reasonIds: ["known_position"],
      challenge: {
        stance: "challenge",
        acknowledge: "记录中的承接。",
        blindspot: "记录中的盲点。",
        question: "记录中的反问。",
        alternativeCall: "B",
        source: "fallback",
      },
      finalCall: "A",
    },
    { type: "COMPLETE_ROUND" },
    [scenario],
  );
  const recorded = completed.completedRounds[0];
  if (!recorded) {
    throw new Error("Expected a completed round");
  }
  return recorded;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        observation: OBSERVATION_CANDIDATES.mixed,
        source: "fallback",
      }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConnectionReportScreen — 两个核心数字", () => {
  it("keeps a completed reasoning chain stable after the same Scenario is edited", () => {
    const scenarioAtCompletion = cloneScenario(scenarios[0]);
    const recorded = completeRoundForScenario(scenarioAtCompletion);
    const originalTitle = scenarioAtCompletion.title;
    const originalCallLabel = scenarioAtCompletion.calls[0].label;
    const originalReasonLabel = scenarioAtCompletion.reasonOptions.find(
      (reason) => reason.id === "known_position",
    )?.label;
    const originalOutcome = scenarioAtCompletion.professional.outcome;

    scenarioAtCompletion.title = "后续改写的 Scenario 标题";
    scenarioAtCompletion.calls = scenarioAtCompletion.calls.map((call) =>
      call.id === "A"
        ? { ...call, label: "后续改写的 Call", description: "后续改写的方案语义" }
        : call,
    );
    scenarioAtCompletion.reasonOptions = scenarioAtCompletion.reasonOptions.map(
      (reason) =>
        reason.id === "known_position"
          ? { ...reason, label: "后续改写的理由" }
          : reason,
    );
    scenarioAtCompletion.professional = {
      ...scenarioAtCompletion.professional,
      pathLabel: "后续改写的职业路径",
      outcome: "后续改写的职业结果",
      observations: ["后续改写的观察"],
    };
    scenarioAtCompletion.verificationStatus = "draft";

    render(
      <ConnectionReportScreen
        rounds={[recorded]}
        scenarioPool={[scenarioAtCompletion]}
        requestRemoteReport={false}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText(originalTitle)).toBeInTheDocument();
    expect(screen.getAllByText(originalCallLabel, { exact: false }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(originalReasonLabel ?? "", { exact: false }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(originalOutcome)).toBeInTheDocument();
    expect(screen.getAllByText(/职业 C/).length).toBeGreaterThan(0);
    expect(screen.queryByText("后续改写的 Scenario 标题")).not.toBeInTheDocument();
    expect(screen.queryByText("后续改写的 Call")).not.toBeInTheDocument();
    expect(screen.queryByText("后续改写的理由")).not.toBeInTheDocument();
    expect(screen.queryByText("后续改写的职业结果")).not.toBeInTheDocument();
  });

  it("does not backfill missing historical Professional Reference from the current Scenario", () => {
    const currentScenario = cloneScenario(scenarios[0]);
    currentScenario.professional = {
      ...currentScenario.professional,
      pathLabel: "当前 Scenario 的职业路径",
      outcome: "当前 Scenario 的职业结果",
      observations: ["当前 Scenario 的观察"],
    };

    render(
      <ConnectionReportScreen
        rounds={[round({ scenarioId: scenarios[0].id })]}
        scenarioPool={[currentScenario]}
        requestRemoteReport={false}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText(/旧记录未保存 参考路径/)).toBeInTheDocument();
    expect(screen.queryByText("当前 Scenario 的职业路径")).not.toBeInTheDocument();
    expect(screen.queryByText("当前 Scenario 的职业结果")).not.toBeInTheDocument();
  });

  it("shows the saved initial reasoning, exact Challenge, response reason, and next check", () => {
    render(
      <ConnectionReportScreen
        rounds={[richReasoningRound]}
        requestRemoteReport={false}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText(/先确认空间，再比较风险/)).toBeInTheDocument();
    expect(screen.getByText(/记录中的 Challenge 反问/))
      .toBeInTheDocument();
    expect(screen.getByText(/这个风险仍不足以改变我的判断/))
      .toBeInTheDocument();
    expect(screen.getByText(/下一次先检查关键条件/))
      .toBeInTheDocument();
    expect(screen.getAllByText("来源：程序化 fallback").length)
      .toBeGreaterThan(0);
  });

  it("labels pre-Gate-2 missing history instead of reconstructing it", () => {
    render(
      <ConnectionReportScreen
        rounds={[round({ scenarioId: scenarios[0].id })]}
        requestRemoteReport={false}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText(/旧记录未保存 Challenge 正文/)).toBeInTheDocument();
    expect(screen.getByText(/旧记录未保存 回应理由/)).toBeInTheDocument();
    expect(screen.getByText(/旧记录未保存 next check/)).toBeInTheDocument();
  });

  it("丰富状态：显示调整比例与职业趋同比例两个核心数字", async () => {
    render(
      <ConnectionReportScreen rounds={richRounds} onReset={vi.fn()} />,
    );
    // 调整 1/2 = 50%；已核验职业参考趋同 1/2 = 50%，Lite3 practice 不计入该统计。
    expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/在 AI 分歧后发生调整/)).toBeInTheDocument();
    expect(screen.getByText(/最终判断与已核验职业路径趋同/)).toBeInTheDocument();
    // 轨迹状态文本齐备：坚持 / 调整 / 一致
    expect(screen.getAllByText("坚持").length).toBeGreaterThan(0);
    expect(screen.getAllByText("调整").length).toBeGreaterThan(0);
    expect(screen.getAllByText("一致").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/A 区已确认缺口/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/A 侧已有双人前点/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/已确认多名进攻方进入 B 区/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/练习 B/).length).toBeGreaterThan(0);
    // AI 行为观察（来自程序候选）
    await waitFor(() => {
      expect(
        screen.getByText(OBSERVATION_CANDIDATES.mixed),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("来源：程序化 fallback")).toBeInTheDocument();
  });

  it("零分歧状态：不显示 0%，改用安全文案", () => {
    render(
      <ConnectionReportScreen rounds={agreeRounds} onReset={vi.fn()} />,
    );
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(
      screen.getByText("本次体验中 AI 未提出不同方向。"),
    ).toBeInTheDocument();
    // 只用已核验职业参考计算趋同
    expect(screen.getByText(/最终判断与已核验职业路径趋同/)).toBeInTheDocument();
  });

  it("单案例 practice 报告使用传入 Scenario 池且不显示多案例文案", () => {
    render(
      <ConnectionReportScreen
        rounds={[gate1PracticeRound]}
        scenarioPool={[gate1PracticeScenario]}
        requestRemoteReport={false}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText("本局判断复盘。")).toBeInTheDocument();
    expect(screen.queryByText("从单局，到模式。")).not.toBeInTheDocument();
    expect(screen.getByText("本局判断变化轨迹")).toBeInTheDocument();
    expect(screen.queryByText("三轮判断变化轨迹")).not.toBeInTheDocument();
    expect(screen.getAllByText("练习 A").length).toBeGreaterThan(0);
    expect(screen.queryByText("草稿 A")).not.toBeInTheDocument();
  });

  it("小样本措辞保留，且无人格/能力诊断措辞", () => {
    render(
      <ConnectionReportScreen rounds={richRounds} onReset={vi.fn()} />,
    );
    expect(screen.getByText(/本次 3 个案例/)).toBeInTheDocument();
    expect(screen.queryByText(/人格/)).toBeInTheDocument(); // 仅出现在“不代表稳定人格”声明中
    expect(screen.queryByText(/你是.+型/)).not.toBeInTheDocument();
  });
});
