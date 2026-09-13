import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ConnectionReportScreen } from "@/components/experience/ConnectionReportScreen";
import { OBSERVATION_CANDIDATES } from "@/domain/reportObservation";
import { scenarios } from "@/data/scenarios";
import type { RoundResult } from "@/domain/types";

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

/** 丰富状态：R1 分歧+坚持，R2 分歧+调整，R3 一致。 */
const richRounds: RoundResult[] = [
  round({
    scenarioId: scenarios[0].id,
    initialCall: "A",
    aiStance: "challenge",
    aiAlternativeCall: "B",
    finalCall: "A",
    professionalCall: scenarios[0].professional.call,
  }),
  round({
    scenarioId: scenarios[1].id,
    initialCall: "C",
    aiStance: "challenge",
    aiAlternativeCall: "B",
    finalCall: "B",
    changedAfterAI: true,
    professionalCall: scenarios[1].professional.call,
  }),
  round({
    scenarioId: scenarios[2].id,
    initialCall: "B",
    finalCall: "B",
    professionalCall: "B",
  }),
];

/** 全部一致状态：AI 未提出任何不同方向。 */
const agreeRounds: RoundResult[] = scenarios.map((s, i) =>
  round({
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

const gate1PracticeRound = round({
  scenarioId: gate1PracticeScenario.id,
  initialCall: "A",
  finalCall: "A",
  professionalCall: "A",
});

const richReasoningRound = round({
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
