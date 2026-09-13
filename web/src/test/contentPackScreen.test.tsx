import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { gate3RealContentPack } from "@/data/realMatch/gate3ContentPack";
import { ContentPackQaScreen } from "@/components/gate3/ContentPackQaScreen";

describe("Gate 3 content pack QA screen", () => {
  it("shows real map-diverse snapshots and keeps authored decisions out of the machine panel", () => {
    const { container, getByText, getAllByRole, queryByRole } = render(
      <ContentPackQaScreen pack={gate3RealContentPack} />,
    );

    expect(getByText("Real Content Pack · machine facts → Human QA")).toBeTruthy();
    expect(getByText("de_overpass")).toBeTruthy();
    expect(getByText("de_dust2")).toBeTruthy();
    expect(getByText("Human QA boundary")).toBeTruthy();
    expect(getAllByRole("checkbox")).toHaveLength(9);
    expect(container.textContent).toContain("No Call, Reason, risk, or trade-off is generated");
    expect(queryByRole("button", { name: /发布|verified|practice/i })).toBeNull();
  });
});
