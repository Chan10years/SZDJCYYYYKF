import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChallengeScreen } from "@/components/experience/ChallengeScreen";
import { scenarios } from "@/data/scenarios";

describe("ChallengeScreen — AI source traceability", () => {
  it("shows the fallback source to the player", () => {
    render(
      <ChallengeScreen
        scenario={scenarios[0]}
        initialCall="A"
        reasonIds={[scenarios[0].reasonOptions[0].id]}
        challenge={{
          stance: "agree",
          acknowledge: "承接。",
          blindspot: "盲点。",
          question: "反问？",
          alternativeCall: null,
          source: "fallback",
        }}
        onKeep={() => undefined}
        onAccept={() => undefined}
      />,
    );

    expect(screen.getAllByText("来源：程序化 fallback")).toHaveLength(2);
  });
});
