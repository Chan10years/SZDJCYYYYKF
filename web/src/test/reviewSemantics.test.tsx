import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoundReviewScreen } from "@/components/experience/RoundReviewScreen";
import { ProfessionalReferenceScreen } from "@/components/experience/ProfessionalReferenceScreen";
import { TacticalPreviewScreen } from "@/components/experience/TacticalPreviewScreen";
import { fixtureScenarios } from "@/data/scenarios.fixture";
import type { ChallengeOutput } from "@/domain/types";

const scenario = fixtureScenarios[0];
const challenge: ChallengeOutput = {
  stance: "challenge",
  acknowledge: "承接",
  blindspot: "针对初始 Call 的盲点。",
  question: "针对初始 Call 的反问。",
  alternativeCall: "B",
  source: "fallback",
};

describe("RoundReviewScreen — review semantics", () => {
  it("attaches the AI challenge as risk only when the final call is kept", () => {
    render(
      <RoundReviewScreen
        scenario={scenario}
        initialCall="A"
        finalCall="A"
        challenge={challenge}
        primaryLabel="下一局"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/可能风险/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/针对初始 Call 的盲点/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/需要再想一次/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/已调整方案/)).not.toBeInTheDocument();
  });

  it("never shows the old Call's challenge as the final Call's risk after a change", () => {
    render(
      <RoundReviewScreen
        scenario={scenario}
        initialCall="A"
        finalCall="B"
        challenge={challenge}
        primaryLabel="下一局"
        onComplete={vi.fn()}
      />,
    );
    expect(
      screen.getAllByText(/你的最终方案 · Call B/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/可能风险/)).not.toBeInTheDocument();
    expect(screen.queryByText(/需要再想一次/)).not.toBeInTheDocument();
    expect(screen.queryByText(/针对初始 Call 的盲点/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/已调整方案/).length).toBeGreaterThan(0);
  });
});

describe("ProfessionalReferenceScreen — practice fixture copy", () => {
  it("uses practice wording and never claims real-match status when unverified", () => {
    render(<ProfessionalReferenceScreen scenario={scenario} onNext={vi.fn()} />);
    expect(screen.queryByText("真实职业路径")).not.toBeInTheDocument();
    expect(screen.queryByText(/历史上真实发生/)).not.toBeInTheDocument();
    expect(screen.getByText(/练习路径参考/)).toBeInTheDocument();
    expect(screen.getByText("06 · 练习参考")).toBeInTheDocument();
    expect(
      screen.getAllByText(/尚未进行正式比赛核验/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/不是唯一正确答案/).length).toBeGreaterThan(0);
  });
});

describe("TacticalPreviewScreen — reference entry copy", () => {
  it("shows practice entry for an unverified fixture", () => {
    render(
      <TacticalPreviewScreen
        scenario={scenario}
        finalCall="A"
        onNext={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("查看真实职业路径"),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText("查看练习路径参考").length,
    ).toBeGreaterThan(0);
  });

  it("shows the real professional entry for a verified scenario", () => {
    const verified = { ...scenario, verificationStatus: "verified" as const };
    render(
      <TacticalPreviewScreen
        scenario={verified}
        finalCall="A"
        onNext={vi.fn()}
      />,
    );
    expect(
      screen.getAllByText("查看真实职业路径").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("查看练习路径参考"),
    ).not.toBeInTheDocument();
  });
});
