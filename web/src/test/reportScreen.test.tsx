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
    expect(screen.getByText(/A 区已确认缺口/)).toBeInTheDocument();
    expect(screen.getByText(/A 侧已有双人前点/)).toBeInTheDocument();
    expect(screen.getByText(/已确认多名进攻方进入 B 区/)).toBeInTheDocument();
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

  it("小样本措辞保留，且无人格/能力诊断措辞", () => {
    render(
      <ConnectionReportScreen rounds={richRounds} onReset={vi.fn()} />,
    );
    expect(screen.getByText(/本次 3 个案例/)).toBeInTheDocument();
    expect(screen.queryByText(/人格/)).toBeInTheDocument(); // 仅出现在“不代表稳定人格”声明中
    expect(screen.queryByText(/你是.+型/)).not.toBeInTheDocument();
  });
});
