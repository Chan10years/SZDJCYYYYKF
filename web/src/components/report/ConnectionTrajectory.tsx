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
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-app-user text-sm font-semibold text-app-user">
      {call}
    </span>
  );
}

function AiNode({ call }: { call: CallId }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-app-ai/50 bg-app-ai/10 text-sm font-semibold text-app-ai">
      {call}
    </span>
  );
}

function FinalNode({ call, changed }: { call: CallId; changed: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-app-user text-sm font-semibold text-app-bg">
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
  return <span className="h-px w-4 shrink-0 bg-app-line" aria-hidden="true" />;
}

/** 状态 chip：纯文字轻量标，语义着色（调整=连接 AI 后变化；坚持=用户独立；一致=无分歧）。 */
const STATUS_STYLE: Record<RowStatus, string> = {
  调整: "bg-app-ai/15 text-app-ai",
  坚持: "bg-app-user/15 text-app-user",
  一致: "bg-app-elevated text-app-muted",
};

function StatusChip({ status }: { status: RowStatus }) {
  return (
    <span
      className={`inline-flex w-14 shrink-0 items-center justify-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

/**
 * Connection Trajectory —— 结果页第一视觉主角，三轮总表。
 * 每轮一整行：R# | 初始 → AI → 最终 | 状态 | 职业路径（完整文字不截断）。
 * 行底细分隔与对齐列建立“总表感”，不做看板卡片。
 */
export function ConnectionTrajectory({ rounds }: { rounds: RoundResult[] }) {
  const rows = toTrajectoryRows(rounds);

  return (
    <section aria-label="连接轨迹" className="flex flex-col">
      {rows.map((row) => {
        const changed = row.finalCall !== row.initialCall;
        const chain = (
          <>
            <InitialNode call={row.initialCall} />
            <Connector />
            {row.aiCall ? (
              <AiNode call={row.aiCall} />
            ) : (
              <span className="text-[12px] text-app-muted">一致</span>
            )}
            <Connector />
            <FinalNode call={row.finalCall} changed={changed} />
          </>
        );
        const pro = (
          <p className="text-[12px] leading-relaxed text-app-muted">
            <span className="text-app-pro">职业 {row.professionalCall}</span>
            {" · "}
            {row.professionalLabel}
          </p>
        );
        return (
          <div
            key={row.roundLabel}
            className="border-b border-app-line/50 py-3 first:pt-0 last:border-b-0"
          >
            {/* desktop ≥md：一轮一整行，列对齐 */}
            <div className="hidden items-center gap-4 md:grid md:grid-cols-[2rem_auto_3.5rem_1fr]">
              <span className="font-mono text-xs tabular-nums text-app-muted">
                {row.roundLabel}
              </span>
              <div className="flex items-center gap-2">{chain}</div>
              <StatusChip status={row.status} />
              {pro}
            </div>
            {/* mobile：主线一行 + 职业路径整行（缩进对齐链） */}
            <div className="flex flex-col gap-1.5 md:hidden">
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-app-muted">
                  {row.roundLabel}
                </span>
                {chain}
                <span className="flex-1" />
                <StatusChip status={row.status} />
              </div>
              <div className="pl-8">{pro}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
