import type {
  CallId,
  ChallengeOutput,
  ExperiencePhase,
  ReasonId,
  RoundResult,
} from "./types";
import { scenarios } from "@/data/scenarios";

export type ExperienceState = {
  phase: ExperiencePhase;
  scenarioIndex: number;
  initialCall: CallId | null;
  reasonIds: ReasonId[];
  challenge: ChallengeOutput | null;
  finalCall: CallId | null;
  completedRounds: RoundResult[];
};

const TOTAL_SCENARIOS = scenarios.length;

export const initialState: ExperienceState = {
  phase: "intro",
  scenarioIndex: 0,
  initialCall: null,
  reasonIds: [],
  challenge: null,
  finalCall: null,
  completedRounds: [],
};

export type ExperienceAction =
  | { type: "START" }
  | { type: "BEGIN_DECISION" }
  | { type: "SET_CALL"; call: CallId }
  | { type: "TOGGLE_REASON"; reason: ReasonId }
  | { type: "REQUEST_CHALLENGE" }
  | { type: "CHALLENGE_RESOLVED"; challenge: ChallengeOutput }
  | { type: "KEEP_INITIAL" }
  | { type: "ACCEPT_ALTERNATIVE" }
  | { type: "SHOW_REFERENCE" }
  | { type: "SHOW_REVIEW" }
  | { type: "COMPLETE_ROUND" }
  | { type: "RESET" }
  | { type: "HYDRATE"; payload: ExperienceState };

function canRequestChallenge(state: ExperienceState): boolean {
  return (
    state.initialCall !== null &&
    state.reasonIds.length >= 1 &&
    state.reasonIds.length <= 2
  );
}

export function experienceReducer(
  state: ExperienceState,
  action: ExperienceAction,
): ExperienceState {
  switch (action.type) {
    case "START":
      if (state.phase !== "intro") {
        return state;
      }
      return { ...state, phase: "situation" };

    case "BEGIN_DECISION":
      if (state.phase !== "situation") {
        return state;
      }
      return { ...state, phase: "decision" };

    case "SET_CALL":
      if (state.phase !== "decision") {
        return state;
      }
      return { ...state, initialCall: action.call };

    case "TOGGLE_REASON": {
      if (state.phase !== "decision") {
        return state;
      }
      const has = state.reasonIds.includes(action.reason);
      const reasonIds = has
        ? state.reasonIds.filter((id) => id !== action.reason)
        : state.reasonIds.length >= 2
          ? state.reasonIds
          : [...state.reasonIds, action.reason];
      return { ...state, reasonIds };
    }

    case "REQUEST_CHALLENGE":
      if (state.phase !== "decision" || !canRequestChallenge(state)) {
        return state;
      }
      return { ...state, phase: "challenge" };

    case "CHALLENGE_RESOLVED":
      if (state.phase !== "challenge") {
        return state;
      }
      return { ...state, challenge: action.challenge, phase: "challenge" };

    case "KEEP_INITIAL":
      if (state.phase !== "challenge" || state.initialCall === null) {
        return state;
      }
      return { ...state, finalCall: state.initialCall, phase: "preview" };

    case "ACCEPT_ALTERNATIVE": {
      if (
        state.phase !== "challenge" ||
        state.challenge === null ||
        state.challenge.alternativeCall === null
      ) {
        return state;
      }
      return {
        ...state,
        finalCall: state.challenge.alternativeCall,
        phase: "preview",
      };
    }

    case "SHOW_REFERENCE":
      if (state.phase !== "preview") {
        return state;
      }
      return { ...state, phase: "reference" };

    case "SHOW_REVIEW":
      if (state.phase !== "reference") {
        return state;
      }
      return { ...state, phase: "review" };

    case "COMPLETE_ROUND": {
      if (
        state.phase !== "review" ||
        state.initialCall === null ||
        state.finalCall === null ||
        state.challenge === null
      ) {
        return state;
      }
      const scenario = scenarios[state.scenarioIndex];
      if (!scenario) {
        return state;
      }
      const round: RoundResult = {
        scenarioId: scenario.id,
        initialCall: state.initialCall,
        reasonIds: state.reasonIds,
        aiStance: state.challenge.stance,
        aiAlternativeCall: state.challenge.alternativeCall,
        aiResponseSource: state.challenge.source,
        finalCall: state.finalCall,
        changedAfterAI: state.finalCall !== state.initialCall,
        professionalCall: scenario.professional.call,
        completedAt: new Date().toISOString(),
      };
      const completedRounds = [...state.completedRounds, round];
      const nextIndex = state.scenarioIndex + 1;
      if (nextIndex >= TOTAL_SCENARIOS) {
        return {
          phase: "summary",
          // 保持在 PersistedSessionSchema 允许的 0..2 范围内，刷新后可恢复
          scenarioIndex: TOTAL_SCENARIOS - 1,
          initialCall: null,
          reasonIds: [],
          challenge: null,
          finalCall: null,
          completedRounds,
        };
      }
      return {
        phase: "situation",
        scenarioIndex: nextIndex,
        initialCall: null,
        reasonIds: [],
        challenge: null,
        finalCall: null,
        completedRounds,
      };
    }

    case "RESET":
      return { ...initialState };

    case "HYDRATE":
      return { ...action.payload };

    default:
      return state;
  }
}