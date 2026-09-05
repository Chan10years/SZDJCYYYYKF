import { ScenarioSchema } from "@/domain/schemas";
import { fixtureScenarios } from "./scenarios.fixture";

export const scenarios = fixtureScenarios.map((scenario) =>
  ScenarioSchema.parse(scenario),
);