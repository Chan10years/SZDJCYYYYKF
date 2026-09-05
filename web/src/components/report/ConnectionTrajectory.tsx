"use client";

import type { CallId, RoundResult } from "@/domain/types";
import { scenarios } from "@/data/scenarios";

type RowStatus = "调整" | "坚持" | "一致";

type Row = {
  roundLabel: string;
  initialCall: CallId;
  aiCall: CallId | null;
  finalCall: CallId;
  professionalCall: CallId;
  status: RowStatus;
  professionalLabel: string;
};

function toTrajectoryRows(rounds: RoundResult[]): Row[] {
  return rounds.map((round, index) => {
    const scenario = scenarios.find((s) => s.id === round.scenarioId);
    const hasDisagreement =
      round.aiAlternativeCall !== null &&
      round.aiAlternativeCall !== round.initialCall;
    const status: RowStatus = !hasDisagreement
      ? "一致"
      : round.finalCall === round.aiAlternativeCall
        ? "调整"
        : "坚持";
    return {
      roundLabel: `R${index + 1}`,
      initialCall: round.initialCall,
      aiCall: hasDisagreement ? round.aiAlternativeCall : null,
      finalCall: round.finalCall,
      professionalCall: round.professionalCall,
      status,
      professionalLabel: scenario?.professional.pathLabel ?? "职业路径参考",
    };
  });
}

function InitialNode({ call }: { call: CallId }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-user text-base font-semibold text-app-user">
      {call}
    </span>
  );
}

function AiNode({ call }: { call: CallId }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-app-ai text-base font-semibold text-app-ai">
      {call}
    </span>
  );
}

function FinalNode({ call, changed }: { call: CallId; changed: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-app-user text-base font-semibold text-app-bg">
        {call}
      </span>
      {changed ? (
        <span className="text-app-user" aria-label="判断发生变化">
          ▸
        </span>
      ) : null}
    </span>
  );
}

function Connector() {
  return <span className="h-px w-5 shrink-0 bg-app-line" aria-hidden="true" />;
}

/**
 * Connection Trajectory —— 结果页第一视觉主角。
 * 每局一条节点链：Initial → AI → Final，Pro 信息完整文字不截断。
 * 状态为纯文字（调整 / 坚持 / 一致），不判断输赢、不用 pill。
 */
export function ConnectionTrajectory({ rounds }: { rounds: RoundResult[] }) {
  const rows = toTrajectoryRows(rounds);

  return (
    <section aria-label="连接轨迹" className="flex flex-col gap-6">
      {rows.map((row) => {
        const changed = row.finalCall !== row.initialCall;
        const chain = (
          <>
            <InitialNode call={row.initialCall} />
            <Connector />
            {row.aiCall ? (
              <AiNode call={row.aiCall} />
            ) : (
              <span className="text-[13px] text-app-muted">一致</span>
            )}
            <Connector />
            <FinalNode call={row.finalCall} changed={changed} />
          </>
        );
        const pro = (
          <p className="text-[13px] leading-relaxed text-app-muted">
            <span className="text-app-pro">Pro {row.professionalCall}</span>
            {" · "}
            {row.professionalLabel}
          </p>
        );
        return (
          <div key={row.roundLabel}>
            {/* desktop：单行网格，Pro 列弹性宽度保证完整 */}
            <div className="hidden items-center gap-4 md:grid md:grid-cols-[3rem_auto_auto_1fr]">
              <span className="font-mono text-xs tabular-nums text-app-muted">
                {row.roundLabel}
              </span>
              <div className="flex items-center gap-2">{chain}</div>
              <span className="text-[13px] text-app-text">{row.status}</span>
              {pro}
            </div>
            {/* mobile：链一行 + Pro 整行 */}
            <div className="flex flex-col gap-2 md:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-app-muted">
                  {row.roundLabel}
                </span>
                {chain}
                <span className="ml-1 text-[13px] text-app-text">
                  {row.status}
                </span>
              </div>
              {pro}
            </div>
          </div>
        );
      })}
    </section>
  );
}
