import { RealMatchSpikeScreen } from "@/components/gate1/RealMatchSpikeScreen";
import { buildCurrentStatePreview } from "@/domain/currentStatePreview";
import { realScenarios } from "@/data/scenarios.real";
import normalizedMatchState from "@/data/realMatch/lite2-g2-spirit-r34.json";

function getLite2Scenario() {
  const scenario = realScenarios.find(
    (candidate) => candidate.id === "lite2-g2-spirit-mirage-r34",
  );
  if (!scenario) {
    throw new Error("Gate 1 requires the verified Lite2 Scenario");
  }
  return scenario;
}

const lite2Scenario = getLite2Scenario();

const currentState = buildCurrentStatePreview(normalizedMatchState);

export default function Gate1Page() {
  return <RealMatchSpikeScreen scenario={lite2Scenario} currentState={currentState} />;
}
