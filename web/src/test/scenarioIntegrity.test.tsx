import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { fixtureScenarios } from "@/data/scenarios.fixture";
import { realScenarios } from "@/data/scenarios.real";
import { TacticalPreview } from "@/components/tactical/TacticalPreview";
import type { Scenario } from "@/domain/types";

type Point = { x: number; y: number };

function getRoute(scenario: Scenario, call: "A" | "B" | "C", playerId: string) {
  const route = scenario.previewByCall[call].routes.find(
    (candidate) => candidate.playerId === playerId,
  );
  expect(route).toBeDefined();
  return route!;
}

function lastPoint(scenario: Scenario, call: "A" | "B" | "C", playerId: string) {
  return getRoute(scenario, call, playerId).points.at(-1)!;
}

function expectPointNear(actual: Point, expected: Point, tolerance = 8) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
}

describe("real Scenario content integrity", () => {
  it("keeps verification status explicit across real and fixture content", () => {
    expect(realScenarios.map((scenario) => scenario.verificationStatus)).toEqual([
      "verified",
      "verified",
      "practice",
    ]);
    expect(fixtureScenarios.every((scenario) => scenario.verificationStatus === "practice")).toBe(
      true,
    );
  });

  it("anchors authored routes to the visible markers and intended sites", () => {
    const hero = realScenarios[0];
    expectPointNear(getRoute(hero, "A", "tN1R").points[0], { x: 63, y: 70 });
    expectPointNear(getRoute(hero, "A", "zont1x").points[0], { x: 38, y: 36 });
    expectPointNear(getRoute(hero, "A", "sh1ro").points[0], { x: 43, y: 38 });
    expectPointNear(lastPoint(hero, "A", "sh1ro"), { x: 51, y: 78 });
    expectPointNear(lastPoint(hero, "B", "tN1R"), { x: 15, y: 20 });
    expectPointNear(lastPoint(hero, "B", "sh1ro"), { x: 15, y: 20 });

    const lite2 = realScenarios[1];
    expect(lite2.mapBase).toBe("/maps/Lite2_Map.png");
    expect(lite2.title).toBe("R34：16:17 的三向抉择");
    expectPointNear(getRoute(lite2, "A", "p8").points[0], { x: 85, y: 57 }, 2);
    expectPointNear(getRoute(lite2, "A", "p0").points[0], { x: 70, y: 37 }, 2);
    expectPointNear(getRoute(lite2, "A", "p6").points[0], { x: 31, y: 12 }, 2);
    expectPointNear(getRoute(lite2, "A", "p7").points[0], { x: 67, y: 77 }, 2);
    expectPointNear(getRoute(lite2, "A", "p9").points[0], { x: 62, y: 91 }, 2);
    for (const call of ["A", "B", "C"] as const) {
      expect(lite2.previewByCall[call].routes).toHaveLength(5);
      expectPointNear(getRoute(lite2, call, "p8").points[0], { x: 85, y: 57 }, 2);
      expectPointNear(getRoute(lite2, call, "p0").points[0], { x: 70, y: 37 }, 2);
      expectPointNear(getRoute(lite2, call, "p6").points[0], { x: 31, y: 12 }, 2);
      expectPointNear(getRoute(lite2, call, "p7").points[0], { x: 67, y: 77 }, 2);
      expectPointNear(getRoute(lite2, call, "p9").points[0], { x: 62, y: 91 }, 2);
    }
    expectPointNear(lastPoint(lite2, "A", "p8"), { x: 51, y: 90 }, 2);
    expectPointNear(lastPoint(lite2, "A", "p0"), { x: 70, y: 37 }, 2);
    expectPointNear(lastPoint(lite2, "A", "p6"), { x: 31, y: 12 }, 2);
    expectPointNear(lastPoint(lite2, "A", "p7"), { x: 67, y: 77 }, 2);
    expectPointNear(lastPoint(lite2, "A", "p9"), { x: 62, y: 91 }, 2);
    expectPointNear(lastPoint(lite2, "B", "p8"), { x: 17, y: 23 }, 2);
    expectPointNear(lastPoint(lite2, "B", "p0"), { x: 17, y: 23 }, 2);
    expectPointNear(lastPoint(lite2, "B", "p6"), { x: 17, y: 23 }, 2);
    expectPointNear(lastPoint(lite2, "B", "p7"), { x: 67, y: 77 }, 2);
    expectPointNear(lastPoint(lite2, "B", "p9"), { x: 62, y: 91 }, 2);
    expectPointNear(lastPoint(lite2, "C", "p8"), { x: 17, y: 23 }, 2);
    expectPointNear(lastPoint(lite2, "C", "p0"), { x: 17, y: 23 }, 2);
    expectPointNear(lastPoint(lite2, "C", "p6"), { x: 17, y: 23 }, 2);
    expectPointNear(lastPoint(lite2, "C", "p7"), { x: 17, y: 23 }, 2);
    expectPointNear(lastPoint(lite2, "C", "p9"), { x: 17, y: 23 }, 2);

    const heroScore = realScenarios[0].situation.facts.find((fact) => fact.label === "比分");
    expect(heroScore?.detail).toContain("Spirit 0 : 4 Falcons");

    const lite3 = realScenarios[2];
    for (const call of ["A", "B", "C"] as const) {
      expectPointNear(getRoute(lite3, call, "karrigan").points[0], {
        x: 27,
        y: 18,
      });
      const pressureZone = lite3.previewByCall[call].zones.find(
        (zone) => zone.label.includes("B 区"),
      );
      expect(pressureZone).toBeDefined();
      expectPointNear(pressureZone!, { x: 20, y: 17 });
      expectPointNear(getRoute(lite3, call, "ct0").points[0], { x: 46, y: 32 }, 2);
    }
    expectPointNear(lastPoint(lite3, "B", "karrigan"), { x: 20, y: 18 });
    expectPointNear(lastPoint(lite3, "A", "ct0"), { x: 31, y: 23 }, 2);
    expectPointNear(lastPoint(lite3, "B", "ct0"), { x: 28, y: 22 }, 2);
    expectPointNear(lastPoint(lite3, "C", "ct0"), { x: 46, y: 31 }, 2);
  });

  it("keeps the complete map visible when the preview is rendered", () => {
    const { container } = render(
      <TacticalPreview scenario={realScenarios[0]} call="A" />,
    );
    expect(container.querySelector("image")?.getAttribute("preserveAspectRatio")).toBe(
      "xMidYMid meet",
    );
  });

  it("maps Lite2 authored routes into the 4:3 image letterbox", () => {
    const { container } = render(
      <TacticalPreview scenario={realScenarios[1]} call="A" />,
    );
    const overlay = container.querySelector(
      'g[transform="matrix(1 0 0 0.75 0 12.5)"]',
    );
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelector('path[d^="M 85 57"]')).not.toBeNull();
  });

  it("authors Lite2 Call C as regroup first, then execute", () => {
    type MovementPhase = { id: string; label: string };
    type StagedRoute = { playerId: string; points: Point[]; phaseBreak?: number };
    const spec = realScenarios[1].previewByCall.C as typeof realScenarios[number]["previewByCall"]["C"] & {
      movementPhases?: MovementPhase[];
      routes: StagedRoute[];
    };

    expect(spec.movementPhases?.map((phase) => phase.id)).toEqual([
      "regroup",
      "execute",
    ]);
    expect(spec.movementPhases?.map((phase) => phase.label)).toEqual([
      "第一阶段：收缩 / 重组",
      "第二阶段：统一执行 B",
    ]);

    const regroupEndpoints: Record<string, Point> = {
      p7: { x: 80, y: 55 },
      p9: { x: 80, y: 55 },
      p8: { x: 80, y: 54 },
      p0: { x: 79, y: 53 },
      p6: { x: 31, y: 12 },
    };

    for (const route of spec.routes) {
      expect(route.phaseBreak).toBeDefined();
      const regroupIndex = route.phaseBreak!;
      expect(regroupIndex).toBeGreaterThan(0);
      expect(regroupIndex).toBeLessThan(route.points.length - 1);
      expect(route.points[regroupIndex]).toEqual(regroupEndpoints[route.playerId]);
      expect(route.points.at(-1)).toEqual({ x: 17, y: 23 });
    }
  });

  it("renders Lite2 Call C as two explicit movement stages", () => {
    const { container, getByLabelText } = render(
      <TacticalPreview scenario={realScenarios[1]} call="C" animate />,
    );

    expect(getByLabelText("Call C 两阶段时序")).toBeTruthy();
    expect(container.querySelectorAll('path[data-stage="regroup"]').length).toBe(5);
    expect(container.querySelectorAll('path[data-stage="execute"]').length).toBe(5);

    const nonStaged = render(<TacticalPreview scenario={realScenarios[1]} call="B" animate />);
    expect(nonStaged.container.querySelector('[data-stage="regroup"]')).toBeNull();
  });

  it("authors Lite3 Call B as lead entry first, then teammate follow-up", () => {
    type MovementPhase = { id: string; label: string };
    type StagedRoute = { playerId: string; points: Point[]; phaseBreak?: number };
    const spec = realScenarios[2].previewByCall.B as typeof realScenarios[number]["previewByCall"]["B"] & {
      movementPhases?: MovementPhase[];
      routes: StagedRoute[];
    };

    expect(spec.movementPhases?.map((phase) => phase.label)).toEqual([
      "第一阶段：先手穿烟 / 制造 B 区压力",
      "第二阶段：队友随后跟进 / 协同推进",
    ]);

    const lead = spec.routes.find((route) => route.playerId === "karrigan");
    expect(lead?.phaseBreak).toBe(2);
    expect(lead?.points[lead.phaseBreak!]).toEqual({ x: 22, y: 18 });
    expect(lead?.points.at(-1)).toEqual({ x: 22, y: 18 });

    for (const playerId of ["ct7", "ct9", "ct0"]) {
      const route = spec.routes.find((candidate) => candidate.playerId === playerId);
      expect(route?.phaseBreak).toBe(1);
      expect(route?.points[route.phaseBreak!]).toEqual(route?.points[0]);
      expect(route?.points.at(-1)).toEqual({ x: 28, y: 22 });
    }
  });

  it("renders Lite3 Call B stages without applying them to A or C", () => {
    const staged = render(<TacticalPreview scenario={realScenarios[2]} call="B" animate />);

    expect(staged.getByLabelText("Call B 两阶段时序")).toBeTruthy();
    expect(staged.container.querySelectorAll('path[data-stage="lead"]').length).toBe(4);
    expect(staged.container.querySelectorAll('path[data-stage="follow"]').length).toBe(4);

    const callA = render(<TacticalPreview scenario={realScenarios[2]} call="A" animate />);
    const callC = render(<TacticalPreview scenario={realScenarios[2]} call="C" animate />);
    expect(callA.container.querySelector('[data-stage="regroup"]')).toBeNull();
    expect(callC.container.querySelector('[data-stage="regroup"]')).toBeNull();
  });
});
