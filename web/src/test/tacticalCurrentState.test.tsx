import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { realScenarios } from "@/data/scenarios.real";
import normalizedMatchState from "@/data/realMatch/lite2-g2-spirit-r34.json";
import { buildCurrentStatePreview } from "@/domain/currentStatePreview";
import { TacticalPreview } from "@/components/tactical/TacticalPreview";

describe("TacticalPreview current-match-state mode", () => {
  it("renders real markers without routes, zones, metrics, or authored legend", () => {
    const currentState = buildCurrentStatePreview(normalizedMatchState);
    const { container, getByText } = render(
      <TacticalPreview
        scenario={realScenarios[1]}
        call="A"
        currentState={currentState}
      />,
    );

    expect(container.querySelector('svg[data-current-state="true"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-current-player]")).toHaveLength(10);
    expect(container.querySelector('g[transform] path')).toBeNull();
    expect(container.querySelector('g[transform] title')).toBeNull();
    expect(container.querySelector('[aria-label="Lite2 修正版图例"]')).toBeNull();
    expect(getByText("真实比赛状态 · 静态截点")).toBeTruthy();
    expect(getByText("真实比赛状态 · 非执行路线 · 非比赛结果预测")).toBeTruthy();
  });
});
