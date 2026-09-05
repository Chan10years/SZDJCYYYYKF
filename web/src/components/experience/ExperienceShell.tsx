"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { experienceReducer, initialState } from "@/domain/experienceReducer";
import { loadSession, saveSession } from "@/lib/storage";
import { requestChallengeOnClient } from "@/lib/challengeClient";
import { scenarios } from "@/data/scenarios";
import type { ExperiencePhase } from "@/domain/types";
import { IntroScreen } from "./IntroScreen";
import { SituationScreen } from "./SituationScreen";
import { DecisionScreen } from "./DecisionScreen";
import { ChallengeScreen } from "./ChallengeScreen";

function NotYet({ phase }: { phase: ExperiencePhase }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
        {phase}
      </p>
      <p className="text-sm text-app-muted">此阶段将在后续构建。</p>
    </div>
  );
}

export function ExperienceShell() {
  const [state, dispatch] = useReducer(experienceReducer, initialState);
  const [hydrated, setHydrated] = useState(false);
  const challengeAttempted = useRef(false);

  useEffect(() => {
    const saved = loadSession();
    if (saved) dispatch({ type: "HYDRATE", payload: saved });
    // 仅此一处：客户端挂载后标记已水合，防止初始空 state 覆盖已保存的会话。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveSession(state);
  }, [hydrated, state]);

  // phase 变化时重置“挑战请求已发起”标记，避免一次进入阶段内重复请求。
  useEffect(() => {
    challengeAttempted.current = false;
  }, [state.phase]);

  useEffect(() => {
    if (
      state.phase !== "challenge" ||
      state.challenge !== null ||
      challengeAttempted.current
    ) {
      return;
    }
    if (state.initialCall === null || state.reasonIds.length === 0) {
      return;
    }
    challengeAttempted.current = true;
    const scenarioId = scenarios[state.scenarioIndex].id;
    requestChallengeOnClient({
      scenarioId,
      initialCall: state.initialCall,
      reasonIds: state.reasonIds,
    })
      .then((challenge) => {
        dispatch({ type: "CHALLENGE_RESOLVED", challenge });
      })
      .catch(() => {
        // 服务端在失败时也会返回 200 + fallback；此分支仅防御性兜底，
        // 不自动重试，避免在无 result 时无限请求。
      });
  }, [state.phase, state.challenge, state.initialCall, state.reasonIds, state.scenarioIndex]);

  if (!hydrated) {
    return null;
  }

  const scenario = scenarios[state.scenarioIndex];

  switch (state.phase) {
    case "intro":
      return <IntroScreen onStart={() => dispatch({ type: "START" })} />;
    case "situation":
      return (
        <SituationScreen
          scenario={scenario}
          round={state.scenarioIndex + 1}
          totalRounds={scenarios.length}
          onBegin={() => dispatch({ type: "BEGIN_DECISION" })}
        />
      );
    case "decision":
      return (
        <DecisionScreen
          scenario={scenario}
          initialCall={state.initialCall}
          reasonIds={state.reasonIds}
          onSelectCall={(call) => dispatch({ type: "SET_CALL", call })}
          onToggleReason={(reason) =>
            dispatch({ type: "TOGGLE_REASON", reason })
          }
          onLock={() => dispatch({ type: "REQUEST_CHALLENGE" })}
        />
      );
    case "challenge":
      return (
        <ChallengeScreen
          challenge={state.challenge}
          onKeep={() => dispatch({ type: "KEEP_INITIAL" })}
          onAccept={() => dispatch({ type: "ACCEPT_ALTERNATIVE" })}
        />
      );
    default:
      return <NotYet phase={state.phase} />;
  }
}