import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SituationScreen } from "@/components/experience/SituationScreen";
import { realScenarios } from "@/data/scenarios.real";

describe("SituationScreen — decision-time media fairness", () => {
  it("does not render the shared later-match HUD image as decision context", () => {
    const { container } = render(
      <SituationScreen
        scenario={realScenarios[0]}
        round={1}
        totalRounds={3}
        onBegin={() => undefined}
      />,
    );

    expect(container.querySelectorAll('img[src*="situation-hero"]').length).toBe(0);
    expect(container.querySelectorAll('img[src*="/maps/MVP_Map.png"]').length).toBeGreaterThan(0);
  });

  it("corrects the authored Lite2 player legend without replacing the map asset", () => {
    const { getAllByLabelText, getAllByText } = render(
      <SituationScreen
        scenario={realScenarios[1]}
        round={2}
        totalRounds={3}
        onBegin={() => undefined}
      />,
    );

    expect(getAllByLabelText("Lite2 修正版图例").length).toBeGreaterThan(0);
    expect(getAllByText(/0 \/ 6 \/ 7 \/ 9/).length).toBeGreaterThan(0);
  });
});
