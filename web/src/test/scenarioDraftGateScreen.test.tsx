import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import normalizedMatchState from "@/data/realMatch/lite2-g2-spirit-r34.json";
import { realScenarios } from "@/data/scenarios.real";
import { buildCurrentStatePreview } from "@/domain/currentStatePreview";
import {
  approveScenarioDraftForPractice,
  buildScenarioDraft,
  SCENARIO_DRAFT_QA_CHECK_IDS,
} from "@/domain/scenarioDraft";
import { ScenarioDraftGateScreen } from "@/components/gate1/ScenarioDraftGateScreen";

const authoredScenario = realScenarios[1];
const draft = buildScenarioDraft(normalizedMatchState, authoredScenario);
const currentState = buildCurrentStatePreview(normalizedMatchState);

describe("ScenarioDraft -> Human QA -> Second Coach", () => {
  it("requires all QA checks before entering the existing training flow", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ScenarioDraftGateScreen
        draft={draft}
        authoredScenario={authoredScenario}
        currentState={currentState}
      />,
    );

    const approveButton = screen.getByRole("button", {
      name: "通过 Human QA，进入 Second Coach",
    });
    expect(screen.getAllByRole("checkbox")).toHaveLength(
      SCENARIO_DRAFT_QA_CHECK_IDS.length,
    );
    expect(approveButton).toBeDisabled();

    for (const checkbox of screen.getAllByRole("checkbox")) {
      await user.click(checkbox);
    }

    expect(approveButton).toBeEnabled();
    await user.click(approveButton);

    expect(
      await screen.findByText(/Human QA 已完成 · practice/),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "开始体验" }));

    expect(
      (await screen.findAllByRole("button", { name: "开始判断" })).length,
    ).toBe(2);
    expect(
      screen.getAllByRole("img", {
        name: "真实比赛状态 Round 34 Tick 184065 地图",
      }),
    ).toHaveLength(2);
    expect(
      container.querySelector('[data-map-asset="/maps/Lite2_CurrentStateBase.png"]'),
    ).not.toBeNull();
  });

  it("keeps the approval boundary explicit in the domain adapter", () => {
    const promoted = approveScenarioDraftForPractice(
      draft,
      authoredScenario,
      SCENARIO_DRAFT_QA_CHECK_IDS,
    );

    expect(promoted.verificationStatus).toBe("practice");
    expect(promoted.verificationStatus).not.toBe("verified");
  });
});
