"use client";

import type { CallId, RoundResult } from "@/domain/types";
import { scenarios } from "@/data/scenarios";

type RowStatus = "采纳" | "坚持" | "一致";

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
        ? "采纳"
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

const COLUMN_HEADERS = ["回合", "初始判断", "AI 挑战", "最终判断", "职业路径"];

function CallChip({
  call,
  emphasize = false,
}: {
  call: CallId;
  emphasize?: boolean;
}) {
  return (
    <span
      className={
        emphasize
          ? "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-app-accent bg-app-elevated text-base font-semibold text-app-accent"
          : "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-app-line bg-app-elevated text-base font-semibold text-app-text"
      }
    >
      {call}
    </span>
  );
}

const STATUS_STYLES: Record<RowStatus, string> = {
  采纳: "border-app-accent text-app-accent",
  坚持: "border-app-info text-app-info",
  一致: "border-app-line text-app-muted",
};

/**
 * Connection Trajectory —— 结果页最主要的视觉模块。
 * 每局一行：初始判断 | AI 挑战 | 最终判断 | 职业路径，
 * 状态标签为 采纳 / 坚持 / 一致，不判断输赢。
 */
export function ConnectionTrajectory({ rounds }: { rounds: RoundResult[] }) {
  const rows = toTrajectoryRows(rounds);

  return (
    <section className="rounded-lg border border-app-line bg-app-surface" aria-label="连接轨迹">
      <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr] items-center border-b border-app-line px-3 py-2">
        {COLUMN_HEADERS.map((label) => {
          const isRound = label === "回合";
          return (
            <p
              key={label}
              className={
                isRound
                  ? "text-[10px] font-mono uppercase tracking-wider text-app-muted"
                  : "text-center text-[10px] font-mono uppercase tracking-wider text-app-muted"
              }
            >
              {label}
            </p>
          );
        })}
      </div>

      <div className="flex flex-col">
        {rows.map((row) => {
          const changed = row.finalCall !== row.initialCall;
          return (
            <div
              key={row.roundLabel}
              className="flex flex-col border-b border-app-line px-3 py-4 last:border-b-0"
            >
              <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr] items-center gap-1">
                <span className="text-[12px] font-mono text-app-muted">
                  {row.roundLabel}
                </span>

                <div className="flex justify-center">
                  <CallChip call={row.initialCall} />
                </div>

                <div className="flex justify-center">
                  {row.aiCall ? (
                    <CallChip call={row.aiCall} />
                  ) : (
                    <span className="inline-flex h-11 w-11 items-center justify-center text-[12px] text-app-muted">
                      一致
                    </span>
                  )}
                </div>

                <div className="flex justify-center">
                  <CallChip call={row.finalCall} emphasize={changed} />
                </div>

                <div className="flex min-w-0 flex-col items-center gap-0.5">
                  <CallChip call={row.professionalCall} />
                  <span className="w-full truncate text-center text-[10px] text-app-muted">
                    {row.professionalLabel}
                  </span>
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[row.status]}`}
                >
                  {row.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}