import type {
  CallId,
  ChallengeResponse,
  ChallengeOutput,
  ExperiencePhase,
  ReasonId,
  RoundResult,
  Scenario,
} from "./types";
import { scenarios } from "@/data/scenarios";
import { buildNextTrainingHypothesis } from "./trainingRecord";

export type ExperienceState = {
  phase: ExperiencePhase;
  scenarioIndex: number;
  initialCall: CallId | null;
  reasonIds: ReasonId[];
  optionalFreeformReasoning: string;
  challenge: ChallengeOutput | null;
  userResponseToChallenge: ChallengeResponse | null;
  changeReason: string;
  finalCall: CallId | null;
  postRoundReflection: string;
  nextTrainingHypothesis: string;
  completedRounds: RoundResult[];
};

export const initialState: ExperienceState = {
  phase: "intro",
  scenarioIndex: 0,
  initialCall: null,
  reasonIds: [],
  optionalFreeformReasoning: "",
  challenge: null,
  userResponseToChallenge: null,
  changeReason: "",
  finalCall: null,
  postRoundReflection: "",
  nextTrainingHypothesis: "",
  completedRounds: [],
};

export type ExperienceAction =
  | { type: "START" }
  | { type: "BEGIN_DECISION" }
  | { type: "SET_CALL"; call: CallId }
  | { type: "TOGGLE_REASON"; reason: ReasonId }
  | { type: "SET_INITIAL_REASONING"; value: string }
  | { type: "REQUEST_CHALLENGE" }
  | { type: "CHALLENGE_RESOLVED"; challenge: ChallengeOutput }
  | { type: "SET_CHANGE_REASON"; value: string }
  | { type: "RESPOND_TO_CHALLENGE"; response: ChallengeResponse }
  | { type: "KEEP_INITIAL" }
  | { type: "ACCEPT_ALTERNATIVE" }
  | { type: "SHOW_REFERENCE" }
  | { type: "SHOW_REVIEW" }
  | { type: "SET_POST_ROUND_REFLECTION"; value: string }
  | { type: "SET_NEXT_TRAINING_HYPOTHESIS"; value: string }
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

function resolveChallengeResponse(
  state: ExperienceState,
  response: ChallengeResponse,
  requireReason: boolean,
): ExperienceState {
  if (
    state.phase !== "challenge" ||
    state.challenge === null ||
    state.initialCall === null
  ) {
    return state;
  }
  if (requireReason && state.changeReason.trim().length === 0) {
    return state;
  }
  if (response === "revise" && state.challenge.alternativeCall === null) {
    return state;
  }

  const finalCall =
    response === "revise"
      ? state.challenge.alternativeCall
      : state.initialCall;
  if (finalCall === null) {
    return state;
  }

  return {
    ...state,
    userResponseToChallenge: response,
    finalCall,
    phase: "preview",
  };
}

export function experienceReducer(
  state: ExperienceState,
  action: ExperienceAction,
  scenarioPool: readonly Scenario[] = scenarios,
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

    case "SET_INITIAL_REASONING":
      if (state.phase !== "decision") {
        return state;
      }
      return {
        ...state,
        optionalFreeformReasoning: action.value.slice(0, 500),
      };

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

    case "SET_CHANGE_REASON":
      if (state.phase !== "challenge") {
        return state;
      }
      return { ...state, changeReason: action.value.slice(0, 500) };

    case "RESPOND_TO_CHALLENGE":
      return resolveChallengeResponse(state, action.response, true);

    case "KEEP_INITIAL":
      return resolveChallengeResponse(state, "keep", false);

    case "ACCEPT_ALTERNATIVE": {
      return resolveChallengeResponse(state, "revise", false);
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
      {
        const scenario = scenarioPool[state.scenarioIndex];
        const nextTrainingHypothesis =
          state.nextTrainingHypothesis.trim().length > 0 ||
          !scenario ||
          state.initialCall === null ||
          state.finalCall === null ||
          state.challenge === null
            ? state.nextTrainingHypothesis
            : buildNextTrainingHypothesis({
                initialCall: state.initialCall,
                finalCall: state.finalCall,
                challenge: state.challenge,
              });
        return { ...state, phase: "review", nextTrainingHypothesis };
      }

    case "SET_POST_ROUND_REFLECTION":
      if (state.phase !== "review") {
        return state;
      }
      return { ...state, postRoundReflection: action.value.slice(0, 500) };

    case "SET_NEXT_TRAINING_HYPOTHESIS":
      if (state.phase !== "review") {
        return state;
      }
      return {
        ...state,
        nextTrainingHypothesis: action.value.slice(0, 500),
      };

    case "COMPLETE_ROUND": {
      if (
        state.phase !== "review" ||
        state.initialCall === null ||
        state.finalCall === null ||
        state.challenge === null
      ) {
        return state;
      }
      const scenario = scenarioPool[state.scenarioIndex];
      if (!scenario) {
        return state;
      }
      const scenarioCalls = scenario.calls.map((call) => ({ ...call }));
      const selectedReasons = state.reasonIds
        .map((reasonId) =>
          scenario.reasonOptions.find((reason) => reason.id === reasonId),
        )
        .filter((reason): reason is (typeof scenario.reasonOptions)[number] =>
          Boolean(reason),
        )
        .map((reason) => ({ ...reason }));
      const initialCallSnapshot = scenarioCalls.find(
        (call) => call.id === state.initialCall,
      );
      const finalCallSnapshot = scenarioCalls.find(
        (call) => call.id === state.finalCall,
      );
      if (
        selectedReasons.length !== state.reasonIds.length ||
        !initialCallSnapshot ||
        !finalCallSnapshot
      ) {
        return state;
      }
      const round: RoundResult = {
        scenarioId: scenario.id,
        scenarioSnapshot: {
          title: scenario.title,
          verificationStatus: scenario.verificationStatus,
          calls: scenarioCalls,
          selectedReasons,
        },
        initialCall: state.initialCall,
        reasonIds: [...state.reasonIds],
        optionalFreeformReasoning:
          state.optionalFreeformReasoning.trim() || undefined,
        aiChallenge: { ...state.challenge },
        aiStance: state.challenge.stance,
        aiAlternativeCall: state.challenge.alternativeCall,
        aiResponseSource: state.challenge.source,
        userResponseToChallenge:
          state.userResponseToChallenge ??
          (state.finalCall === state.initialCall ? "keep" : "revise"),
        changeReason: state.changeReason.trim() || undefined,
        finalCall: state.finalCall,
        changedAfterAI: state.finalCall !== state.initialCall,
        professionalCall: scenario.professional.call,
        professionalReference: {
          ...scenario.professional,
          observations: [...scenario.professional.observations],
        },
        postRoundReflection: state.postRoundReflection.trim() || undefined,
        nextTrainingHypothesis:
          state.nextTrainingHypothesis.trim() ||
          buildNextTrainingHypothesis({
            initialCall: state.initialCall,
            finalCall: state.finalCall,
            challenge: state.challenge,
          }),
        completedAt: new Date().toISOString(),
      };
      const completedRounds = [...state.completedRounds, round];
      const nextIndex = state.scenarioIndex + 1;
      if (nextIndex >= scenarioPool.length) {
        return {
          phase: "summary",
          // 保持在 PersistedSessionSchema 允许的 0..2 范围内，刷新后可恢复
          scenarioIndex: Math.max(0, scenarioPool.length - 1),
          initialCall: null,
          reasonIds: [],
          optionalFreeformReasoning: "",
          challenge: null,
          userResponseToChallenge: null,
          changeReason: "",
          finalCall: null,
          postRoundReflection: "",
          nextTrainingHypothesis: "",
          completedRounds,
        };
      }
      return {
        phase: "situation",
        scenarioIndex: nextIndex,
        initialCall: null,
        reasonIds: [],
        optionalFreeformReasoning: "",
        challenge: null,
        userResponseToChallenge: null,
        changeReason: "",
        finalCall: null,
        postRoundReflection: "",
        nextTrainingHypothesis: "",
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
