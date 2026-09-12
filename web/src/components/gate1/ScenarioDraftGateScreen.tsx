"use client";

import { useMemo, useState } from "react";
import { MetadataStrip, Num } from "@/components/layout/MetadataStrip";
import { PageFrame } from "@/components/layout/PageFrame";
import { TacticalPreview } from "@/components/tactical/TacticalPreview";
import { ExperienceShell } from "@/components/experience/ExperienceShell";
import {
  approveScenarioDraftForPractice,
  SCENARIO_DRAFT_QA_CHECK_IDS,
  type ScenarioDraft,
} from "@/domain/scenarioDraft";
import type { CurrentStatePreviewData } from "@/domain/currentStatePreview";
import type { Scenario } from "@/domain/types";

type ScenarioDraftGateScreenProps = {
  draft: ScenarioDraft;
  authoredScenario: Scenario;
  currentState: CurrentStatePreviewData;
};

/**
 * The smallest human-controlled content gate for Gate 1. A parsed snapshot
 * stays draft until each fact/space check is explicitly acknowledged; the
 * resulting practice Scenario is then handed to the unchanged Second Coach.
 */
export function ScenarioDraftGateScreen({
  draft,
  authoredScenario,
  currentState,
}: ScenarioDraftGateScreenProps) {
  const [approvedCheckIds, setApprovedCheckIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [practiceScenario, setPracticeScenario] = useState<Scenario | null>(
    null,
  );

  const allChecksApproved = useMemo(
    () =>
      SCENARIO_DRAFT_QA_CHECK_IDS.every((checkId) =>
        approvedCheckIds.has(checkId),
      ),
    [approvedCheckIds],
  );

  if (practiceScenario) {
    return (
      <ExperienceShell
        key={practiceScenario.id}
        scenarios={[practiceScenario]}
        currentStateByScenarioId={{ [practiceScenario.id]: currentState }}
        persistSession={false}
        restoreSession={false}
        requestRemoteChallenge={false}
        requestRemoteReport={false}
        introSummary="1 个真实 Draft · Human QA 已完成 · practice（未 verified） · AI Second Coach"
      />
    );
  }

  function toggleCheck(checkId: string): void {
    setApprovedCheckIds((current) => {
      const next = new Set(current);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  }

  function approveDraft(): void {
    const promoted = approveScenarioDraftForPractice(
      draft,
      authoredScenario,
      Array.from(approvedCheckIds),
    );
    setPracticeScenario(promoted);
  }

  return (
    <PageFrame family="spatial" eyebrow="GATE 1 · DRAFT → HUMAN QA">
      <main className="flex flex-col gap-6 py-5 lg:gap-8 lg:py-7">
        <header className="flex flex-col gap-3">
          <MetadataStrip
            items={[
              <span key="match">{draft.normalizedMatchState.source.match}</span>,
              <span key="map">{draft.normalizedMatchState.map.name.toUpperCase()}</span>,
              <span key="round">
                ROUND <Num>{draft.normalizedMatchState.round.number}</Num>
              </span>,
              <span key="tick">
                TICK <Num>{draft.normalizedMatchState.tick}</Num>
              </span>,
            ]}
          />
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-app-muted">
              真实节点先经过人工核验，再进入当前 Connected Decisions。
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-app-text lg:text-3xl">
              ScenarioDraft：Round {draft.normalizedMatchState.round.number} ·{" "}
              {draft.normalizedMatchState.time.display}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-app-muted">
              这里看到的是 demo 提取出的 current state。通过 Human QA 后，它会以
              practice Scenario 进入原有的 Situation → Initial Call → AI Challenge
              → Tactical Preview → Second Coach 流程；不会自动成为 verified 内容。
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(300px,4fr)] lg:items-start lg:gap-10">
          <section aria-label="真实比赛 current state" className="min-w-0">
            <TacticalPreview
              scenario={authoredScenario}
              call="A"
              variant="full"
              currentState={currentState}
            />
          </section>

          <aside className="flex flex-col gap-5">
            <section className="flex flex-col gap-3" aria-labelledby="draft-status">
              <div className="flex items-center justify-between gap-3">
                <h2 id="draft-status" className="text-base font-semibold text-app-text">
                  Draft 状态
                </h2>
                <span className="rounded-full border border-[#dfa45b]/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#f0bf7a]">
                  draft
                </span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs leading-relaxed">
                <dt className="text-app-muted">Draft ID</dt>
                <dd className="break-all font-mono text-app-text">{draft.id}</dd>
                <dt className="text-app-muted">来源</dt>
                <dd className="text-app-text">{draft.normalizedMatchState.source.demoFile}</dd>
                <dt className="text-app-muted">玩家</dt>
                <dd className="text-app-text">{draft.normalizedMatchState.players.length} unique SteamID · 5v5</dd>
                <dt className="text-app-muted">C4</dt>
                <dd className="text-app-text">
                  {draft.normalizedMatchState.bomb.carrierName ?? draft.normalizedMatchState.bomb.status}
                </dd>
              </dl>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="human-qa-heading">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 id="human-qa-heading" className="text-base font-semibold text-app-text">
                    Human QA
                  </h2>
                  <p className="mt-1 text-xs text-app-muted">逐项确认事实与空间标定。</p>
                </div>
                <span className="font-mono text-xs tabular-nums text-app-muted">
                  {approvedCheckIds.size}/{SCENARIO_DRAFT_QA_CHECK_IDS.length}
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-app-line border-y border-app-line">
                {draft.qaChecks.map((check) => {
                  const checked = approvedCheckIds.has(check.id);
                  return (
                    <li key={check.id} className="py-3">
                      <label className="flex cursor-pointer gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheck(check.id)}
                          aria-label={`Human QA：${check.label}`}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#dfa45b]"
                        />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-medium text-app-text">{check.label}</span>
                          <span className="text-xs leading-relaxed text-app-muted">{check.evidence}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={approveDraft}
                disabled={!allChecksApproved}
                className="h-12 w-full rounded-md bg-app-text text-sm font-medium text-app-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                通过 Human QA，进入 Second Coach
              </button>
              <p className="text-[11px] leading-relaxed text-app-muted">
                通过后状态只会提升到 <span className="font-mono text-app-text">practice</span>；
                verified 仍需要独立教练审核与内容发布流程。
              </p>
            </section>
          </aside>
        </div>
      </main>
    </PageFrame>
  );
}
