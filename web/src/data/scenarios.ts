import { ScenarioSchema } from "@/domain/schemas";
import { fixtureScenarios } from "./scenarios.fixture";
import { realScenarios } from "./scenarios.real";

/** 测试 / 开发 fallback 专用 Fixture，正式运行不得使用。 */
export { fixtureScenarios };

/**
 * 正式体验用 Scenario：两个已核验职业比赛截点 + 一个练习参考截点。
 * Fixture 仅保留于测试与无素材开发，不进入正式运行。
 */
export const scenarios = realScenarios.map((scenario) =>
  ScenarioSchema.parse(scenario),
);
