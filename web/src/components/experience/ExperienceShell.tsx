"use client";

import { useEffect, useReducer, useState } from "react";
import { experienceReducer, initialState } from "@/domain/experienceReducer";
import { loadSession, saveSession } from "@/lib/storage";
import { scenarios } from "@/data/scenarios";
import type { ExperiencePhase } from "@/domain/types";
import { IntroScreen } from "./IntroScreen";
import { SituationScreen } from "./SituationScreen";
import { DecisionScreen } from "./DecisionScreen";

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
    default:
      return <NotYet phase={state.phase} />;
  }
}