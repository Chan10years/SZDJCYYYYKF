import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { realScenarios } from "@/data/scenarios.real";
import normalizedMatchState from "@/data/realMatch/lite2-g2-spirit-r34.json";
import { buildCurrentStatePreview } from "@/domain/currentStatePreview";
import { approveScenarioDraftForPractice, buildScenarioDraft, SCENARIO_DRAFT_QA_CHECK_IDS } from "@/domain/scenarioDraft";
import { TacticalPreview } from "@/components/tactical/TacticalPreview";

const currentState = buildCurrentStatePreview(normalizedMatchState);

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

describe("TacticalPreview current-match-state mode", () => {
  it("renders real markers without routes, zones, metrics, or authored legend", () => {
    const { container, getByText } = render(
      <TacticalPreview
        scenario={realScenarios[1]}
        call="A"
        currentState={currentState}
      />,
    );

    expect(container.querySelector('svg[data-current-state="true"]')).not.toBeNull();
    const svg = container.querySelector('svg[data-current-state="true"]');
    const image = svg?.querySelector("image");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 1448 1086");
    expect(image?.getAttribute("href")).toBe("/maps/Lite2_CurrentStateBase.png");
    expect(image?.getAttribute("width")).toBe("1448");
    expect(image?.getAttribute("height")).toBe("1086");
    expect(container.querySelector('[href="/maps/Lite2_Map.png"]')).toBeNull();
    expect(container.querySelector('g[transform]')).toBeNull();
    expect(container.querySelectorAll("[data-current-player]")).toHaveLength(10);
    expect(container.querySelector('g[transform] path')).toBeNull();
    expect(container.querySelector('g[transform] title')).toBeNull();
    expect(container.querySelector('[aria-label="Lite2 修正版图例"]')).toBeNull();
    expect(getByText("真实比赛状态 · 静态截点")).toBeTruthy();
    expect(getByText("真实比赛状态 · 非执行路线 · 非比赛结果预测")).toBeTruthy();
  });

  it("keeps the authored Lite2 frame when practice content enters the existing preview", () => {
    const draft = buildScenarioDraft(normalizedMatchState, realScenarios[1]);
    const practiceScenario = approveScenarioDraftForPractice(
      draft,
      realScenarios[1],
      SCENARIO_DRAFT_QA_CHECK_IDS,
    );
    const { container } = render(
      <TacticalPreview scenario={practiceScenario} call="A" />,
    );

    expect(container.querySelector('g[transform]')?.getAttribute("transform")).toBe(
      "matrix(1 0 0 0.75 0 12.5)",
    );
  });

  it("does not expose plant-derived time in the current-state map label when C4 is hidden", () => {
    const currentStateWithHiddenBomb = buildCurrentStatePreview(plantedState, {
      visiblePlayerIds: plantedState.players
        .filter((player) => player.side === "T")
        .map((player) => player.id),
      bombVisibility: "hidden",
    });
    const { container } = render(
      <TacticalPreview
        scenario={realScenarios[1]}
        call="A"
        currentState={currentStateWithHiddenBomb}
      />,
    );

    expect(container.textContent).toContain("时间未知");
    expect(container.textContent).not.toContain("下包后 0:02");
  });
});
